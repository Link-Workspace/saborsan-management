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
      WHERE TABLE_NAME = 'SupplierPurchases'
    )
    BEGIN
      CREATE TABLE SupplierPurchases (
        id                    INT IDENTITY(1,1) PRIMARY KEY,
        supplierId            INT           NOT NULL,
        purchaseName          NVARCHAR(200) NOT NULL,
        description           NVARCHAR(500) NULL,
        quantity              DECIMAL(10,2) NOT NULL,
        totalAmount           DECIMAL(10,2) NULL,
        scheduledPurchaseDate DATETIME2     NULL,
        completedAt           DATETIME2     NULL,
        status                NVARCHAR(50)  NOT NULL,
        notes                 NVARCHAR(500) NULL,
        createdAt             DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        updatedAt             DATETIME2     NOT NULL DEFAULT GETUTCDATE()
      )
    END
  `;
}

app.http('supplier-purchases', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTable();

      // ── GET ───────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        const supplierId = request.query.get('supplierId');

        let result;
        if (supplierId) {
          const id = parseInt(supplierId, 10);
          if (isNaN(id)) {
            return { status: 400, jsonBody: { error: 'supplierId inválido.' } };
          }
          result = await sql.query`
            SELECT id, supplierId, purchaseName, description, quantity, totalAmount,
                   scheduledPurchaseDate, completedAt, status, notes, createdAt, updatedAt
            FROM SupplierPurchases
            WHERE supplierId = ${id}
            ORDER BY createdAt DESC
          `;
        } else {
          result = await sql.query`
            SELECT id, supplierId, purchaseName, description, quantity, totalAmount,
                   scheduledPurchaseDate, completedAt, status, notes, createdAt, updatedAt
            FROM SupplierPurchases
            ORDER BY createdAt DESC
          `;
        }

        return {
          jsonBody: {
            purchases: result.recordset.map((p) => ({
              id: p.id,
              supplierId: p.supplierId,
              purchaseName: p.purchaseName,
              description: p.description || '',
              quantity: typeof p.quantity === 'object' ? parseFloat(p.quantity) : p.quantity,
              totalAmount: p.totalAmount != null ? (typeof p.totalAmount === 'object' ? parseFloat(p.totalAmount) : p.totalAmount) : null,
              scheduledPurchaseDate: p.scheduledPurchaseDate ? p.scheduledPurchaseDate.toISOString() : null,
              completedAt: p.completedAt ? p.completedAt.toISOString() : null,
              status: p.status,
              notes: p.notes || '',
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString(),
            })),
          },
        };
      }

      // ── POST — create a new supplier purchase ─────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const {
          supplierId, purchaseName, description, quantity,
          totalAmount, scheduledPurchaseDate, status, notes,
        } = body;

        if (!supplierId || !purchaseName || quantity == null) {
          return { status: 400, jsonBody: { error: 'supplierId, purchaseName e quantity são obrigatórios.' } };
        }

        const sid = parseInt(supplierId, 10);
        if (isNaN(sid)) {
          return { status: 400, jsonBody: { error: 'supplierId inválido.' } };
        }

        const qty = parseFloat(quantity);
        const total = totalAmount != null ? parseFloat(totalAmount) : null;
        const schedDate = scheduledPurchaseDate ? new Date(scheduledPurchaseDate) : null;
        const purchaseStatus = status || 'pending';

        const result = await sql.query`
          INSERT INTO SupplierPurchases
            (supplierId, purchaseName, description, quantity, totalAmount,
             scheduledPurchaseDate, status, notes)
          OUTPUT INSERTED.*
          VALUES
            (${sid}, ${purchaseName.trim()}, ${description || null}, ${qty},
             ${total}, ${schedDate}, ${purchaseStatus}, ${notes || null})
        `;

        const p = result.recordset[0];
        return {
          status: 201,
          jsonBody: {
            purchase: {
              id: p.id,
              supplierId: p.supplierId,
              purchaseName: p.purchaseName,
              description: p.description || '',
              quantity: typeof p.quantity === 'object' ? parseFloat(p.quantity) : p.quantity,
              totalAmount: p.totalAmount != null ? (typeof p.totalAmount === 'object' ? parseFloat(p.totalAmount) : p.totalAmount) : null,
              scheduledPurchaseDate: p.scheduledPurchaseDate ? p.scheduledPurchaseDate.toISOString() : null,
              completedAt: null,
              status: p.status,
              notes: p.notes || '',
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString(),
            },
          },
        };
      }

      // ── DELETE ────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'id é obrigatório.' } };
        }

        await sql.query`DELETE FROM SupplierPurchases WHERE id = ${id}`;
        return { jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: 'Método não suportado.' } };
    } catch (err) {
      context.error('Erro na função supplier-purchases:', err);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
    }
  },
});
