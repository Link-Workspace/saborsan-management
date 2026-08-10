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

app.http('sellers', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      // Ensure isActive column exists
      try {
        await sql.query`IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Sellers') AND name = 'isActive') ALTER TABLE Sellers ADD isActive BIT NOT NULL DEFAULT 1`;
      } catch (e) { context.warn('Migration isActive:', e.message); }

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT s.id, u.name, u.whatsapp AS phone, s.city, s.dailyGoal, s.soldToday,
                 ISNULL(s.isActive, 1) AS isActive
          FROM Sellers s
          INNER JOIN Users u ON s.userId = u.id
          ORDER BY u.name ASC
        `;
        const sellersData = result.recordset.map((s) => ({
          id: s.id,
          name: s.name || '',
          phone: s.phone || '',
          region: s.city || '',
          avatar: (s.name || 'V')[0].toUpperCase(),
          status: s.isActive === false || s.isActive === 0 ? 'Inativo' : 'Ativo',
          meta: Number(s.dailyGoal) || 0,
          total: Number(s.soldToday) || 0,
          sales: [],
        }));
        return { jsonBody: { sellers: sellersData } };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const { sellerId, isActive, name, whatsapp, city, dailyGoal } = body;

        if (!sellerId) {
          return { status: 400, jsonBody: { error: 'ID do vendedor é obrigatório.' } };
        }

        const sellerRow = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
        if (!sellerRow.recordset.length) {
          return { status: 404, jsonBody: { error: 'Vendedor não encontrado.' } };
        }
        const userId = sellerRow.recordset[0].userId;

        if (isActive !== undefined) {
          await sql.query`UPDATE Sellers SET isActive = ${isActive ? 1 : 0} WHERE id = ${sellerId}`;
        }

        if (name !== undefined) {
          await sql.query`UPDATE Users SET name = ${name.trim()}, whatsapp = ${whatsapp || null} WHERE id = ${userId}`;
          await sql.query`UPDATE Sellers SET city = ${city.trim()}, dailyGoal = ${dailyGoal != null ? Number(dailyGoal) : 0} WHERE id = ${sellerId}`;
        }

        return { jsonBody: { success: true } };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { name, email, whatsapp, password, city, dailyGoal } = body;

        if (!name || !name.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do vendedor é obrigatório.' } };
        }
        if (!email || !email.trim()) {
          return { status: 400, jsonBody: { error: 'E-mail é obrigatório.' } };
        }
        if (!password || password.length < 6) {
          return { status: 400, jsonBody: { error: 'Senha deve ter no mínimo 6 caracteres.' } };
        }
        if (!city || !city.trim()) {
          return { status: 400, jsonBody: { error: 'Cidade é obrigatória.' } };
        }

        const existing = await sql.query`
          SELECT id FROM Users WHERE email = ${email.trim().toLowerCase()}
        `;
        if (existing.recordset.length > 0) {
          return { status: 409, jsonBody: { error: 'Já existe um usuário com este e-mail.' } };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const userResult = await sql.query`
          INSERT INTO Users (email, passwordHash, name, whatsapp, isCompany, role, createdAt)
          OUTPUT INSERTED.id
          VALUES (
            ${email.trim().toLowerCase()},
            ${passwordHash},
            ${name.trim()},
            ${whatsapp || null},
            0,
            'seller',
            GETUTCDATE()
          )
        `;
        const userId = userResult.recordset[0].id;

        const sellerResult = await sql.query`
          INSERT INTO Sellers (userId, city, dailyGoal, soldToday, routeDate)
          OUTPUT INSERTED.id
          VALUES (
            ${userId},
            ${city.trim()},
            ${dailyGoal != null ? Number(dailyGoal) : 0},
            0,
            CAST(GETUTCDATE() AS DATE)
          )
        `;
        const sellerId = sellerResult.recordset[0].id;

        return {
          status: 201,
          jsonBody: {
            seller: {
              id: sellerId,
              name: name.trim(),
              phone: whatsapp || '',
              region: city.trim(),
              avatar: name.trim()[0].toUpperCase(),
              status: 'Ativo',
              meta: Number(dailyGoal) || 0,
              total: 0,
              sales: [],
            },
          },
        };
      }

      return { status: 405, jsonBody: { error: 'Método não permitido.' } };
    } catch (error) {
      context.error('Erro na função sellers:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
    } finally {
      await sql.close();
    }
  },
});
