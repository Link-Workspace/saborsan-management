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

// Approximate coordinates for major SC cities to calculate route corridors
const CITY_COORDS = {
  'Lages': { lat: -27.815, lng: -50.326 },
  'Florianópolis': { lat: -27.595, lng: -48.548 },
  'Blumenau': { lat: -26.919, lng: -49.066 },
  'Chapecó': { lat: -27.100, lng: -52.615 },
  'Joinville': { lat: -26.304, lng: -48.846 },
  'Criciúma': { lat: -28.678, lng: -49.370 },
  'Itajaí': { lat: -26.907, lng: -48.662 },
  'Jaraguá do Sul': { lat: -26.486, lng: -49.071 },
  'Palhoça': { lat: -27.644, lng: -48.669 },
  'Balneário Camboriú': { lat: -26.990, lng: -48.635 },
  'São José': { lat: -27.594, lng: -48.624 },
  'Brusque': { lat: -27.098, lng: -48.916 },
  'Tubarão': { lat: -28.467, lng: -49.009 },
  'Caçador': { lat: -26.775, lng: -51.014 },
  'Concórdia': { lat: -27.233, lng: -52.027 },
  'Rio do Sul': { lat: -27.213, lng: -49.643 },
  'Videira': { lat: -27.007, lng: -51.156 },
  'Joaçaba': { lat: -27.178, lng: -51.503 },
  'Canoinhas': { lat: -26.178, lng: -50.389 },
  'Mafra': { lat: -26.116, lng: -49.804 },
  'São Bento do Sul': { lat: -26.249, lng: -49.378 },
  'Biguaçu': { lat: -27.494, lng: -48.656 },
  'Gaspar': { lat: -26.930, lng: -48.959 },
  'Araranguá': { lat: -28.934, lng: -49.488 },
  'Laguna': { lat: -28.483, lng: -48.782 },
  'Imbituba': { lat: -28.240, lng: -48.671 },
  'Garopaba': { lat: -28.027, lng: -48.617 },
  'Orleans': { lat: -28.360, lng: -49.296 },
  'Içara': { lat: -28.715, lng: -49.305 },
  'Sombrio': { lat: -29.103, lng: -49.629 },
  'São Joaquim': { lat: -28.294, lng: -49.934 },
  'Urubici': { lat: -27.936, lng: -49.592 },
  'Curitibanos': { lat: -27.286, lng: -50.584 },
  'Santa Cecília': { lat: -26.961, lng: -50.424 },
  'Campos Novos': { lat: -27.401, lng: -51.225 },
  'Xanxerê': { lat: -26.876, lng: -52.402 },
  'São Miguel do Oeste': { lat: -26.723, lng: -53.514 },
  'Maravilha': { lat: -26.769, lng: -53.177 },
  'Pinhalzinho': { lat: -26.851, lng: -52.981 },
  'Quilombo': { lat: -26.732, lng: -52.715 },
  'São Lourenço do Oeste': { lat: -26.367, lng: -52.852 },
  'Dionísio Cerqueira': { lat: -26.260, lng: -53.635 },
  'Itapiranga': { lat: -27.168, lng: -53.706 },
  'Mondaí': { lat: -27.102, lng: -53.402 },
  'Tunápolis': { lat: -27.047, lng: -53.665 },
  'Palmitos': { lat: -27.074, lng: -53.161 },
  'Caxambu do Sul': { lat: -27.136, lng: -52.870 },
  'Águas de Chapecó': { lat: -27.184, lng: -52.986 },
  'Seara': { lat: -27.152, lng: -52.322 },
  'Ipumirim': { lat: -27.188, lng: -52.207 },
  'Herval d\'Oeste': { lat: -27.189, lng: -51.485 },
  'Treze Tílias': { lat: -27.001, lng: -51.407 },
  'Tangará': { lat: -27.120, lng: -51.246 },
  'Pinheiro Preto': { lat: -27.061, lng: -51.223 },
  'Fraiburgo': { lat: -27.026, lng: -50.919 },
  'Lebon Régis': { lat: -26.928, lng: -50.691 },
  'Matos Costa': { lat: -26.467, lng: -51.138 },
  'Porto União': { lat: -26.236, lng: -51.079 },
  'Irineópolis': { lat: -26.233, lng: -50.802 },
  'Major Vieira': { lat: -26.369, lng: -50.321 },
  'Três Barras': { lat: -26.115, lng: -50.316 },
  'Papanduva': { lat: -26.376, lng: -50.141 },
  'Monte Castelo': { lat: -26.457, lng: -50.231 },
  'Santa Terezinha': { lat: -26.793, lng: -50.011 },
};

