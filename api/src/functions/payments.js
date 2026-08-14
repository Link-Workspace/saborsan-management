'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

let _pool = null;
async function getPool() {
  if (!_pool || !_pool.connected) {
    _pool = await new sql.ConnectionPool(sqlConfig).connect();
  }
  return _pool;
}

app.http('payments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'payments',
  handler: async (request) => {
    const pool = await getPool();

    // ─── GET ────────────────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const result = await pool.request().query`
        SELECT
          id,
          clientName,
          orderId,
          sellerName,
          CONVERT(VARCHAR(10), paymentDate, 103) AS paymentDate,
          paymentMethod,
          paymentValue,
          totalPaid,
          status,
          createdAt
        FROM Payments
        ORDER BY createdAt DESC
      `;

      const payments = result.recordset.map((p) => ({
        id: `PAG-${String(p.id).padStart(3, '0')}`,
        dbId: p.id,
        clientName: p.clientName,
        orderId: p.orderId || '',
        sellerName: p.sellerName,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        paymentValue: parseFloat(p.paymentValue),
        totalPaid: parseFloat(p.totalPaid),
        status: p.status,
      }));

      return { jsonBody: { payments } };
    }

    // ─── POST ────────────────────────────────────────────────────────────────
    if (request.method === 'POST') {
      const body = await request.json();
      const { clientName, orderId, sellerName, paymentDate, paymentMethod, paymentValue, totalPaid, status } = body;

      if (!clientName?.trim()) {
        return { status: 400, jsonBody: { error: 'Nome do cliente é obrigatório.' } };
      }
      if (!sellerName?.trim()) {
        return { status: 400, jsonBody: { error: 'Nome do vendedor é obrigatório.' } };
      }
      if (!paymentMethod?.trim()) {
        return { status: 400, jsonBody: { error: 'Forma de pagamento é obrigatória.' } };
      }
      if (paymentValue == null || isNaN(parseFloat(paymentValue))) {
        return { status: 400, jsonBody: { error: 'Valor do pagamento inválido.' } };
      }

      // Parse paymentDate from DD/MM/YYYY to a Date SQL can accept
      let parsedDate = null;
      if (paymentDate) {
        const parts = paymentDate.split('/');
        if (parts.length === 3) {
          parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }

      const insertResult = await pool.request().query`
        INSERT INTO Payments (clientName, orderId, sellerName, paymentDate, paymentMethod, paymentValue, totalPaid, status, createdAt)
        OUTPUT INSERTED.id
        VALUES (
          ${clientName.trim()},
          ${orderId || null},
          ${sellerName.trim()},
          ${parsedDate},
          ${paymentMethod.trim()},
          ${parseFloat(paymentValue)},
          ${parseFloat(totalPaid) || 0},
          ${status || 'Pendente'},
          GETUTCDATE()
        )
      `;

      const newId = insertResult.recordset[0].id;

      return {
        status: 201,
        jsonBody: {
          payment: {
            id: `PAG-${String(newId).padStart(3, '0')}`,
            dbId: newId,
            clientName: clientName.trim(),
            orderId: orderId || '',
            sellerName: sellerName.trim(),
            paymentDate: paymentDate || new Date().toLocaleDateString('pt-BR'),
            paymentMethod: paymentMethod.trim(),
            paymentValue: parseFloat(paymentValue),
            totalPaid: parseFloat(totalPaid) || 0,
            status: status || 'Pendente',
          },
        },
      };
    }

    return { status: 405, jsonBody: { error: 'Método não permitido.' } };
  },
});
