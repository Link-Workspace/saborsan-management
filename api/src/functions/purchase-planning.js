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
      WHERE TABLE_NAME = 'PurchasePlanningItems'
    )
    BEGIN
      CREATE TABLE PurchasePlanningItems (
        id            INT           IDENTITY(1,1) NOT NULL,
        title         NVARCHAR(255) NOT NULL,
        scheduledDate DATE          NOT NULL,
        completed     BIT           NOT NULL DEFAULT 0,
        completedAt   DATETIME2     NULL,
        notes         NVARCHAR(500) NULL,
        createdAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        updatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT PK_PurchasePlanningItems PRIMARY KEY CLUSTERED (id ASC)
      );

      CREATE NONCLUSTERED INDEX IX_PurchasePlanningItems_ScheduledDate
        ON PurchasePlanningItems (scheduledDate)
        INCLUDE (title, completed);
    END
  `;
  // Migration: link back to SupplierPurchases for cascade delete
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PurchasePlanningItems') AND name = 'supplier_purchase_id')
      ALTER TABLE PurchasePlanningItems ADD supplier_purchase_id INT NULL
  `.catch(() => {});
}

function mapItem(row) {
  return {
    id: row.id,
    title: row.title,
    scheduledDate: row.scheduledDate instanceof Date
      ? row.scheduledDate.toISOString().split('T')[0]
      : String(row.scheduledDate).split('T')[0],
    completed: !!row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    notes: row.notes || '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

app.http('purchase-planning', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTable();

      // ── GET ───────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT id, title, scheduledDate, completed, completedAt, notes, createdAt, updatedAt
          FROM PurchasePlanningItems
          ORDER BY scheduledDate ASC, createdAt ASC
        `;
        return {
          jsonBody: { items: result.recordset.map(mapItem) },
        };
      }

      // ── POST ──────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const { title, scheduledDate, notes } = body;

        if (!title || !scheduledDate) {
          return { status: 400, jsonBody: { error: 'title e scheduledDate são obrigatórios.' } };
        }

        const dateVal = new Date(scheduledDate);
        if (isNaN(dateVal.getTime())) {
          return { status: 400, jsonBody: { error: 'scheduledDate inválida.' } };
        }

        const result = await sql.query`
          INSERT INTO PurchasePlanningItems (title, scheduledDate, notes)
          OUTPUT INSERTED.*
          VALUES (${title.trim()}, ${dateVal}, ${notes || null})
        `;
        return {
          status: 201,
          jsonBody: { item: mapItem(result.recordset[0]) },
        };
      }

      // ── PATCH ─────────────────────────────────────────────────────────────
      if (request.method === 'PATCH') {
        const body = await request.json();
        const { id, completed, title, scheduledDate, notes } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'id é obrigatório.' } };
        }

        if (completed !== undefined) {
          const completedAt = completed ? new Date() : null;
          await sql.query`
            UPDATE PurchasePlanningItems
            SET completed    = ${completed ? 1 : 0},
                completedAt  = ${completedAt},
                updatedAt    = GETUTCDATE()
            WHERE id = ${id}
          `;
          return { jsonBody: { ok: true } };
        }

        if (!title || !scheduledDate) {
          return { status: 400, jsonBody: { error: 'title e scheduledDate são obrigatórios para atualização.' } };
        }
        const dateVal = new Date(scheduledDate);
        if (isNaN(dateVal.getTime())) {
          return { status: 400, jsonBody: { error: 'scheduledDate inválida.' } };
        }
        const result = await sql.query`
          UPDATE PurchasePlanningItems
          SET title         = ${title.trim()},
              scheduledDate = ${dateVal},
              notes         = ${notes || null},
              updatedAt     = GETUTCDATE()
          OUTPUT INSERTED.*
          WHERE id = ${id}
        `;
        if (!result.recordset.length) {
          return { status: 404, jsonBody: { error: 'Item não encontrado.' } };
        }
        return { jsonBody: { item: mapItem(result.recordset[0]) } };
      }

      // ── DELETE ────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'id é obrigatório.' } };
        }

        const linkRow = await sql.query`
          SELECT supplier_purchase_id FROM PurchasePlanningItems WHERE id = ${id}
        `.catch(() => ({ recordset: [] }));
        const linkedPurchaseId = linkRow.recordset[0]?.supplier_purchase_id ?? null;

        await sql.query`DELETE FROM PurchasePlanningItems WHERE id = ${id}`;

        if (linkedPurchaseId) {
          await sql.query`DELETE FROM SupplierPurchases WHERE id = ${linkedPurchaseId}`.catch(() => {});
        }

        return { jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: 'Método não suportado.' } };
    } catch (err) {
      context.error('Erro na função purchase-planning:', err);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
    }
  },
});