function deg2rad(deg) { return deg * (Math.PI / 180); }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns true if point P is approximately on the corridor between A and B
function isOnCorridor(aLat, aLng, bLat, bLng, pLat, pLng, corridorKm = 40) {
  const totalDist = haversineKm(aLat, aLng, bLat, bLng);
  const distAP = haversineKm(aLat, aLng, pLat, pLng);
  const distPB = haversineKm(pLat, pLng, bLat, bLng);
  // P is on corridor if distAP + distPB ≤ totalDist + corridorKm
  return distAP + distPB <= totalDist + corridorKm && distAP < totalDist;
}

// Given an origin city and destination city, returns all known cities on the corridor
function getCitiesOnRoute(originCity, destCity) {
  const origin = CITY_COORDS[originCity];
  const dest = CITY_COORDS[destCity];
  if (!origin || !dest) return [];
  const result = [];
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (city === originCity || city === destCity) continue;
    if (isOnCorridor(origin.lat, origin.lng, dest.lat, dest.lng, coords.lat, coords.lng)) {
      result.push(city);
    }
  }
  return result;
}

// Normalize city name for comparison (strip " - SC" suffix if present)
function normalizeCity(city) {
  return (city || '').replace(/\s*-\s*SC\s*$/i, '').trim();
}

// Determine the farthest city from a reference point among a list of cities
function getFarthestCity(refCity, cities) {
  const ref = CITY_COORDS[refCity];
  if (!ref) return cities[0];
  let farthest = null;
  let maxDist = -1;
  for (const city of cities) {
    const coords = CITY_COORDS[city];
    if (!coords) continue;
    const dist = haversineKm(ref.lat, ref.lng, coords.lat, coords.lng);
    if (dist > maxDist) { maxDist = dist; farthest = city; }
  }
  return farthest || cities[0];
}

async function notifySellerAboutDelivery(sellerId, orderIds, deliveryCode, context) {
  if (!sellerId || !orderIds.length) return;
  try {
    const sellerRow = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerRow.recordset.length) {
      context?.log(`[auto-delivery] notificação ignorada: vendedor ${sellerId} não encontrado`);
      return;
    }
    const { userId } = sellerRow.recordset[0];

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) {
      context?.log(`[auto-delivery] notificação ignorada: nenhum token FCM para userId ${userId}`);
      return;
    }

    const separacaoOrders = [];
    for (const orderId of orderIds) {
      const r = await sql.query`SELECT id, clientName FROM GestaoOrders WHERE id = ${orderId} AND status = N'Separação'`;
      if (!r.recordset.length) continue;
      // Não notificar enquanto houver NF-e pendente de autorização para este pedido
      const nfeBlocking = await sql.query`SELECT 1 AS found FROM GestaoFiscalDocuments WHERE orderId = ${orderId} AND status IN ('PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')`;
      if (nfeBlocking.recordset.length) {
        context?.log(`[auto-delivery] order_ready_check ignorado: NF-e do pedido ${orderId} ainda em ${nfeBlocking.recordset[0] ? 'processamento' : '?'}`);
        continue;
      }
      separacaoOrders.push(r.recordset[0]);
    }
    if (!separacaoOrders.length) {
      context?.log(`[auto-delivery] notificação ignorada: nenhum pedido elegível (em Separação com NF-e autorizada ou sem NF-e) para os ids ${orderIds}`);
      return;
    }

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
          context?.log(`[auto-delivery] order_ready_check enviado: pedido ${order.id}, entrega ${deliveryCode}, token ...${token.slice(-6)}`);
        } catch (err) {
          if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
            context?.log(`[auto-delivery] token inválido removido: ...${token.slice(-6)}`);
          } else {
            context?.error(`[auto-delivery] erro ao enviar FCM para token ...${token.slice(-6)}:`, err);
          }
        }
      }
    }
  } catch (err) {
    context?.error('Erro ao notificar vendedor (auto-delivery):', err);
  }
}

