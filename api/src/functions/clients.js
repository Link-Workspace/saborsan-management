'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

// Dedicated pool so sql.close() from other functions doesn't affect this module
let _pool = null;
async function getPool() {
  if (!_pool || !_pool.connected) {
    _pool = await new sql.ConnectionPool(sqlConfig).connect();
  }
  return _pool;
}

function formatDaysSince(days) {
  if (days == null) return null;
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return `${days} dias atrás`;
}

let _columnsEnsured = false;

async function ensureClientColumns() {
  if (_columnsEnsured) return;
  const pool = await getPool();
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'city')
      ALTER TABLE Clients ADD city NVARCHAR(100) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'cnpjNormalized')
      ALTER TABLE Clients ADD cnpjNormalized NVARCHAR(14) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'stateRegistration')
      ALTER TABLE Clients ADD stateRegistration NVARCHAR(30) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'stateRegistrationIndicator')
      ALTER TABLE Clients ADD stateRegistrationIndicator TINYINT NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'stateRegistrationUF')
      ALTER TABLE Clients ADD stateRegistrationUF NVARCHAR(2) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'stateRegistrationStatus')
      ALTER TABLE Clients ADD stateRegistrationStatus NVARCHAR(50) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'lastFiscalLookupAt')
      ALTER TABLE Clients ADD lastFiscalLookupAt DATETIME2 NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'lastFiscalLookupSuccessAt')
      ALTER TABLE Clients ADD lastFiscalLookupSuccessAt DATETIME2 NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'nextFiscalLookupAt')
      ALTER TABLE Clients ADD nextFiscalLookupAt DATETIME2 NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'fiscalLookupSource')
      ALTER TABLE Clients ADD fiscalLookupSource NVARCHAR(50) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'lastFiscalLookupError')
      ALTER TABLE Clients ADD lastFiscalLookupError NVARCHAR(500) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'requiresFiscalReview')
      ALTER TABLE Clients ADD requiresFiscalReview BIT NOT NULL DEFAULT 0
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'fiscalLookupResponseJson')
      ALTER TABLE Clients ADD fiscalLookupResponseJson NVARCHAR(MAX) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'purchasePurpose')
      ALTER TABLE Clients ADD purchasePurpose NVARCHAR(20) NULL
  `;
  // Ensure dedicated cnpj and cpf columns; migrate old values stored in documentType
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'cnpj')
      ALTER TABLE Clients ADD cnpj NVARCHAR(20) NULL
  `;
  await pool.request().query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Clients') AND name = 'cpf')
      ALTER TABLE Clients ADD cpf NVARCHAR(14) NULL
  `;
  // One-time migration: copy values from legacy documentType column → dedicated cnpj/cpf columns
  await pool.request().query`
    UPDATE Clients SET cnpj = documentType
    WHERE cnpj IS NULL AND documentType IS NOT NULL
      AND documentType NOT IN ('cnpj', 'cpf')
      AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(documentType, '.',''),'/',''),'-',''),' ','')) = 14
  `;
  await pool.request().query`
    UPDATE Clients SET cpf = documentType
    WHERE cpf IS NULL AND documentType IS NOT NULL
      AND documentType NOT IN ('cnpj', 'cpf')
      AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(documentType, '.',''),'/',''),'-',''),' ','')) = 11
  `;
  _columnsEnsured = true;
}

app.http('clients', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const pool = await getPool();
      try { await ensureClientColumns(); } catch (_) {}

      // ─── GET ────────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        const result = await pool.request().query`
          SELECT
            c.id,
            c.establishmentName,
            c.segment,
            c.priority,
            c.priorityReason,
            c.tag,
            (
              SELECT TOP 1 DATEDIFF(day, o.createdAt, GETUTCDATE())
              FROM GestaoOrders o
              WHERE o.deletedAt IS NULL
                AND (o.clientId = c.id OR o.clientName = c.establishmentName)
              ORDER BY o.createdAt DESC
            ) AS daysSinceLastPurchase,
            c.lastValue,
            c.avgTicket,
            c.suggestion,
            c.pendency,
            c.bestDay,
            c.clientName,
            c.address          AS clientAddress,
            c.contactNumber,
            c.cnpj             AS clientCnpj,
            c.cpf              AS clientCpf,
            c.city             AS clientCity,
            c.invoicePreference AS clientInvoicePreference,
            c.purchasePurpose   AS clientPurchasePurpose,
            c.stateRegistrationIndicator,
            c.stateRegistration,
            c.stateRegistrationUF,
            c.stateRegistrationStatus,
            c.lastFiscalLookupAt,
            c.nextFiscalLookupAt,
            c.requiresFiscalReview,
            u.id               AS userId,
            u.email,
            u.whatsapp,
            u.cnpj             AS userCnpj,
            u.city             AS userCity,
            u.name             AS userName,
            u.address          AS userAddress,
            u.invoicePreference AS userInvoicePreference,
            CASE WHEN EXISTS (
              SELECT 1 FROM GestaoOrders o
              WHERE o.deletedAt IS NULL
                AND o.status <> N'Entregue'
                AND (o.clientId = c.id OR o.clientName = c.establishmentName)
            ) THEN 1 ELSE 0 END AS hasActiveOrders
          FROM Clients c
          LEFT JOIN Users u
            ON u.establishmentName = c.establishmentName
            AND u.isCompany = 1
          ORDER BY c.establishmentName ASC
        `;

        const clients = result.recordset.map((c) => ({
          id: c.id,
          userId: c.userId || null,
          establishmentName: c.establishmentName || '',
          clientName: c.clientName || c.userName || '',
          segment: c.segment || '',
          priority: c.priority || 'Media',
          priorityReason: c.priorityReason || '',
          tag: c.tag || '',
          lastPurchase: formatDaysSince(c.daysSinceLastPurchase != null ? c.daysSinceLastPurchase : null),
          daysSinceLastPurchase: c.daysSinceLastPurchase != null ? c.daysSinceLastPurchase : null,
          lastValue: c.lastValue != null ? parseFloat(c.lastValue) : null,
          avgTicket: c.avgTicket != null ? parseFloat(c.avgTicket) : null,
          suggestion: c.suggestion || '',
          pendency: c.pendency || '',
          bestDay: c.bestDay || '',
          address: c.clientAddress || c.userAddress || '',
          contactNumber: c.contactNumber || c.whatsapp || '',
          invoicePreference: c.clientInvoicePreference || c.userInvoicePreference || '',
          purchasePurpose: c.clientPurchasePurpose || 'consumo',
          email: c.email || '',
          cnpj: c.clientCnpj || c.userCnpj || '',
          cpf: c.clientCpf || '',
          city: c.clientCity || c.userCity || '',
          stateRegistrationIndicator: c.stateRegistrationIndicator ?? null,
          stateRegistration: c.stateRegistration || null,
          stateRegistrationUF: c.stateRegistrationUF || null,
          stateRegistrationStatus: c.stateRegistrationStatus || null,
          lastFiscalLookupAt: c.lastFiscalLookupAt ? c.lastFiscalLookupAt.toISOString() : null,
          nextFiscalLookupAt: c.nextFiscalLookupAt ? c.nextFiscalLookupAt.toISOString() : null,
          requiresFiscalReview: !!c.requiresFiscalReview,
          hasActiveOrders: !!c.hasActiveOrders,
        }));

        return { jsonBody: { clients } };
      }

      // ─── POST ───────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const {
          establishmentName, clientName, email, password,
          cnpj, cpf, contactNumber, address, city,
          segment, priority, priorityReason, tag,
          invoicePreference, bestDay, purchasePurpose,
        } = body;
        if (!establishmentName?.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do estabelecimento é obrigatório.' } };
        }
        if (!clientName?.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do responsável é obrigatório.' } };
        }

        let userId = null;

        // Create User account only when both email and password are provided
        if (email?.trim() && password && password.length >= 6) {
          const existing = await pool.request().query`
            SELECT id FROM Users WHERE email = ${email.trim().toLowerCase()}
          `;
          if (existing.recordset.length > 0) {
            return { status: 409, jsonBody: { error: 'Já existe um usuário com este e-mail.' } };
          }

          const passwordHash = await bcrypt.hash(password, 10);
          const userResult = await pool.request().query`
            INSERT INTO Users (
              email, passwordHash, name, whatsapp, isCompany, cnpj,
              role, createdAt, address, establishmentName, invoicePreference, city
            )
            OUTPUT INSERTED.id
            VALUES (
              ${email.trim().toLowerCase()},
              ${passwordHash},
              ${clientName.trim()},
              ${contactNumber || null},
              1,
              ${cnpj || null},
              'client',
              GETUTCDATE(),
              ${address || null},
              ${establishmentName.trim()},
              ${invoicePreference || null},
              ${city || null}
            )
          `;
          userId = userResult.recordset[0].id;
        }

        // Insert into Clients
        // cityId defaults to 1 (generic city) when not provided — required by schema
        const clientResult = await pool.request().query`
          INSERT INTO Clients (
            cityId, establishmentName, segment, priority, priorityReason,
            tag, clientName, address, contactNumber, invoicePreference, bestDay,
            cnpj, cpf, city, purchasePurpose
          )
          OUTPUT INSERTED.id
          VALUES (
            1,
            ${establishmentName.trim()},
            ${segment || null},
            ${priority || 'Media'},
            ${priorityReason || null},
            ${tag || null},
            ${clientName.trim()},
            ${address || null},
            ${contactNumber || null},
            ${invoicePreference || null},
            ${bestDay || null},
            ${cnpj || null},
            ${cpf || null},
            ${city || null},
            ${purchasePurpose || null}
          )
        `;

        const clientId = clientResult.recordset[0].id;

        return {
          status: 201,
          jsonBody: {
            client: {
              id: clientId,
              userId,
              establishmentName: establishmentName.trim(),
              clientName: clientName.trim(),
              segment: segment || '',
              priority: priority || 'Media',
              priorityReason: priorityReason || '',
              tag: tag || '',
              lastPurchase: null,
              lastValue: null,
              avgTicket: null,
              suggestion: '',
              pendency: '',
              bestDay: bestDay || '',
              address: address || '',
              contactNumber: contactNumber || '',
              invoicePreference: invoicePreference || '',
              purchasePurpose: purchasePurpose || 'consumo',
              email: email?.trim().toLowerCase() || '',
              cnpj: cnpj || '',
              cpf: cpf || '',
              city: city || '',
              indicadorIE: null,
              inscricaoEstadual: null,
              requerRevisaoFiscal: false,
            },
          },
        };
      }

      // ─── PUT ────────────────────────────────────────────────────────────────
      if (request.method === 'PUT') {
        const body = await request.json();
        const {
          id, userId,
          establishmentName, clientName, email,
          cnpj, cpf, contactNumber, address, city,
          segment, priority, priorityReason, tag,
          invoicePreference, bestDay, purchasePurpose,
        } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'ID do cliente é obrigatório.' } };
        }

        await pool.request().query`
          UPDATE Clients SET
            establishmentName = ${establishmentName || null},
            segment           = ${segment || null},
            priority          = ${priority || null},
            priorityReason    = ${priorityReason || null},
            tag               = ${tag || null},
            clientName        = ${clientName || null},
            address           = ${address || null},
            contactNumber     = ${contactNumber || null},
            invoicePreference = ${invoicePreference || null},
            bestDay           = ${bestDay || null},
            cnpj              = ${cnpj || null},
            cpf               = ${cpf || null},
            city              = ${city || null},
            purchasePurpose   = ${purchasePurpose || null}
          WHERE id = ${id}
        `;

        if (userId) {
          await pool.request().query`
            UPDATE Users SET
              name              = ${clientName || null},
              whatsapp          = ${contactNumber || null},
              cnpj              = ${cnpj || null},
              address           = ${address || null},
              city              = ${city || null},
              establishmentName = ${establishmentName || null},
              invoicePreference = ${invoicePreference || null}
            WHERE id = ${userId}
          `;
        }

        // Propaga CNPJ, cidade e telefone para todos os pedidos deste cliente
        await pool.request().query`
          UPDATE GestaoOrders
          SET clientCnpj  = ${cnpj || null},
              clientCity  = ${city || null},
              clientPhone = ${contactNumber || null},
              updatedAt   = GETUTCDATE()
          WHERE clientName = ${establishmentName || null}
        `;

        return { jsonBody: { success: true } };
      }

      // ─── DELETE ─────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id, userId } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'ID do cliente é obrigatório.' } };
        }

        // Remove dependent rows before the parent to satisfy FK constraints
        await pool.request().query`DELETE FROM ClientProducts WHERE clientId = ${id}`;
        await pool.request().query`DELETE FROM ClientOrders WHERE clientId = ${id}`;
        await pool.request().query`DELETE FROM ClientReactivationLog WHERE client_id = ${id}`;
        await pool.request().query`DELETE FROM Clients WHERE id = ${id}`;

        // Remove linked User only when no other Clients share the same establishment
        if (userId) {
          const remaining = await pool.request().query`
            SELECT c.id
            FROM Clients c
            INNER JOIN Users u
              ON u.establishmentName = c.establishmentName
              AND u.isCompany = 1
            WHERE u.id = ${userId}
          `;
          if (remaining.recordset.length === 0) {
            await pool.request().query`DELETE FROM Users WHERE id = ${userId} AND role = 'client'`;
          }
        }

        return { jsonBody: { success: true } };
      }

      return { status: 405, jsonBody: { error: 'Método não permitido.' } };
    } catch (err) {
      context.error('clients error:', err);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
    }
  },
});
