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

// Table must already exist — created/renamed via migration query
app.http('stock-purchase-config', {
  methods: ['GET', 'PUT', 'PATCH'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT TOP 1
            stockAlertPct, iaWhatsapp, iaPrompt,
            purchaseSchedules, whatsappNumbers,
            iaLigarModo, iaLigarDia, iaLigarHora,
            updatedAt
          FROM StockSupplierConfig
          ORDER BY id ASC
        `;

        if (result.recordset.length === 0) {
          return { status: 404, jsonBody: { error: 'No config found' } };
        }

        const row = result.recordset[0];
        return {
          jsonBody: {
            stockAlertPct:     row.stockAlertPct,
            iaWhatsapp:        !!row.iaWhatsapp,
            iaPrompt:          row.iaPrompt || '',
            purchaseSchedules: row.purchaseSchedules ? JSON.parse(row.purchaseSchedules) : [],
            whatsappNumbers:   row.whatsappNumbers   ? JSON.parse(row.whatsappNumbers)   : [],
            iaLigarModo:       row.iaLigarModo || 'ia',
            iaLigarDia:        row.iaLigarDia  || 'segunda',
            iaLigarHora:       row.iaLigarHora || '09:00',
            updatedAt:         row.updatedAt,
          },
        };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const {
          stockAlertPct,
          iaWhatsapp,
          iaPrompt,
          purchaseSchedules,
          whatsappNumbers,
          iaLigarModo,
          iaLigarDia,
          iaLigarHora,
        } = body;

        const schedJson = JSON.stringify(Array.isArray(purchaseSchedules) ? purchaseSchedules : []);
        const numsJson  = JSON.stringify(Array.isArray(whatsappNumbers)   ? whatsappNumbers   : []);

        const exists = await sql.query`
          SELECT TOP 1 id FROM StockSupplierConfig ORDER BY id ASC
        `;

        if (exists.recordset.length === 0) {
          await sql.query`
            INSERT INTO StockSupplierConfig
              (stockAlertPct, iaWhatsapp, iaPrompt, purchaseSchedules, whatsappNumbers,
               iaLigarModo, iaLigarDia, iaLigarHora, updatedAt)
            VALUES
              (${stockAlertPct}, ${iaWhatsapp ? 1 : 0}, ${iaPrompt},
               ${schedJson}, ${numsJson},
               ${iaLigarModo || 'ia'}, ${iaLigarDia || 'segunda'}, ${iaLigarHora || '09:00'},
               GETUTCDATE())
          `;
        } else {
          const id = exists.recordset[0].id;
          await sql.query`
            UPDATE StockSupplierConfig SET
              stockAlertPct     = ${stockAlertPct},
              iaWhatsapp        = ${iaWhatsapp ? 1 : 0},
              iaPrompt          = ${iaPrompt},
              purchaseSchedules = ${schedJson},
              whatsappNumbers   = ${numsJson},
              iaLigarModo       = ${iaLigarModo || 'ia'},
              iaLigarDia        = ${iaLigarDia  || 'segunda'},
              iaLigarHora       = ${iaLigarHora || '09:00'},
              updatedAt         = GETUTCDATE()
            WHERE id = ${id}
          `;
        }

        return { jsonBody: { ok: true } };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();

        // Whitelist prevents SQL injection; only known columns are accepted
        const fieldMap = {
          stockAlertPct:     (v) => ({ type: sql.Decimal(10, 4),     val: parseFloat(v) || 0 }),
          iaWhatsapp:        (v) => ({ type: sql.Bit,                val: v ? 1 : 0 }),
          iaPrompt:          (v) => ({ type: sql.NVarChar(sql.MAX),  val: String(v) }),
          purchaseSchedules: (v) => ({ type: sql.NVarChar(sql.MAX),  val: JSON.stringify(Array.isArray(v) ? v : []) }),
          whatsappNumbers:   (v) => ({ type: sql.NVarChar(sql.MAX),  val: JSON.stringify(Array.isArray(v) ? v : []) }),
          iaLigarModo:       (v) => ({ type: sql.NVarChar(20),       val: String(v) }),
          iaLigarDia:        (v) => ({ type: sql.NVarChar(20),       val: String(v) }),
          iaLigarHora:       (v) => ({ type: sql.NVarChar(10),       val: String(v) }),
        };

        const entries = Object.entries(body).filter(([k]) => fieldMap[k]);
        if (entries.length === 0) return { jsonBody: { ok: true } };

        const exists = await sql.query`SELECT TOP 1 id FROM StockSupplierConfig ORDER BY id ASC`;
        if (exists.recordset.length === 0) return { status: 404, jsonBody: { error: 'No config found' } };

        const req = new sql.Request();
        req.input('id', sql.Int, exists.recordset[0].id);

        const setParts = entries.map(([col, val]) => {
          const { type, val: mapped } = fieldMap[col](val);
          req.input(col, type, mapped);
          return `${col} = @${col}`;
        });

        await req.query(`UPDATE StockSupplierConfig SET ${setParts.join(', ')}, updatedAt = GETUTCDATE() WHERE id = @id`);

        return { jsonBody: { ok: true } };
      }
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
