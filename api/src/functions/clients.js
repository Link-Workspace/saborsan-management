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

app.http('clients', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      // ─── GET ────────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT
            c.id,
            c.establishmentName,
            c.segment,
            c.priority,
            c.priorityReason,
            c.tag,
            c.lastPurchase,
            c.lastValue,
            c.avgTicket,
            c.suggestion,
            c.pendency,
            c.bestDay,
            c.clientName,
            c.address          AS clientAddress,
            c.contactNumber,
            c.invoicePreference AS clientInvoicePreference,
            u.id               AS userId,
            u.email,
            u.whatsapp,
            u.cnpj,
            u.city,
            u.name             AS userName,
            u.address          AS userAddress,
            u.invoicePreference AS userInvoicePreference
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
          lastPurchase: c.lastPurchase || null,
          lastValue: c.lastValue != null ? parseFloat(c.lastValue) : null,
          avgTicket: c.avgTicket != null ? parseFloat(c.avgTicket) : null,
          suggestion: c.suggestion || '',
          pendency: c.pendency || '',
          bestDay: c.bestDay || '',
          address: c.clientAddress || c.userAddress || '',
          contactNumber: c.contactNumber || c.whatsapp || '',
          invoicePreference: c.clientInvoicePreference || c.userInvoicePreference || '',
          email: c.email || '',
          cnpj: c.cnpj || '',
          city: c.city || '',
        }));

        return { jsonBody: { clients } };
      }

      // ─── POST ───────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const {
          establishmentName, clientName, email, password,
          cnpj, contactNumber, address, city,
          segment, priority, priorityReason, tag,
          invoicePreference, bestDay,
        } = body;

        if (!establishmentName?.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do estabelecimento é obrigatório.' } };
        }
        if (!clientName?.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do responsável é obrigatório.' } };
        }

        let userId = null;

        // Create User account if email is provided
        if (email?.trim()) {
          if (!password || password.length < 6) {
            return { status: 400, jsonBody: { error: 'Senha deve ter no mínimo 6 caracteres para acesso ao app.' } };
          }

          const existing = await sql.query`
            SELECT id FROM Users WHERE email = ${email.trim().toLowerCase()}
          `;
          if (existing.recordset.length > 0) {
            return { status: 409, jsonBody: { error: 'Já existe um usuário com este e-mail.' } };
          }

          const passwordHash = await bcrypt.hash(password, 10);
          const userResult = await sql.query`
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
        const clientResult = await sql.query`
          INSERT INTO Clients (
            cityId, establishmentName, segment, priority, priorityReason,
            tag, clientName, address, contactNumber, invoicePreference, bestDay
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
            ${bestDay || null}
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
              email: email?.trim().toLowerCase() || '',
              cnpj: cnpj || '',
              city: city || '',
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
          cnpj, contactNumber, address, city,
          segment, priority, priorityReason, tag,
          invoicePreference, bestDay,
        } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'ID do cliente é obrigatório.' } };
        }

        await sql.query`
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
            bestDay           = ${bestDay || null}
          WHERE id = ${id}
        `;

        if (userId) {
          await sql.query`
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

        return { jsonBody: { success: true } };
      }

      // ─── DELETE ─────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id, userId } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'ID do cliente é obrigatório.' } };
        }

        await sql.query`DELETE FROM Clients WHERE id = ${id}`;

        // Remove linked User only when no other Clients share the same establishment
        if (userId) {
          const remaining = await sql.query`
            SELECT c.id
            FROM Clients c
            INNER JOIN Users u
              ON u.establishmentName = c.establishmentName
              AND u.isCompany = 1
            WHERE u.id = ${userId}
          `;
          if (remaining.recordset.length === 0) {
            await sql.query`DELETE FROM Users WHERE id = ${userId} AND role = 'client'`;
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
