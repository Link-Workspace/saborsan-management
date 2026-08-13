const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

app.http('products', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT id, name, category, price, badge, description, details,
                 packaging, unitQuantity, packagingWeight, conservation, preparation, idealFor,
                 availableQuantity, imageUrl, active, productGroup, subGroup, createdAt, updatedAt
          FROM Products
          WHERE active = 1
          ORDER BY name ASC
        `;

        const products = result.recordset.map((p) => ({
          id: p.id,
          name: p.name || '',
          category: p.category || '',
          price: parseFloat(p.price) || 0,
          badge: p.badge || null,
          description: p.description || null,
          details: p.details || null,
          packaging: p.packaging || null,
          unitQuantity: p.unitQuantity != null ? p.unitQuantity : null,
          packagingWeight: p.packagingWeight != null ? parseFloat(p.packagingWeight) : null,
          conservation: p.conservation || null,
          preparation: p.preparation || null,
          idealFor: p.idealFor || null,
          stock: p.availableQuantity || 0,
          image: p.imageUrl || null,
          unit: p.packaging || '',
          temperature: p.conservation || '',
          active: p.active,          productGroup: p.productGroup || null,
          subGroup: p.subGroup || null,        }));

        return { jsonBody: { products } };
      }

      if (request.method === 'POST') {
        const body = await request.json();

        // Bulk import: { products: [...] }
        const items = Array.isArray(body.products) ? body.products : [body];

        if (!items.length) {
          return { status: 400, jsonBody: { error: 'Nenhum produto enviado.' } };
        }

        const created = [];
        const updated = [];
        const errors = [];

        // Busca todos os nomes existentes para detecção de duplicatas
        const existingResult = await sql.query`SELECT id, name FROM Products WHERE active = 1`;
        const existingMap = new Map(
          existingResult.recordset.map((r) => [r.name.trim().toLowerCase(), r.id])
        );

        for (const item of items) {
          const { name, category, price, availableQuantity, badge, description,
                  details, packaging, unitQuantity, packagingWeight, conservation, preparation, idealFor, imageUrl,
                  group, subGroup } = item;
          const productGroup = group || null;

          if (!name || !name.trim() || !category || !category.trim()) {
            errors.push({ name: name || '?', error: 'Nome e categoria são obrigatórios.' });
            continue;
          }

          const priceStr = String(price ?? '0');
          const qty = parseInt(availableQuantity ?? 0, 10);
          const existingId = existingMap.get(name.trim().toLowerCase());

          if (existingId) {
            // Produto já existe — atualiza apenas os campos presentes no documento
            await sql.query`
              UPDATE Products
              SET category = ${category.trim()},
                  price = ${priceStr},
                  badge = ${badge || null},
                  description = ${description || null},
                  details = ${details || null},
                  packaging = ${packaging || null},
                  unitQuantity = ${unitQuantity != null ? parseInt(unitQuantity, 10) : null},
                  packagingWeight = ${packagingWeight != null ? parseFloat(packagingWeight) : null},
                  conservation = ${conservation || null},
                  preparation = ${preparation || null},
                  idealFor = ${idealFor || null},
                  productGroup = ${productGroup},
                  subGroup = ${subGroup || null},
                  updatedAt = GETUTCDATE()
              WHERE id = ${existingId}
            `;
            updated.push({ id: existingId, name: name.trim() });
          } else {
            const id = `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
            await sql.query`
              INSERT INTO Products (id, name, category, price, badge, description, details,
                                    packaging, unitQuantity, packagingWeight, conservation, preparation, idealFor,
                                    availableQuantity, imageUrl, active, productGroup, subGroup, createdAt, updatedAt)
              VALUES (${id}, ${name.trim()}, ${category.trim()}, ${priceStr},
                      ${badge || null}, ${description || null}, ${details || null},
                      ${packaging || null}, ${unitQuantity != null ? parseInt(unitQuantity, 10) : null},
                      ${packagingWeight != null ? parseFloat(packagingWeight) : null},
                      ${conservation || null}, ${preparation || null}, ${idealFor || null},
                      ${qty}, ${imageUrl || null},
                      1, ${productGroup}, ${subGroup || null}, GETUTCDATE(), GETUTCDATE())
            `;
            created.push({ id, name: name.trim(), category: category.trim() });
          }
        }

        return { jsonBody: { created, updated, errors } };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const { id, name, category, price, availableQuantity, packaging, unitQuantity, packagingWeight, conservation,
                description, details, preparation, idealFor, badge, imageUrl, group, subGroup } = body;
        const productGroup = group || null;

        if (!id || !name?.trim() || !category?.trim()) {
          return { status: 400, jsonBody: { error: 'id, nome e categoria são obrigatórios.' } };
        }

        await sql.query`
          UPDATE Products
          SET name = ${name.trim()},
              category = ${category.trim()},
              price = ${String(price ?? '0')},
              badge = ${badge || null},
              description = ${description || null},
              details = ${details || null},
              packaging = ${packaging || null},
              unitQuantity = ${unitQuantity != null ? parseInt(unitQuantity, 10) : null},
              packagingWeight = ${packagingWeight != null ? parseFloat(packagingWeight) : null},
              conservation = ${conservation || null},
              preparation = ${preparation || null},
              idealFor = ${idealFor || null},
              availableQuantity = ${parseInt(availableQuantity ?? 0, 10)},
              imageUrl = ${imageUrl || null},
              productGroup = ${productGroup},
              subGroup = ${subGroup || null},
              updatedAt = GETUTCDATE()
          WHERE id = ${id}
        `;

        return { jsonBody: { updated: true } };
      }

      if (request.method === 'DELETE') {
        const body = await request.json();
        const { productId } = body;

        if (!productId) {
          return { status: 400, jsonBody: { error: 'productId é obrigatório.' } };
        }

        await sql.query`
          UPDATE Products SET active = 0, updatedAt = GETUTCDATE() WHERE id = ${productId}
        `;

        return { jsonBody: { deleted: true } };
      }
    } catch (err) {
      context.error('products error:', err);
      return { status: 500, jsonBody: { error: 'Erro ao processar produtos.' } };
    }
  },
});

