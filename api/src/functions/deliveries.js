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
  methods: ['PATCH'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

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
    } catch (error) {
      context.error('Erro na função deliveries:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    } finally {
      await sql.close();
    }
  },
});