async function setDeliveryProgress(step, isRunning = true) {
  try {
    await sql.query`UPDATE AutomationConfig SET delivery_is_running=${isRunning?1:0}, delivery_current_step=${step}, updated_at=GETUTCDATE() WHERE automation_key='receive_orders'`;
  } catch (_) {}
}

// Core automation logic — shared between HTTP trigger and timer trigger
async function runAutoDelivery(context) {
  await sql.connect(sqlConfig);

  const cfgResult = await sql.query`
    SELECT is_active, min_orders, max_orders, max_cities, include_route_cities,
           time_interval_minutes, time_start, time_end
    FROM AutomationConfig WHERE automation_key = 'receive_orders'
  `.catch(() => ({ recordset: [] }));

  if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) {
    return { skipped: true, reason: 'Automação não está ativa.' };
  }

  const cfg = cfgResult.recordset[0];
  const minOrders = cfg.min_orders || 1;
  const maxOrders = cfg.max_orders || 10;
  const maxCities = cfg.max_cities || 5;
  const includeRouteCities = !!cfg.include_route_cities;

  // Check time window
  const now = new Date();
  const nowUTC3 = new Date(now.getTime() - 3 * 60 * 60 * 1000); // approximate BRT
  const currentTime = `${String(nowUTC3.getHours()).padStart(2, '0')}:${String(nowUTC3.getMinutes()).padStart(2, '0')}`;
  if (cfg.time_start && cfg.time_end) {
    const overnight = cfg.time_end < cfg.time_start;
    const inWindow = overnight
      ? (currentTime >= cfg.time_start || currentTime <= cfg.time_end)
      : (currentTime >= cfg.time_start && currentTime <= cfg.time_end);
    if (!inWindow) {
      return { skipped: true, reason: 'Fora do horário configurado.' };
    }
  }

  await setDeliveryProgress('Buscando pedidos pendentes...');

  // Load seller bindings
  const bindingsResult = await sql.query`
    SELECT seller_id, binding_type, binding_value
    FROM AutomationSellerBindings
    WHERE automation_key = 'receive_orders'
  `.catch(() => ({ recordset: [] }));
  const bindings = bindingsResult.recordset;

  // Load pending orders with status 'Recebido'
  const ordersResult = await sql.query`
    SELECT o.id, o.clientName, o.clientCity, o.totalValue
    FROM GestaoOrders o
    WHERE o.status = N'Recebido'
      AND (o.deletedAt IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM DeliveryOrders dor
        INNER JOIN Deliveries d ON dor.delivery_id = d.id
        WHERE dor.order_id = o.id AND d.status NOT IN (N'Cancelada', N'Concluída')
      )
    ORDER BY o.createdAt ASC
  `;

  const pendingOrders = ordersResult.recordset;
  if (pendingOrders.length < minOrders) {
    return { skipped: true, reason: `Pedidos pendentes (${pendingOrders.length}) abaixo do mínimo configurado (${minOrders}).` };
  }

  await setDeliveryProgress(`Encontrado(s) ${pendingOrders.length} pedido(s). Buscando vendedores e veículos...`);

  // Find available sellers (active, no active delivery)
  const availableSellersResult = await sql.query`
    SELECT s.id, u.name, s.city AS sellerCity
    FROM Sellers s
    INNER JOIN Users u ON s.userId = u.id
    WHERE s.isActive = 1
      AND NOT EXISTS (
        SELECT 1 FROM Deliveries d
        WHERE d.seller_id = s.id AND d.status NOT IN (N'Cancelada', N'Concluída')
      )
    ORDER BY u.name ASC
  `;
  const availableSellers = availableSellersResult.recordset;

  if (!availableSellers.length) {
    return { skipped: true, reason: 'Nenhum vendedor disponível no momento.' };
  }

  // Find available vehicles (not in active delivery)
  const vehiclesResult = await sql.query`
    SELECT v.id, v.name
    FROM Vehicles v
    WHERE NOT EXISTS (
      SELECT 1 FROM Deliveries d
      WHERE d.cold_chamber_number = v.id AND d.status NOT IN (N'Cancelada', N'Concluída')
    )
    ORDER BY v.id ASC
  `.catch(() => ({ recordset: [] }));

  let vehicleId = null;
  let vehicleName = 'Câmara fria 01';
  if (vehiclesResult.recordset.length) {
    vehicleId = vehiclesResult.recordset[0].id;
    vehicleName = vehiclesResult.recordset[0].name;
  } else {
    for (let i = 1; i <= 10; i++) {
      const check = await sql.query`
        SELECT 1 FROM Deliveries WHERE cold_chamber_number = ${i} AND status NOT IN (N'Cancelada', N'Concluída')
      `;
      if (!check.recordset.length) { vehicleId = i; vehicleName = `Câmara fria ${String(i).padStart(2, '0')}`; break; }
    }
  }

  if (!vehicleId) {
    return { skipped: true, reason: 'Nenhum veículo disponível no momento.' };
  }

  // Select orders up to maxOrders
  const selectedOrders = pendingOrders.slice(0, maxOrders);

  // Determine cities from selected orders
  const orderCities = [...new Set(selectedOrders.map((o) => normalizeCity(o.clientCity)).filter(Boolean))];

  // Count city occurrences to find dominant city for seller binding
  const cityCounts = {};
  for (const city of selectedOrders.map((o) => normalizeCity(o.clientCity))) {
    if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;
  }
  const dominantCity = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0] || '';

  // Determine seller using bindings
  let chosenSeller = null;

  // Check city bindings first
  for (const seller of availableSellers) {
    const cityBinding = bindings.find(
      (b) => b.binding_type === 'city' && b.seller_id === seller.id &&
             normalizeCity(b.binding_value) === dominantCity
    );
    if (cityBinding) { chosenSeller = seller; break; }
  }

  // Check client bindings if no city match
  if (!chosenSeller) {
    for (const seller of availableSellers) {
      for (const order of selectedOrders) {
        const clientBinding = bindings.find(
          (b) => b.binding_type === 'client' && b.seller_id === seller.id &&
                 b.binding_value.toLowerCase() === (order.clientName || '').toLowerCase()
        );
        if (clientBinding) { chosenSeller = seller; break; }
      }
      if (chosenSeller) break;
    }
  }

  // Fallback to first available seller
  if (!chosenSeller) chosenSeller = availableSellers[0];

  // Build route cities
  let routeCities = orderCities.slice(0, maxCities);

  if (includeRouteCities && routeCities.length > 0) {
    const originCity = normalizeCity(chosenSeller.sellerCity) || routeCities[0];
    const farthest = getFarthestCity(originCity, routeCities);
    if (farthest) {
      const citiesOnRoute = getCitiesOnRoute(originCity, farthest);
      for (const city of citiesOnRoute) {
        if (!routeCities.includes(city) && routeCities.length < maxCities) {
          routeCities.push(city);
        }
      }
    }
  }

  const route = routeCities.join(' → ') || selectedOrders.map((o) => normalizeCity(o.clientCity)).filter(Boolean).join(' → ') || 'Rota automática';

  // Generate delivery code
  const codeResult = await sql.query`
    SELECT MAX(TRY_CAST(SUBSTRING(code, 3, LEN(code)) AS INT)) AS maxNum
    FROM Deliveries WHERE code LIKE 'R-%'
  `;
  const maxNum = codeResult.recordset[0].maxNum || 0;
  const code = 'R-' + (maxNum + 1);

  // Ensure confirmation_sent column exists
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Deliveries') AND name = N'confirmation_sent')
      ALTER TABLE Deliveries ADD confirmation_sent bit NOT NULL DEFAULT 0
  `.catch(() => {});

  const stopsCount = routeCities.length || selectedOrders.length;

  await setDeliveryProgress(`Criando entrega para ${chosenSeller.name} — Rota: ${route}...`);

  const insertResult = await sql.query`
    INSERT INTO Deliveries
      (code, route, seller_id, status, cold_chamber_number, stops_count, temperature, departure_date, arrival_date, notes, confirmation_sent, updated_at)
    OUTPUT INSERTED.id
    VALUES
      (${code}, ${route}, ${chosenSeller.id}, N'Planejada', ${vehicleId}, ${stopsCount},
       NULL, NULL, NULL, N'', 1, GETUTCDATE())
  `;
  const newDeliveryId = insertResult.recordset[0].id;

  for (const order of selectedOrders) {
    await sql.query`INSERT INTO DeliveryOrders (delivery_id, order_id) VALUES (${newDeliveryId}, ${order.id})`;
    await sql.query`UPDATE GestaoOrders SET status = N'Separação', updatedAt = GETUTCDATE() WHERE id = ${order.id} AND status = N'Recebido'`;
  }

  await setDeliveryProgress(`Notificando vendedor ${chosenSeller.name}...`);
  await notifySellerAboutDelivery(chosenSeller.id, selectedOrders.map((o) => o.id), code, context);

  // Log execution
  const resultMessage = `Entrega ${code} criada com ${selectedOrders.length} pedido(s) para ${chosenSeller.name} — Rota: ${route}`;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationRunLog')
    CREATE TABLE AutomationRunLog (
      id INT PRIMARY KEY IDENTITY,
      automation_key NVARCHAR(100) NOT NULL,
      result_message NVARCHAR(500),
      created_at DATETIME DEFAULT GETUTCDATE()
    )
  `.catch(() => {});
  await sql.query`
    INSERT INTO AutomationRunLog (automation_key, result_message) VALUES ('receive_orders', ${resultMessage})
  `.catch(() => {});
  await setDeliveryProgress(resultMessage, false);

  return {
    success: true,
    deliveryCode: code,
    sellerId: chosenSeller.id,
    sellerName: chosenSeller.name,
    orderCount: selectedOrders.length,
    route,
    message: resultMessage,
  };
}

