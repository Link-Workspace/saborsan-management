const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

app.http('deliveries', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
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
          const doResult = await sql.query`SELECT delivery_id, order_code FROM DeliveryOrders`;
          deliveryOrderRows = doResult.recordset;
        } catch (e) { context.warn('DeliveryOrders query:', e.message); }

        const progressMap = { 'Planejada': 0, 'Carregando': 25, 'Em rota': 60, 'Concluída': 100, 'Cancelada': 0 };

        const deliveries = deliveriesResult.recordset.map((d) => {
          const orderIds = deliveryOrderRows
            .filter((o) => o.delivery_id === d.id)
            .map((o) => o.order_code);
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
        const statusVal = status || 'Carregando';
        const stopsCount = stops || 0;
        const notesVal = notes || '';
        const departureDateVal = departureDate ? new Date(departureDate) : null;
        const arrivalDateVal = arrivalDate ? new Date(arrivalDate) : null;

        const insertResult = await sql.query`
          INSERT INTO Deliveries (code, route, seller_id, status, cold_chamber_number, stops_count, temperature, departure_date, arrival_date, notes, updated_at)
          OUTPUT INSERTED.id
          VALUES (${code}, ${route}, ${sellerId}, ${statusVal}, ${chamberNum}, ${stopsCount}, ${tempVal}, ${departureDateVal}, ${arrivalDateVal}, ${notesVal}, GETUTCDATE())
        `;

        const newId = insertResult.recordset[0].id;

        if (Array.isArray(orderIds) && orderIds.length > 0) {
          for (const orderId of orderIds) {
            await sql.query`INSERT INTO DeliveryOrders (delivery_id, order_code) VALUES (${newId}, ${orderId})`;
          }
        }

        return { status: 201, jsonBody: { success: true, code, id: newId } };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();
        const { deliveryId, status, route, sellerId, vehicle, temperature, departureDate, arrivalDate, notes, stops, orderIds, fullUpdate } = body;

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
                status = ${status},
                cold_chamber_number = ${chamberNum},
                stops_count = ${stops || 0},
                temperature = ${tempVal},
                departure_date = ${departureDateVal},
                arrival_date = ${arrivalDateVal},
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
                await sql.query`INSERT INTO DeliveryOrders (delivery_id, order_code) VALUES (${dbId}, ${orderId})`;
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
    } finally {
      await sql.close();
    }
  },
});
