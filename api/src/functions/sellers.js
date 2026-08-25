const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db');

app.http('sellers', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      // Ensure isActive column exists
      try {
        await pool.request().query`IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Sellers') AND name = 'isActive') ALTER TABLE Sellers ADD isActive BIT NOT NULL DEFAULT 1`;
      } catch (e) { context.warn('Migration isActive:', e.message); }

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const sellerIdParam = url.searchParams.get('sellerId');

        if (sellerIdParam) {
          const sellerId = parseInt(sellerIdParam, 10);
          if (!sellerId) return { status: 400, jsonBody: { error: 'sellerId inválido' } };

          const statusConcluida = 'Concluída';

          const ordersResult = await pool.request().query`
            SELECT
              o.id AS orderId,
              o.clientName,
              o.clientCity,
              CAST(o.totalValue AS FLOAT) AS totalValue,
              o.createdAt,
              d.code AS deliveryCode,
              d.arrival_date AS arrivalDate
            FROM GestaoOrders o
            INNER JOIN DeliveryOrders dor ON dor.order_id = o.id
            INNER JOIN Deliveries d ON d.id = dor.delivery_id
            WHERE d.seller_id = ${sellerId} AND d.status = ${statusConcluida}
            ORDER BY d.arrival_date DESC, o.id ASC
          `;

          context.log(`sellers deliveries: sellerId=${sellerId} found=${ordersResult.recordset.length} orders`);

          const itemsResult = await pool.request().query`
            SELECT oi.orderId, oi.productName, oi.quantity, oi.unit
            FROM GestaoOrderItems oi
            INNER JOIN DeliveryOrders dor ON dor.order_id = oi.orderId
            INNER JOIN Deliveries d ON d.id = dor.delivery_id
            WHERE d.seller_id = ${sellerId} AND d.status = ${statusConcluida}
            ORDER BY oi.id ASC
          `.catch((e) => { context.warn('sellers items query:', e.message); return { recordset: [] }; });

          const paymentsResult = await pool.request().query`
            SELECT p.orderId, SUM(p.paymentValue) AS totalPaid
            FROM Payments p
            WHERE EXISTS (
              SELECT 1 FROM DeliveryOrders dor
              INNER JOIN Deliveries d ON d.id = dor.delivery_id
              WHERE dor.order_id = p.orderId
                AND d.seller_id = ${sellerId}
                AND d.status = ${statusConcluida}
            )
            GROUP BY p.orderId
          `.catch((e) => { context.warn('sellers payments query:', e.message); return { recordset: [] }; });

          const itemsByOrder = {};
          for (const item of itemsResult.recordset) {
            if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
            itemsByOrder[item.orderId].push({ name: item.productName, qty: item.quantity, unit: item.unit });
          }

          const paymentsByOrder = {};
          for (const p of paymentsResult.recordset) {
            paymentsByOrder[p.orderId] = parseFloat(p.totalPaid);
          }

          const sales = ordersResult.recordset.map((o) => ({
            id: o.orderId,
            customer: o.clientName || '',
            city: o.clientCity || '',
            products: itemsByOrder[o.orderId] || [],
            payment: paymentsByOrder[o.orderId] != null ? paymentsByOrder[o.orderId] : null,
            date: o.arrivalDate
              ? new Date(o.arrivalDate).toLocaleDateString('pt-BR')
              : o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '',
            value: Number(o.totalValue) || 0,
            deliveryCode: o.deliveryCode,
          }));

          return { jsonBody: { sales } };
        }

        const result = await pool.request().query`
          SELECT s.id, u.name, u.whatsapp AS phone, s.city, s.dailyGoal,
                 ISNULL(s.isActive, 1) AS isActive,
                 ISNULL((
                   SELECT SUM(CAST(o.totalValue AS FLOAT))
                   FROM GestaoOrders o
                   INNER JOIN DeliveryOrders dor ON dor.order_id = o.id
                   INNER JOIN Deliveries d ON d.id = dor.delivery_id
                   WHERE d.seller_id = s.id AND d.status = 'Concluída'
                 ), 0) AS totalVendas,
                 ISNULL((
                   SELECT COUNT(DISTINCT o.id)
                   FROM GestaoOrders o
                   INNER JOIN DeliveryOrders dor ON dor.order_id = o.id
                   INNER JOIN Deliveries d ON d.id = dor.delivery_id
                   WHERE d.seller_id = s.id AND d.status = 'Concluída'
                 ), 0) AS totalOrders,
                 ISNULL((SELECT COUNT(*) FROM Deliveries WHERE seller_id = s.id AND status = 'Concluída'), 0) AS totalDeliveries
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
          total: Number(s.totalVendas) || 0,
          sales: Array(Number(s.totalOrders) || 0).fill(null),
          deliveriesCount: Number(s.totalDeliveries) || 0,
        }));
        return { jsonBody: { sellers: sellersData } };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const { sellerId, isActive, name, whatsapp, city, dailyGoal } = body;

        if (!sellerId) {
          return { status: 400, jsonBody: { error: 'ID do vendedor é obrigatório.' } };
        }

        const sellerRow = await pool.request().query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
        if (!sellerRow.recordset.length) {
          return { status: 404, jsonBody: { error: 'Vendedor não encontrado.' } };
        }
        const userId = sellerRow.recordset[0].userId;

        if (isActive !== undefined) {
          await pool.request().query`UPDATE Sellers SET isActive = ${isActive ? 1 : 0} WHERE id = ${sellerId}`;
        }

        if (name !== undefined) {
          await pool.request().query`UPDATE Users SET name = ${name.trim()}, whatsapp = ${whatsapp || null} WHERE id = ${userId}`;
          await pool.request().query`UPDATE Sellers SET city = ${city.trim()}, dailyGoal = ${dailyGoal != null ? Number(dailyGoal) : 0} WHERE id = ${sellerId}`;
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

        const existing = await pool.request().query`
          SELECT id FROM Users WHERE email = ${email.trim().toLowerCase()}
        `;
        if (existing.recordset.length > 0) {
          return { status: 409, jsonBody: { error: 'Já existe um usuário com este e-mail.' } };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const userResult = await pool.request().query`
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

        const sellerResult = await pool.request().query`
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
    }
  },
});
