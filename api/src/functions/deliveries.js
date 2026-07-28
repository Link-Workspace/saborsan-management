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
  methods: ['GET', 'PATCH', 'DELETE'],
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

      if (request.method === 'PATCH') {
        const body = await request.json();
        const { deliveryId, status } = body;

        if (!deliveryId) {
          return { status: 400, jsonBody: { error: 'deliveryId é obrigatório' } };
        }

        if (status !== undefined) {
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
