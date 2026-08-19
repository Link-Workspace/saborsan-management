const { app } = require('@azure/functions');
const sql = require('mssql');
const { initializeApp: initFirebase, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

if (!getApps().length) {
  initFirebase({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

// Envia notificação delivery-confirmations ao entregador para confirmar data da entrega
async function notifyDeliveryConfirmation(sellerId, deliveryCode) {
  if (!sellerId) return;
  try {
    const sellerRow = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerRow.recordset.length) return;
    const { userId } = sellerRow.recordset[0];

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;

    // const messaging = getMessaging();
    // for (const token of tokens) {
    //   try {
    //     await messaging.send({
    //       token,
    //       notification: {
    //         title: `Entrega ${deliveryCode} planejada`,
    //         body: 'Confirme a data de saída para esta entrega.',
    //       },
    //       data: { type: 'delivery-confirmations', deliveryCode: String(deliveryCode) },
    //       android: { priority: 'high' },
    //       apns: { payload: { aps: { sound: 'default' } } },
    //     });
    //   } catch (err) {
    //     if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
    //       await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
    //     }
    //   }
    // }
  } catch {
    // Silenciar erros de notificação
  }
}

// Envia notificação push ao entregador sobre pedidos em Separação vinculados à entrega
async function notifyDriverAboutOrders(sellerId, orderIds, deliveryCode) {
  if (!sellerId || !orderIds.length) return;
  try {
    // Buscar userId do vendedor/entregador
    const sellerRow = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerRow.recordset.length) return;
    const { userId } = sellerRow.recordset[0];

    // Buscar apenas os pedidos que estão em Separação sem NF-e pendente de autorização
    const separacaoOrders = [];
    for (const orderId of orderIds) {
      const check = await sql.query`SELECT id, clientName FROM GestaoOrders WHERE id = ${orderId} AND status = N'Separação'`;
      if (!check.recordset.length) continue;
      const nfeBlocking = await sql.query`SELECT 1 AS found FROM GestaoFiscalDocuments WHERE orderId = ${orderId} AND status IN ('PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')`;
      if (nfeBlocking.recordset.length) continue;
      separacaoOrders.push(check.recordset[0]);
    }
    if (!separacaoOrders.length) return;

    // Buscar tokens FCM do entregador
    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;

    const messaging = getMessaging();
    for (const order of separacaoOrders) {
      const msgTitle = `Pedido ${order.id} em separação`;
      const msgBody = `Confirme quando o pedido de ${order.clientName} (entrega ${deliveryCode}) estiver pronto para entrar em rota.`;
      for (const token of tokens) {
        try {
          await messaging.send({
            token,
            notification: { title: msgTitle, body: msgBody },
            data: { type: 'order_ready_check', orderId: String(order.id), deliveryCode: String(deliveryCode), sellerId: String(sellerId) },
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
          });
        } catch (err) {
          if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
          }
        }
      }
    }
  } catch {
    // Silenciar erros de notificação para não quebrar o fluxo principal
  }
}

// Nega a entrega para o vendedor atual e reatribui para outro disponível ou remove a entrega
async function denyDelivery(deliveryCode, denyingSellerId) {
  // Buscar a entrega
  const deliveryResult = await sql.query`
    SELECT id, seller_id FROM Deliveries WHERE code = ${deliveryCode} AND status NOT IN (N'Cancelada', N'Concluída')
  `;
  if (!deliveryResult.recordset.length) return { success: false, reason: 'not_found' };
  const delivery = deliveryResult.recordset[0];

  // Buscar pedidos da entrega
  const ordersResult = await sql.query`SELECT order_id FROM DeliveryOrders WHERE delivery_id = ${delivery.id}`;
  const orderIds = ordersResult.recordset.map((r) => r.order_id);

  // Buscar vendedores disponíveis: ativos, diferentes do atual e sem entrega ativa vinculada
  const availableResult = await sql.query`
    SELECT s.id FROM Sellers s
    WHERE s.isActive = 1
      AND s.id != ${denyingSellerId}
      AND NOT EXISTS (
        SELECT 1 FROM Deliveries d
        WHERE d.seller_id = s.id
          AND d.status NOT IN (N'Cancelada', N'Concluída')
      )
  `;

  if (!availableResult.recordset.length) {
    // Sem vendedor disponível: remover entrega e voltar pedidos para Recebido
    if (orderIds.length) {
      for (const orderId of orderIds) {
        await sql.query`UPDATE GestaoOrders SET status = N'Recebido', updatedAt = GETUTCDATE() WHERE id = ${orderId}`;
      }
    }
    await sql.query`DELETE FROM DeliveryOrders WHERE delivery_id = ${delivery.id}`;
    await sql.query`DELETE FROM DeliveryClients WHERE delivery_id = ${delivery.id}`;
    await sql.query`DELETE FROM Deliveries WHERE id = ${delivery.id}`;
    return { success: true, action: 'removed' };
  }

  // Reatribuir para o primeiro vendedor disponível
  const newSellerId = availableResult.recordset[0].id;
  await sql.query`
    UPDATE Deliveries
    SET seller_id = ${newSellerId}, confirmation_sent = 0, updated_at = GETUTCDATE()
    WHERE id = ${delivery.id}
  `;

  // Notificar o novo vendedor
  await notifyDriverAboutOrders(newSellerId, orderIds, deliveryCode);
  return { success: true, action: 'reassigned', newSellerId };
}

// Garante que a coluna confirmation_sent existe na tabela Deliveries
async function ensureConfirmationSentColumn() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID(N'Deliveries') AND name = N'confirmation_sent'
    )
      ALTER TABLE Deliveries ADD confirmation_sent bit NOT NULL DEFAULT 0
  `;
}

app.http('deliveries', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const ordersForDelivery = url.searchParams.get('ordersForDelivery');
        const availableOrders = url.searchParams.get('availableOrders');

        // Retorna todos os pedidos vinculados a uma entrega com detalhes completos
        if (ordersForDelivery) {
          const deliveryRow = await sql.query`SELECT id FROM Deliveries WHERE code = ${ordersForDelivery}`;
          if (!deliveryRow.recordset.length) return { status: 404, jsonBody: { error: 'Entrega não encontrada' } };
          const deliveryDbId = deliveryRow.recordset[0].id;

          const result = await sql.query`
            SELECT o.id, o.clientName, o.clientCnpj, o.clientCity, o.clientPhone,
                   o.status, o.totalValue, o.deliveryAt, o.observations,
                   i.productName, i.quantity, i.unit, i.unitPrice
            FROM GestaoOrders o
            INNER JOIN DeliveryOrders dor ON dor.order_id = o.id
            LEFT JOIN GestaoOrderItems i ON i.orderId = o.id
            WHERE dor.delivery_id = ${deliveryDbId}
            ORDER BY o.id, i.id
          `;

          const ordersMap = new Map();
          for (const row of result.recordset) {
            if (!ordersMap.has(row.id)) {
              ordersMap.set(row.id, {
                id: row.id,
                clientName: row.clientName,
                clientCnpj: row.clientCnpj || '',
                clientCity: row.clientCity || '',
                clientPhone: row.clientPhone || '',
                status: row.status,
                totalValue: row.totalValue || 0,
                deliveryAt: row.deliveryAt ? new Date(row.deliveryAt).toISOString() : null,
                observations: row.observations || '',
                items: [],
              });
            }
            if (row.productName) {
              ordersMap.get(row.id).items.push({
                productName: row.productName,
                quantity: row.quantity,
                unit: row.unit,
                unitPrice: row.unitPrice,
              });
            }
          }
          return { jsonBody: { orders: Array.from(ordersMap.values()) } };
        }

        // Retorna pedidos disponíveis para adição: Recebido ou Separação, sem entrega ativa vinculada
        if (availableOrders === 'true') {
          const result = await sql.query`
            SELECT o.id, o.clientName, o.clientCnpj, o.clientCity, o.clientPhone,
                   o.status, o.totalValue, o.deliveryAt, o.observations
            FROM GestaoOrders o
            WHERE o.status IN (N'Recebido', N'Separação')
              AND (o.deletedAt IS NULL)
              AND NOT EXISTS (
                SELECT 1 FROM DeliveryOrders dor
                INNER JOIN Deliveries d ON d.id = dor.delivery_id
                WHERE dor.order_id = o.id
                  AND d.status NOT IN (N'Cancelada', N'Concluída')
              )
            ORDER BY o.id DESC
          `;
          const orders = result.recordset.map((o) => ({
            id: o.id,
            clientName: o.clientName,
            clientCnpj: o.clientCnpj || '',
            clientCity: o.clientCity || '',
            clientPhone: o.clientPhone || '',
            status: o.status,
            totalValue: o.totalValue || 0,
            deliveryAt: o.deliveryAt ? new Date(o.deliveryAt).toISOString() : null,
            observations: o.observations || '',
          }));
          return { jsonBody: { orders } };
        }

        const deliveriesResult = await sql.query`
          SELECT d.id, d.code, d.route, d.seller_id, d.status,
                 d.cold_chamber_number, d.stops_count, d.temperature,
                 d.departure_date, d.arrival_date, d.notes,
                 u.name AS driver_name, u.whatsapp AS driver_phone
          FROM Deliveries d
          LEFT JOIN Sellers s ON d.seller_id = s.id
          LEFT JOIN Users u ON s.userId = u.id
          ORDER BY d.id DESC
        `;

        let deliveryOrderRows = [];
        try {
          const doResult = await sql.query`SELECT delivery_id, order_id FROM DeliveryOrders`;
          deliveryOrderRows = doResult.recordset;
        } catch (e) { context.warn('DeliveryOrders query:', e.message); }

        const progressMap = { 'Planejada': 0, 'Carregando': 25, 'Em rota': 60, 'Concluída': 100, 'Cancelada': 0 };

        const deliveries = deliveriesResult.recordset.map((d) => {
          const orderIds = deliveryOrderRows
            .filter((o) => o.delivery_id === d.id)
            .map((o) => o.order_id);
          const chamberNum = String(d.cold_chamber_number || 1).padStart(2, '0');
          return {
            id: d.code,
            driver: d.driver_name || '',
            driverPhone: d.driver_phone || '',
            vehicle: `Câmara fria ${chamberNum}`,
            route: d.route,
            stops: d.stops_count || 0,
            temperature: d.temperature != null ? `${parseFloat(d.temperature).toFixed(1)}°C` : '-18.0°C',
            status: d.status,
            progress: progressMap[d.status] ?? 0,
            departureDate: d.departure_date ? new Date(d.departure_date).toISOString() : null,
            arrivalDate: d.arrival_date ? new Date(d.arrival_date).toISOString() : null,
            notes: d.notes || '',
            orderIds,
          };
        });

        return { jsonBody: { deliveries } };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { sellerId, route, vehicle, temperature, status, departureDate, arrivalDate, notes, stops, orderIds } = body;

        if (!sellerId || !route) {
          return { status: 400, jsonBody: { error: 'sellerId e route são obrigatórios' } };
        }

        // Verificar se algum dos pedidos já está em uma entrega ativa para evitar duplicação
        if (Array.isArray(orderIds) && orderIds.length > 0) {
          for (const orderId of orderIds) {
            const existingCheck = await sql.query`
              SELECT d.code
              FROM Deliveries d
              INNER JOIN DeliveryOrders dor ON dor.delivery_id = d.id
              WHERE dor.order_id = ${orderId}
              AND d.status NOT IN (N'Cancelada', N'Concluída')
            `;
            if (existingCheck.recordset.length > 0) {
              return {
                status: 409,
                jsonBody: {
                  error: `O pedido ${orderId} já está associado à entrega ativa ${existingCheck.recordset[0].code}. Use PATCH para atualizar a entrega existente.`,
                  existingCode: existingCheck.recordset[0].code,
                },
              };
            }
          }
        }

        const codeResult = await sql.query`
          SELECT MAX(TRY_CAST(SUBSTRING(code, 3, LEN(code)) AS INT)) AS maxNum
          FROM Deliveries WHERE code LIKE 'R-%'
        `;
        const maxNum = codeResult.recordset[0].maxNum || 0;
        const code = 'R-' + (maxNum + 1);

        const chamberMatch = vehicle ? vehicle.match(/\d+/) : null;
        const chamberNum = chamberMatch ? parseInt(chamberMatch[0]) : 1;
        const tempVal = temperature !== undefined && temperature !== '' && temperature !== null
          ? parseFloat(String(temperature).replace('°C', ''))
          : -18.0;
        const statusVal = 'Planejada';
        const stopsCount = stops || 0;
        const notesVal = notes || '';
        const departureDateVal = departureDate ? new Date(departureDate) : null;
        const arrivalDateVal = arrivalDate ? new Date(arrivalDate) : null;
        const confirmationSent = departureDateVal ? 0 : 1;

        await ensureConfirmationSentColumn();

        const insertResult = await sql.query`
          INSERT INTO Deliveries (code, route, seller_id, status, cold_chamber_number, stops_count, temperature, departure_date, arrival_date, notes, confirmation_sent, updated_at)
          OUTPUT INSERTED.id
          VALUES (${code}, ${route}, ${sellerId}, ${statusVal}, ${chamberNum}, ${stopsCount}, ${tempVal}, ${departureDateVal}, ${arrivalDateVal}, ${notesVal}, ${confirmationSent}, GETUTCDATE())
        `;

        const newId = insertResult.recordset[0].id;

        if (Array.isArray(orderIds) && orderIds.length > 0) {
          for (const orderId of orderIds) {
            await sql.query`INSERT INTO DeliveryOrders (delivery_id, order_id) VALUES (${newId}, ${orderId})`;
          }
        }

        // Notificar entregador sobre pedidos em Separação vinculados a esta entrega
        await notifyDriverAboutOrders(sellerId, orderIds || [], code);
        // Enviar delivery-confirmations imediatamente apenas se não houver data de saída agendada
        if (!departureDateVal) {
          await notifyDeliveryConfirmation(sellerId, code);
        }

        return { status: 201, jsonBody: { success: true, code, id: newId } };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();
        const { deliveryId, status, route, sellerId, vehicle, temperature, departureDate, arrivalDate, notes, stops, orderIds, fullUpdate } = body;

        if (body.confirmDeliveryRoute) {
          const { deliveryCode, removeOrderIds = [], addOrderIds = [] } = body.confirmDeliveryRoute;
          if (!deliveryCode) return { status: 400, jsonBody: { error: 'deliveryCode é obrigatório' } };

          const deliveryRow = await sql.query`
            SELECT id FROM Deliveries
            WHERE code = ${deliveryCode} AND status NOT IN (N'Cancelada', N'Concluída')
          `;
          if (!deliveryRow.recordset.length) return { status: 404, jsonBody: { error: 'Entrega não encontrada' } };
          const deliveryDbId = deliveryRow.recordset[0].id;

          // Remover pedidos solicitados da entrega e reverter status para Recebido
          for (const orderId of removeOrderIds) {
            await sql.query`DELETE FROM DeliveryOrders WHERE delivery_id = ${deliveryDbId} AND order_id = ${orderId}`;
            await sql.query`
              UPDATE GestaoOrders SET status = N'Recebido', updatedAt = GETUTCDATE()
              WHERE id = ${orderId} AND status IN (N'Recebido', N'Separação', N'Pronto')
            `;
          }

          // Adicionar novos pedidos à entrega (sem duplicatas)
          for (const orderId of addOrderIds) {
            const existing = await sql.query`
              SELECT 1 AS found FROM DeliveryOrders WHERE delivery_id = ${deliveryDbId} AND order_id = ${orderId}
            `;
            if (!existing.recordset.length) {
              await sql.query`INSERT INTO DeliveryOrders (delivery_id, order_id) VALUES (${deliveryDbId}, ${orderId})`;
            }
          }

          // Confirmar: mover todos os pedidos restantes para Rota e a entrega para Em rota
          const remaining = await sql.query`SELECT order_id FROM DeliveryOrders WHERE delivery_id = ${deliveryDbId}`;
          for (const row of remaining.recordset) {
            await sql.query`
              UPDATE GestaoOrders SET status = N'Rota', updatedAt = GETUTCDATE()
              WHERE id = ${row.order_id} AND status IN (N'Recebido', N'Separação', N'Pronto')
            `;
          }

          await sql.query`
            UPDATE Deliveries SET status = N'Em rota', updated_at = GETUTCDATE()
            WHERE id = ${deliveryDbId}
          `;

          return { jsonBody: { success: true } };
        }

        if (body.denyDelivery) {
          const { deliveryCode: denyCode, sellerId: denyingSellerId } = body.denyDelivery;
          if (!denyCode || !denyingSellerId) {
            return { status: 400, jsonBody: { error: 'deliveryCode e sellerId são obrigatórios para negar entrega' } };
          }
          const result = await denyDelivery(denyCode, denyingSellerId);
          return { jsonBody: result };
        }

        if (!deliveryId) {
          return { status: 400, jsonBody: { error: 'deliveryId é obrigatório' } };
        }

        if (fullUpdate) {
          const chamberMatch = vehicle ? vehicle.match(/\d+/) : null;
          const chamberNum = chamberMatch ? parseInt(chamberMatch[0]) : 1;
          const tempVal = temperature !== undefined && temperature !== '' && temperature !== null
            ? parseFloat(String(temperature).replace('°C', ''))
            : null;
          const departureDateVal = departureDate ? new Date(departureDate) : null;
          const arrivalDateVal = arrivalDate ? new Date(arrivalDate) : null;

          await sql.query`
            UPDATE Deliveries
            SET route = ${route},
                seller_id = ${sellerId},
                cold_chamber_number = ${chamberNum},
                stops_count = ${stops || 0},
                temperature = ${tempVal},
                departure_date = ${departureDateVal},
                arrival_date = ${arrivalDateVal},
                confirmation_sent = 0,
                notes = ${notes || ''},
                updated_at = GETUTCDATE()
            WHERE code = ${deliveryId}
          `;

          const idResult = await sql.query`SELECT id FROM Deliveries WHERE code = ${deliveryId}`;
          if (idResult.recordset.length > 0) {
            const dbId = idResult.recordset[0].id;
            await sql.query`DELETE FROM DeliveryOrders WHERE delivery_id = ${dbId}`;
            if (Array.isArray(orderIds) && orderIds.length > 0) {
              for (const orderId of orderIds) {
                await sql.query`INSERT INTO DeliveryOrders (delivery_id, order_id) VALUES (${dbId}, ${orderId})`;
              }
            }
          }

        } else if (status !== undefined) {
          await sql.query`
            UPDATE Deliveries
            SET status = ${status},
                updated_at = GETUTCDATE()
            WHERE code = ${deliveryId}
          `;
        } else if (body.deliveryConfirmation) {
          const { type, scheduledDate } = body.deliveryConfirmation;
          let departureDateVal, arrivalDateVal;
          if (type === 'now') {
            departureDateVal = new Date();
            arrivalDateVal = new Date(departureDateVal.getTime() + 4 * 60 * 60 * 1000);
          } else if (type === 'scheduled' && scheduledDate) {
            departureDateVal = new Date(scheduledDate);
            arrivalDateVal = new Date(departureDateVal.getTime() + 4 * 60 * 60 * 1000);
          }
          if (departureDateVal && arrivalDateVal) {
            await sql.query`
              UPDATE Deliveries
              SET departure_date = ${departureDateVal},
                  arrival_date = ${arrivalDateVal},
                  updated_at = GETUTCDATE()
              WHERE code = ${deliveryId}
            `;
          }
        }

        return { jsonBody: { success: true } };
      }

      if (request.method === 'DELETE') {
        const body = await request.json();
        const { deliveryId } = body;

        if (!deliveryId) {
          return { status: 400, jsonBody: { error: 'deliveryId é obrigatório' } };
        }

        await sql.query`DELETE FROM DeliveryOrders WHERE delivery_id = (SELECT id FROM Deliveries WHERE code = ${deliveryId})`;
        await sql.query`DELETE FROM DeliveryClients WHERE delivery_id = (SELECT id FROM Deliveries WHERE code = ${deliveryId})`;
        await sql.query`DELETE FROM Deliveries WHERE code = ${deliveryId}`;

        return { jsonBody: { success: true } };
      }
    } catch (error) {
      context.error('Erro na função deliveries:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    }
  },
});
