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

const COLUMNS = [
  'notiforders',
  'notifsellers',
  'notiffiscaldocuments',
  'notifstock',
  'notifsuppliers',
  'notifpurchases',
  'notifdeliveries',
  'notifclients',
];

app.http('notification-settings', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT TOP 1
            notiforders, notifsellers, notiffiscaldocuments, notifstock,
            notifsuppliers, notifpurchases, notifdeliveries, notifclients,
            updatedat
          FROM notificationsettings
          ORDER BY id ASC
        `;

        if (result.recordset.length === 0) {
          return { status: 404, jsonBody: { error: 'No config found' } };
        }

        const row = result.recordset[0];
        return {
          jsonBody: {
            notifOrders:          !!row.notiforders,
            notifSellers:         !!row.notifsellers,
            notifFiscalDocuments: !!row.notiffiscaldocuments,
            notifStock:           !!row.notifstock,
            notifSuppliers:       !!row.notifsuppliers,
            notifPurchases:       !!row.notifpurchases,
            notifDeliveries:      !!row.notifdeliveries,
            notifClients:         !!row.notifclients,
            updatedAt:            row.updatedat,
          },
        };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();

        // Whitelist prevents SQL injection; only known columns are accepted
        const entries = Object.entries(body)
          .map(([k, v]) => [k.toLowerCase(), v])
          .filter(([k]) => COLUMNS.includes(k));

        if (entries.length === 0) return { jsonBody: { ok: true } };

        const exists = await sql.query`SELECT TOP 1 id FROM notificationsettings ORDER BY id ASC`;
        if (exists.recordset.length === 0) return { status: 404, jsonBody: { error: 'No config found' } };

        const req = new sql.Request();
        req.input('id', sql.Int, exists.recordset[0].id);

        const setParts = entries.map(([col, val]) => {
          req.input(col, sql.Bit, val ? 1 : 0);
          return `${col} = @${col}`;
        });

        await req.query(`UPDATE notificationsettings SET ${setParts.join(', ')}, updatedat = GETUTCDATE() WHERE id = @id`);

        return { jsonBody: { ok: true } };
      }
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
