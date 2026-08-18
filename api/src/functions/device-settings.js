'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server:   process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user:     process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options:  { encrypt: true, trustServerCertificate: false },
};

const ALLOWED = ['defaultprinter', 'defaultthermalprinter'];

async function ensureTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DeviceSettings')
    BEGIN
      CREATE TABLE DeviceSettings (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        defaultPrinter       NVARCHAR(255) NULL,
        defaultThermalPrinter NVARCHAR(255) NULL,
        updatedAt            DATETIME2     NOT NULL DEFAULT GETUTCDATE()
      );
      INSERT INTO DeviceSettings (defaultPrinter, defaultThermalPrinter) VALUES (NULL, NULL);
    END
  `);
}

app.http('device-settings', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const pool = await sql.connect(sqlConfig);
      await ensureTable(pool);

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT TOP 1 defaultPrinter, defaultThermalPrinter, updatedAt
          FROM DeviceSettings ORDER BY id ASC
        `;
        if (result.recordset.length === 0) {
          return { jsonBody: { defaultPrinter: null, defaultThermalPrinter: null } };
        }
        const row = result.recordset[0];
        return {
          jsonBody: {
            defaultPrinter:        row.defaultPrinter        || null,
            defaultThermalPrinter: row.defaultThermalPrinter || null,
            updatedAt:             row.updatedAt,
          },
        };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();

        // Whitelist prevents SQL injection; only known columns are accepted
        const fieldMap = {
          defaultPrinter:        (v) => ({ col: 'defaultPrinter',        type: sql.NVarChar(255), val: String(v) }),
          defaultThermalPrinter: (v) => ({ col: 'defaultThermalPrinter', type: sql.NVarChar(255), val: String(v) }),
        };

        const entries = Object.entries(body).filter(([k]) => fieldMap[k]);
        if (entries.length === 0) return { jsonBody: { ok: true } };

        const exists = await sql.query`SELECT TOP 1 id FROM DeviceSettings ORDER BY id ASC`;
        if (exists.recordset.length === 0) return { status: 404, jsonBody: { error: 'No config found' } };

        const req = new sql.Request();
        req.input('id', sql.Int, exists.recordset[0].id);

        const setParts = entries.map(([key, val]) => {
          const { col, type, val: mapped } = fieldMap[key](val);
          req.input(col, type, mapped);
          return `${col} = @${col}`;
        });

        await req.query(`UPDATE DeviceSettings SET ${setParts.join(', ')}, updatedAt = GETUTCDATE() WHERE id = @id`);
        return { jsonBody: { ok: true } };
      }
    } catch (err) {
      context.error('device-settings error:', err);
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  },
});
