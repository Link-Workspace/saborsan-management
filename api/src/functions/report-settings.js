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

app.http('report-settings', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      // Ensure new columns exist (idempotent)
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportSettings') AND name = 'recipientName')
          ALTER TABLE ReportSettings ADD recipientName NVARCHAR(100) NULL
      `.catch(() => {});
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportSettings') AND name = 'lastSentAt')
          ALTER TABLE ReportSettings ADD lastSentAt DATETIME NULL
      `.catch(() => {});

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT TOP 1
            email, whatsapp, recipientName, frequency, sendDay, sendTime,
            inclVendas, inclEstoque, inclFinanceiro, inclEntregas,
            lastSentAt, updatedAt
          FROM ReportSettings
          ORDER BY id ASC
        `;

        if (result.recordset.length === 0) {
          return { status: 404, jsonBody: { error: 'No config found' } };
        }

        const row = result.recordset[0];
        return {
          jsonBody: {
            relatorioEmail:      row.email          || '',
            relatorioWhatsapp:   row.whatsapp        || '',
            relatorioNome:       row.recipientName   || '',
            relatorioFreq:       row.frequency      || 'desativado',
            relatorioDia:        row.sendDay         || '1',
            relatorioHora:       row.sendTime        || '08:00',
            relatorioVendas:     !!row.inclVendas,
            relatorioEstoque:    !!row.inclEstoque,
            relatorioFinanceiro: !!row.inclFinanceiro,
            relatorioEntregas:   !!row.inclEntregas,
            lastSentAt:          row.lastSentAt      || null,
            updatedAt:           row.updatedAt,
          },
        };
      }

      if (request.method === 'PATCH') {
        const body = await request.json();

        // Whitelist prevents SQL injection; only known columns are accepted
        const fieldMap = {
          relatorioEmail:      (v) => ({ col: 'email',          type: sql.NVarChar(255),    val: String(v)        }),
          relatorioWhatsapp:   (v) => ({ col: 'whatsapp',       type: sql.NVarChar(20),     val: String(v)        }),
          relatorioNome:       (v) => ({ col: 'recipientName',  type: sql.NVarChar(100),    val: String(v)        }),
          relatorioFreq:       (v) => ({ col: 'frequency',      type: sql.NVarChar(20),     val: String(v)        }),
          relatorioDia:        (v) => ({ col: 'sendDay',        type: sql.NVarChar(5),      val: String(v)        }),
          relatorioHora:       (v) => ({ col: 'sendTime',       type: sql.NVarChar(10),     val: String(v)        }),
          relatorioVendas:     (v) => ({ col: 'inclVendas',     type: sql.Bit,              val: v ? 1 : 0        }),
          relatorioEstoque:    (v) => ({ col: 'inclEstoque',    type: sql.Bit,              val: v ? 1 : 0        }),
          relatorioFinanceiro: (v) => ({ col: 'inclFinanceiro', type: sql.Bit,              val: v ? 1 : 0        }),
          relatorioEntregas:   (v) => ({ col: 'inclEntregas',   type: sql.Bit,              val: v ? 1 : 0        }),
        };

        const entries = Object.entries(body).filter(([k]) => fieldMap[k]);
        if (entries.length === 0) return { jsonBody: { ok: true } };

        const exists = await sql.query`SELECT TOP 1 id FROM ReportSettings ORDER BY id ASC`;
        if (exists.recordset.length === 0) return { status: 404, jsonBody: { error: 'No config found' } };

        const req = new sql.Request();
        req.input('id', sql.Int, exists.recordset[0].id);

        const setParts = entries.map(([key, val]) => {
          const { col, type, val: mapped } = fieldMap[key](val);
          req.input(col, type, mapped);
          return `${col} = @${col}`;
        });

        await req.query(`UPDATE ReportSettings SET ${setParts.join(', ')}, updatedAt = GETUTCDATE() WHERE id = @id`);

        return { jsonBody: { ok: true } };
      }
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
