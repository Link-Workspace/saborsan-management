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

async function ensureTable() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Suppliers'
    )
    BEGIN
      CREATE TABLE Suppliers (
        id             INT IDENTITY(1,1)  PRIMARY KEY,
        name           NVARCHAR(150)      NOT NULL,
        foodTypes      NVARCHAR(500)      NULL,
        contactName    NVARCHAR(150)      NULL,
        contactPhone   NVARCHAR(30)       NULL,
        address        NVARCHAR(300)      NULL,
        leadTimeDays   INT                NULL,
        active         BIT                NOT NULL DEFAULT 1,
        createdAt      DATETIME2          NOT NULL DEFAULT GETUTCDATE(),
        updatedAt      DATETIME2          NOT NULL DEFAULT GETUTCDATE()
      )
    END
  `;
}

app.http('suppliers', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTable();

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT id, name, foodTypes, contactName, contactPhone, address, leadTimeDays
          FROM Suppliers
          WHERE active = 1
          ORDER BY name ASC
        `;
        return {
          jsonBody: {
            suppliers: result.recordset.map((s) => ({
              id: s.id,
              name: s.name || '',
              foodTypes: s.foodTypes || '',
              contactName: s.contactName || '',
              contactPhone: s.contactPhone || '',
              address: s.address || '',
              leadTimeDays: s.leadTimeDays != null ? s.leadTimeDays : null,
            })),
          },
        };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { name, foodTypes, contactName, contactPhone, address, leadTimeDays } = body;

        if (!name?.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do fornecedor é obrigatório.' } };
        }

        const result = await sql.query`
          INSERT INTO Suppliers (name, foodTypes, contactName, contactPhone, address, leadTimeDays)
          OUTPUT INSERTED.id
          VALUES (
            ${name.trim()},
            ${foodTypes || null},
            ${contactName || null},
            ${contactPhone || null},
            ${address || null},
            ${leadTimeDays != null ? parseInt(leadTimeDays, 10) : null}
          )
        `;

        const id = result.recordset[0].id;
        return {
          status: 201,
          jsonBody: {
            supplier: {
              id,
              name: name.trim(),
              foodTypes: foodTypes || '',
              contactName: contactName || '',
              contactPhone: contactPhone || '',
              address: address || '',
              leadTimeDays: leadTimeDays != null ? parseInt(leadTimeDays, 10) : null,
            },
          },
        };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const { id, name, foodTypes, contactName, contactPhone, address, leadTimeDays } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'ID do fornecedor é obrigatório.' } };
        }

        if (!name?.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do fornecedor é obrigatório.' } };
        }

        await sql.query`
          UPDATE Suppliers
          SET name         = ${name.trim()},
              foodTypes    = ${foodTypes || null},
              contactName  = ${contactName || null},
              contactPhone = ${contactPhone || null},
              address      = ${address || null},
              leadTimeDays = ${leadTimeDays != null ? parseInt(leadTimeDays, 10) : null},
              updatedAt    = GETUTCDATE()
          WHERE id = ${id}
        `;

        return { jsonBody: { updated: true } };
      }

      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'ID do fornecedor é obrigatório.' } };
        }

        await sql.query`UPDATE Suppliers SET active = 0, updatedAt = GETUTCDATE() WHERE id = ${id}`;

        return { jsonBody: { deleted: true } };
      }

      return { status: 405, jsonBody: { error: 'Método não permitido.' } };
    } catch (err) {
      context.error('Erro na função suppliers:', err);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
    }
  },
});
