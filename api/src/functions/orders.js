const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

function formatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDelivery(deliveryAt, status) {
  if (!deliveryAt) return 'A confirmar';
  if (status === 'Entregue') return 'Entregue';
  const d = new Date(deliveryAt);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje, ${timeStr}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${timeStr}`;
}

app.http('orders', {
  methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        await sql.query`
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('GestaoOrders') AND name = 'deletedAt')
            ALTER TABLE GestaoOrders ADD deletedAt DATETIME NULL
        `.catch(() => {});
        await sql.query`
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('GestaoOrders') AND name = 'balcaoStatus')
            ALTER TABLE GestaoOrders ADD balcaoStatus NVARCHAR(50) NULL
        `.catch(() => {});
        await sql.query`
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('GestaoOrders') AND name = 'balcaoPaymentMethod')
            ALTER TABLE GestaoOrders ADD balcaoPaymentMethod NVARCHAR(50) NULL
        `.catch(() => {});

        const [ordersResult, itemsResult, nfeResult] = await Promise.all([
          sql.query`
            SELECT id, clientName, clientCnpj, clientCity, clientPhone,
                   status, totalValue, deliveryAt, observations, purchasePurpose, createdAt, deletedAt,
                   balcaoStatus, balcaoPaymentMethod
            FROM GestaoOrders
            ORDER BY createdAt DESC
          `,
          sql.query`
            SELECT orderId, productName, quantity, unit, unitPrice
            FROM GestaoOrderItems
            ORDER BY id ASC
          `,
          sql.query`
            SELECT orderId, focusReference, nfeNumber, nfeSeries, accessKey, protocol, authorizedAt, sentToClientAt, status, errorCode, errorMessage
            FROM GestaoFiscalDocuments
            WHERE status IN ('AUTHORIZED', 'REJECTED', 'SUBMISSION_FAILED', 'PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')
              AND id IN (
                SELECT MAX(id) FROM GestaoFiscalDocuments
                WHERE status IN ('AUTHORIZED', 'REJECTED', 'SUBMISSION_FAILED', 'PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')
                GROUP BY orderId
              )
          `.catch(() => ({ recordset: [] })),
        ]);

        const nfeByOrder = {};
        for (const doc of nfeResult.recordset) {
          nfeByOrder[doc.orderId] = {
            reference: doc.focusReference,
            number: doc.nfeNumber,
            series: doc.nfeSeries,
            accessKey: doc.accessKey,
            protocol: doc.protocol,
            authorizedAt: doc.authorizedAt ? doc.authorizedAt.toISOString() : null,
            sentToClientAt: doc.sentToClientAt ? doc.sentToClientAt.toISOString() : null,
            nfeStatus: doc.status,
            errorCode: doc.errorCode || null,
            errorMessage: doc.errorMessage || null,
          };
        }

        const orders = ordersResult.recordset.map((o) => ({
          id: o.id,
          customer: o.clientName,
          cnpj: o.clientCnpj || '',
          city: o.clientCity || '',
          whatsapp: o.clientPhone || '',
          value: Number(o.totalValue),
          status: o.status,
          priority: 'Normal',
          time: formatTime(new Date(o.createdAt)),
          delivery: formatDelivery(o.deliveryAt, o.status),
          isDeleted: !!o.deletedAt,
          products: itemsResult.recordset
            .filter((i) => i.orderId === o.id)
            .map((i) => ({
              name: i.productName,
              qty: i.quantity,
              unit: i.unit,
              price: Number(i.unitPrice || 0),
            })),
          notes: o.observations || '',
          purchasePurpose: o.purchasePurpose || 'consumo',
          source: o.status === 'Balcão' ? 'Balcão' : undefined,
          ...(o.balcaoStatus ? { balcaoData: { balcaoStatus: o.balcaoStatus, paymentMethod: o.balcaoPaymentMethod || null, paymentConfirmedAt: null } } : {}),
          ...(nfeByOrder[o.id] ? {
            nfeData: nfeByOrder[o.id],
            nfeSentAt: nfeByOrder[o.id].sentToClientAt || null,
          } : {}),
        }));

        return { jsonBody: { orders } };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();
        const { orderId, status, sentToClient, balcaoStatus, paymentMethod } = body;
        if (!orderId) {
          return { status: 400, jsonBody: { error: 'orderId é obrigatório' } };
        }

        if (balcaoStatus) {
          await sql.query`
            UPDATE GestaoOrders
            SET balcaoStatus = ${balcaoStatus},
                balcaoPaymentMethod = ${paymentMethod || null},
                updatedAt = GETUTCDATE()
            WHERE id = ${orderId}
          `;
        }

        if (status) {
          await sql.query`
            UPDATE GestaoOrders
            SET status = ${status}, updatedAt = GETUTCDATE()
            WHERE id = ${orderId}
          `;

          if (status === 'Rota') {
            await sql.query`
              UPDATE Deliveries
              SET status = N'Em rota', updated_at = GETUTCDATE()
              WHERE id IN (
                SELECT delivery_id FROM DeliveryOrders WHERE order_id = ${orderId}
              )
            `;
          }

          if (status === 'Pronto') {
            const deliveryResult = await sql.query`
              SELECT d.id FROM Deliveries d
              INNER JOIN DeliveryOrders dor ON dor.delivery_id = d.id
              WHERE dor.order_id = ${orderId}
                AND d.status NOT IN (N'Cancelada', N'Concluída', N'Em rota')
            `;
            for (const delivery of deliveryResult.recordset) {
              const pending = await sql.query`
                SELECT COUNT(*) AS cnt FROM DeliveryOrders dor
                INNER JOIN GestaoOrders o ON o.id = dor.order_id
                WHERE dor.delivery_id = ${delivery.id}
                  AND o.status NOT IN (N'Pronto', N'Rota', N'Em rota', N'Entregue')
                  AND o.deletedAt IS NULL
              `;
              if (pending.recordset[0].cnt === 0) {
                await sql.query`
                  UPDATE Deliveries SET status = N'Carregando', updated_at = GETUTCDATE()
                  WHERE id = ${delivery.id}
                `;
              }
            }
          }
        }

        if (sentToClient) {
          await sql.query`
            UPDATE GestaoFiscalDocuments
            SET sentToClientAt = GETUTCDATE(), updatedAt = GETUTCDATE()
            WHERE orderId = ${orderId} AND status = 'AUTHORIZED'
          `.catch(() => {});
        }

        return { jsonBody: { success: true } };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const { orderId, clientId, clientName, clientCnpj, clientCity, clientPhone, totalValue, observations, items, purchasePurpose } = body;

        if (!orderId || !clientName || !items || items.length === 0) {
          return { status: 400, jsonBody: { error: 'orderId, clientName e items são obrigatórios' } };
        }

        await sql.query`
          UPDATE GestaoOrders
          SET clientId = ${clientId || null},
              clientName = ${clientName},
              clientCnpj = ${clientCnpj || null},
              clientCity = ${clientCity || null},
              clientPhone = ${clientPhone || null},
              totalValue = ${totalValue || 0},
              observations = ${observations || null},
              purchasePurpose = ${purchasePurpose || null},
              updatedAt = GETUTCDATE()
          WHERE id = ${orderId}
        `;

        const oldItemsResult = await sql.query`SELECT productName, quantity FROM GestaoOrderItems WHERE orderId = ${orderId}`;
        await sql.query`DELETE FROM GestaoOrderItems WHERE orderId = ${orderId}`;

        for (const item of items) {
          await sql.query`
            INSERT INTO GestaoOrderItems (orderId, productName, quantity, unit, unitPrice)
            VALUES (${orderId}, ${item.productName}, ${item.quantity}, ${item.unit || ''}, ${item.unitPrice || 0})
          `;
        }

        // Adjust stock: restore old quantities then deduct new quantities
        const oldMap = {};
        oldItemsResult.recordset.forEach((i) => { oldMap[i.productName] = (oldMap[i.productName] || 0) + i.quantity; });
        const newMap = {};
        items.forEach((i) => { newMap[i.productName] = (newMap[i.productName] || 0) + i.quantity; });
        const allNames = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
        for (const name of allNames) {
          const diff = (newMap[name] || 0) - (oldMap[name] || 0);
          if (diff > 0) {
            await sql.query`UPDATE Products SET availableQuantity = CASE WHEN availableQuantity >= ${diff} THEN availableQuantity - ${diff} ELSE 0 END, updatedAt = GETUTCDATE() WHERE name = ${name} AND active = 1`;
          } else if (diff < 0) {
            const restore = -diff;
            await sql.query`UPDATE Products SET availableQuantity = availableQuantity + ${restore}, updatedAt = GETUTCDATE() WHERE name = ${name} AND active = 1`;
          }
        }

        return { jsonBody: { success: true } };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { clientId, clientName, clientCnpj, clientCity, clientPhone, totalValue, observations, items, purchasePurpose, source, balcaoStatus: initialBalcaoStatus } = body;
        const isBalcao = source === 'Balcão';
        const initialStatus = isBalcao ? 'Balcão' : 'Recebido';

        if (!clientName || !items || items.length === 0) {
          return { status: 400, jsonBody: { error: 'clientName e items são obrigatórios' } };
        }

        const idResult = await sql.query`
          SELECT ISNULL(MAX(CAST(SUBSTRING(id, 5, LEN(id)) AS INT)), 2000) + 1 AS nextNum
          FROM GestaoOrders
          WHERE id LIKE 'PED-%' AND ISNUMERIC(SUBSTRING(id, 5, LEN(id))) = 1
        `;
        const newId = `PED-${idResult.recordset[0].nextNum}`;

        const insertResult = await sql.query`
          INSERT INTO GestaoOrders (id, clientId, clientName, clientCnpj, clientCity, clientPhone, status, balcaoStatus, totalValue, observations, purchasePurpose, createdAt, updatedAt)
          OUTPUT INSERTED.createdAt
          VALUES (
            ${newId},
            ${clientId || null},
            ${clientName},
            ${clientCnpj || null},
            ${clientCity || null},
            ${clientPhone || null},
            ${initialStatus},
            ${isBalcao ? (initialBalcaoStatus || 'aguardando_pagamento') : null},
            ${totalValue || 0},
            ${observations || null},
            ${purchasePurpose || null},
            GETUTCDATE(),
            GETUTCDATE()
          )
        `;

        const orderId = newId;

        for (const item of items) {
          await sql.query`
            INSERT INTO GestaoOrderItems (orderId, productName, quantity, unit, unitPrice)
            VALUES (${orderId}, ${item.productName}, ${item.quantity}, ${item.unit || ''}, ${item.unitPrice || 0})
          `;
          await sql.query`
            UPDATE Products
            SET availableQuantity = CASE WHEN availableQuantity >= ${item.quantity} THEN availableQuantity - ${item.quantity} ELSE 0 END,
                updatedAt = GETUTCDATE()
            WHERE name = ${item.productName} AND active = 1
          `;
        }

        // Keep static lastPurchase column in sync
        if (clientId) {
          await sql.query`
            UPDATE Clients SET lastPurchase = 'Hoje' WHERE id = ${clientId}
          `.catch(() => {});
        } else if (clientName) {
          await sql.query`
            UPDATE Clients SET lastPurchase = 'Hoje' WHERE establishmentName = ${clientName}
          `.catch(() => {});
        }

        return {
          status: 201,
          jsonBody: {
            order: {
              id: orderId,
              customer: clientName,
              cnpj: clientCnpj || '',
              city: clientCity || '',
              whatsapp: clientPhone || '',
              value: Number(totalValue) || 0,
              status: initialStatus,
              source: isBalcao ? 'Balcão' : undefined,
              ...(isBalcao ? { balcaoData: { balcaoStatus: initialBalcaoStatus || 'aguardando_pagamento', paymentMethod: null, paymentConfirmedAt: null } } : {}),
              priority: 'Normal',
              time: formatTime(new Date(insertResult.recordset[0].createdAt)),
              delivery: 'A confirmar',
              products: items.map((i) => ({
                name: i.productName,
                qty: i.quantity,
                unit: i.unit || '',
                price: Number(i.unitPrice) || 0,
              })),
              notes: observations || '',
              purchasePurpose: purchasePurpose || 'consumo',
            },
          },
        };
      }
      if (request.method === 'DELETE') {
        const { orderId } = await request.json();
        if (!orderId) {
          return { status: 400, jsonBody: { error: 'orderId é obrigatório' } };
        }

        // Check if this order has an authorized fiscal document
        const nfeCheck = await sql.query`
          SELECT id FROM GestaoFiscalDocuments WHERE orderId = ${orderId} AND status = 'AUTHORIZED'
        `;
        const hasAuthorizedNfe = nfeCheck.recordset.length > 0;

        const deletedItemsResult = await sql.query`SELECT productName, quantity FROM GestaoOrderItems WHERE orderId = ${orderId}`;
        await sql.query`DELETE FROM GestaoOrderItems WHERE orderId = ${orderId}`;

        // Restore stock only for orders not yet invoiced/delivered
        if (!hasAuthorizedNfe) {
          for (const item of deletedItemsResult.recordset) {
            await sql.query`UPDATE Products SET availableQuantity = availableQuantity + ${item.quantity}, updatedAt = GETUTCDATE() WHERE name = ${item.productName} AND active = 1`;
          }
        }

        // Always soft-delete: preserves the ID so it can't be reused by a new order
        await sql.query`UPDATE GestaoOrders SET deletedAt = GETUTCDATE() WHERE id = ${orderId}`;

        if (!hasAuthorizedNfe) {
          await sql.query`DELETE FROM DeliveryOrders WHERE order_id = ${orderId}`;
          await sql.query`DELETE FROM GestaoFiscalDocuments WHERE orderId = ${orderId}`;
        }

        // Remove any pending intervention for this order so stale data doesn't bleed into a new order with the same ID
        await sql.query`DELETE FROM NfeInterventions WHERE order_id = ${orderId}`.catch(() => {});

        return { jsonBody: { success: true, softDeleted: true } };
      }
    } catch (error) {
      context.error('Erro na função orders:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    }
  },
});