app.http('auto-delivery', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const cfgResult = await sql.query`
          SELECT is_active, updated_at FROM AutomationConfig WHERE automation_key = 'receive_orders'
        `.catch(() => ({ recordset: [] }));

        const lastRun = await sql.query`
          SELECT TOP 1 created_at, result_message FROM AutomationRunLog
          WHERE automation_key = 'receive_orders'
          ORDER BY id DESC
        `.catch(() => ({ recordset: [] }));

        return {
          jsonBody: {
            isActive: cfgResult.recordset[0]?.is_active ?? false,
            lastRun: lastRun.recordset[0] || null,
          },
        };
      }

      if (request.method === 'POST') {
        const result = await runAutoDelivery(context);
        return { jsonBody: result };
      }
    } catch (error) {
      context.error('Erro na função auto-delivery:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    }
  },
});

// Timer trigger — fires every minute and executes automation when interval has elapsed
app.timer('autoDeliveryTimer', {
  schedule: '0 * * * * *',
  handler: async (myTimer, context) => {
    try {
      await sql.connect(sqlConfig);

      const cfgResult = await sql.query`
        SELECT is_active, time_interval_minutes
        FROM AutomationConfig WHERE automation_key = 'receive_orders'
      `.catch(() => ({ recordset: [] }));

      if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) return;

      const intervalMinutes = cfgResult.recordset[0].time_interval_minutes || 30;

      // Only run if enough time has passed since the last execution
      const lastRunResult = await sql.query`
        SELECT TOP 1 created_at FROM AutomationRunLog
        WHERE automation_key = 'receive_orders'
        ORDER BY id DESC
      `.catch(() => ({ recordset: [] }));

      if (lastRunResult.recordset.length) {
        const lastRun = new Date(lastRunResult.recordset[0].created_at);
        const minutesSinceLastRun = (Date.now() - lastRun.getTime()) / 60000;
        if (minutesSinceLastRun < intervalMinutes) return;
      }

      const result = await runAutoDelivery(context);
      context.log('autoDeliveryTimer:', result.message || result.reason || JSON.stringify(result));
    } catch (error) {
      context.error('Erro no timer de auto-delivery:', error);
    }
  },
});
