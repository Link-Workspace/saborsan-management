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

let _pool = null;
async function getPool() {
  if (!_pool || !_pool.connected) {
    _pool = await new sql.ConnectionPool(sqlConfig).connect();
  }
  return _pool;
}

// ── Clientes ──────────────────────────────────────────────────────────────────

async function handleClient(raw, pool) {
  const items = Array.isArray(raw) ? raw : [raw];
  const created = [], updated = [], errors = [];

  for (const data of items) {
    const {
      establishmentName, clientName, cnpj, cpf, contactNumber,
      address, city, segment, priority, priorityReason, tag,
      invoicePreference, bestDay, purchasePurpose,
    } = data;

    if (!establishmentName?.trim()) { errors.push({ error: 'establishmentName é obrigatório.', data }); continue; }
    if (!clientName?.trim())        { errors.push({ error: 'clientName é obrigatório.', data }); continue; }

    const cnpjNorm = cnpj ? cnpj.replace(/\D/g, '') : null;

    // Upsert: localiza pelo CNPJ normalizado ou pelo nome do estabelecimento
    const existing = cnpjNorm
      ? await pool.request().query`
          SELECT id FROM Clients
          WHERE cnpjNormalized = ${cnpjNorm} OR establishmentName = ${establishmentName.trim()}
        `
      : await pool.request().query`
          SELECT id FROM Clients WHERE establishmentName = ${establishmentName.trim()}
        `;

    if (existing.recordset.length > 0) {
      const id = existing.recordset[0].id;
      await pool.request().query`
        UPDATE Clients SET
          clientName        = ${clientName.trim()},
          cnpj              = ${cnpj || null},
          cnpjNormalized    = ${cnpjNorm},
          cpf               = ${cpf || null},
          contactNumber     = ${contactNumber || null},
          address           = ${address || null},
          city              = ${city || null},
          segment           = ${segment || null},
          priority          = ${priority || 'Media'},
          priorityReason    = ${priorityReason || null},
          tag               = ${tag || null},
          invoicePreference = ${invoicePreference || null},
          bestDay           = ${bestDay || null},
          purchasePurpose   = ${purchasePurpose || null}
        WHERE id = ${id}
      `;
      updated.push({ id, establishmentName: establishmentName.trim() });
    } else {
      const result = await pool.request().query`
        INSERT INTO Clients (
          cityId, establishmentName, clientName, cnpj, cnpjNormalized, cpf,
          contactNumber, address, city, segment, priority, priorityReason,
          tag, invoicePreference, bestDay, purchasePurpose
        )
        OUTPUT INSERTED.id
        VALUES (
          1,
          ${establishmentName.trim()},
          ${clientName.trim()},
          ${cnpj || null},
          ${cnpjNorm},
          ${cpf || null},
          ${contactNumber || null},
          ${address || null},
          ${city || null},
          ${segment || null},
          ${priority || 'Media'},
          ${priorityReason || null},
          ${tag || null},
          ${invoicePreference || null},
          ${bestDay || null},
          ${purchasePurpose || null}
        )
      `;
      created.push({ id: result.recordset[0].id, establishmentName: establishmentName.trim() });
    }
  }

  return { created, updated, errors };
}

// ── Pagamentos ────────────────────────────────────────────────────────────────

async function handlePayment(raw, pool) {
  const items = Array.isArray(raw) ? raw : [raw];
  const created = [], errors = [];

  for (const data of items) {
    const { clientName, sellerName, paymentMethod, paymentValue, totalPaid, paymentDate, orderId, status } = data;

    if (!clientName?.trim())                                     { errors.push({ error: 'clientName é obrigatório.', data }); continue; }
    if (!sellerName?.trim())                                     { errors.push({ error: 'sellerName é obrigatório.', data }); continue; }
    if (!paymentMethod?.trim())                                  { errors.push({ error: 'paymentMethod é obrigatório.', data }); continue; }
    if (paymentValue == null || isNaN(parseFloat(paymentValue))) { errors.push({ error: 'paymentValue inválido.', data }); continue; }

    // Aceita DD/MM/YYYY ou ISO (YYYY-MM-DD / YYYY-MM-DDTHH:mm:ssZ)
    let parsedDate = null;
    if (paymentDate) {
      parsedDate = /^\d{2}\/\d{2}\/\d{4}$/.test(paymentDate)
        ? (() => { const [d, m, y] = paymentDate.split('/'); return new Date(`${y}-${m}-${d}`); })()
        : new Date(paymentDate);
    }
    if (!parsedDate || isNaN(parsedDate.getTime())) parsedDate = new Date();

    const result = await pool.request().query`
      INSERT INTO Payments (clientName, orderId, sellerName, paymentDate, paymentMethod, paymentValue, totalPaid, status, createdAt)
      OUTPUT INSERTED.id
      VALUES (
        ${clientName.trim()},
        ${orderId || null},
        ${sellerName.trim()},
        ${parsedDate},
        ${paymentMethod.trim()},
        ${parseFloat(paymentValue)},
        ${parseFloat(totalPaid) || 0},
        ${status || 'Pendente'},
        GETUTCDATE()
      )
    `;
    created.push({ id: result.recordset[0].id, clientName: clientName.trim() });
  }

  return { created, errors };
}

// ── Produtos / Estoque ────────────────────────────────────────────────────────

async function handleProduct(raw, pool) {
  const items = Array.isArray(raw) ? raw : [raw];
  const created = [], updated = [], errors = [];

  const existingResult = await pool.request().query`SELECT id, name FROM Products WHERE active = 1`;
  const existingMap = new Map(existingResult.recordset.map((r) => [r.name.trim().toLowerCase(), r.id]));

  for (const item of items) {
    const {
      name, category, price, availableQuantity, badge, description,
      details, packaging, unitQuantity, packagingWeight, conservation,
      preparation, idealFor, imageUrl, group, subGroup,
    } = item;

    if (!name?.trim() || !category?.trim()) {
      errors.push({ name: name || '?', error: 'name e category são obrigatórios.' });
      continue;
    }

    const qty = parseInt(availableQuantity ?? 0, 10);
    const existingId = existingMap.get(name.trim().toLowerCase());

    if (existingId) {
      await pool.request().query`
        UPDATE Products SET
          category          = ${category.trim()},
          price             = ${String(price ?? '0')},
          badge             = ${badge || null},
          description       = ${description || null},
          details           = ${details || null},
          packaging         = ${packaging || null},
          unitQuantity      = ${unitQuantity != null ? parseInt(unitQuantity, 10) : null},
          packagingWeight   = ${packagingWeight != null ? parseFloat(packagingWeight) : null},
          conservation      = ${conservation || null},
          preparation       = ${preparation || null},
          idealFor          = ${idealFor || null},
          availableQuantity = ${qty},
          productGroup      = ${group || null},
          subGroup          = ${subGroup || null},
          updatedAt         = GETUTCDATE()
        WHERE id = ${existingId}
      `;
      updated.push({ id: existingId, name: name.trim() });
    } else {
      const id = `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await pool.request().query`
        INSERT INTO Products (
          id, name, category, price, badge, description, details,
          packaging, unitQuantity, packagingWeight, conservation, preparation, idealFor,
          availableQuantity, imageUrl, active, productGroup, subGroup, createdAt, updatedAt
        )
        VALUES (
          ${id}, ${name.trim()}, ${category.trim()}, ${String(price ?? '0')},
          ${badge || null}, ${description || null}, ${details || null},
          ${packaging || null}, ${unitQuantity != null ? parseInt(unitQuantity, 10) : null},
          ${packagingWeight != null ? parseFloat(packagingWeight) : null},
          ${conservation || null}, ${preparation || null}, ${idealFor || null},
          ${qty}, ${imageUrl || null},
          1, ${group || null}, ${subGroup || null}, GETUTCDATE(), GETUTCDATE()
        )
      `;
      created.push({ id, name: name.trim() });
    }
  }

  return { created, updated, errors };
}

// ── Atualização de estoque avulsa ─────────────────────────────────────────────

async function handleStock(raw, pool) {
  const items = Array.isArray(raw) ? raw : [raw];
  const updated = [], errors = [];

  for (const item of items) {
    const { name, availableQuantity } = item;
    if (!name?.trim()) { errors.push({ error: 'name é obrigatório.', item }); continue; }
    if (availableQuantity == null || isNaN(parseInt(availableQuantity, 10))) {
      errors.push({ error: 'availableQuantity inválido.', item }); continue;
    }

    const result = await pool.request().query`
      UPDATE Products SET availableQuantity = ${parseInt(availableQuantity, 10)}, updatedAt = GETUTCDATE()
      WHERE name = ${name.trim()} AND active = 1
    `;
    if (result.rowsAffected[0] === 0) {
      errors.push({ error: `Produto "${name.trim()}" não encontrado.`, item });
    } else {
      updated.push({ name: name.trim(), availableQuantity: parseInt(availableQuantity, 10) });
    }
  }

  return { updated, errors };
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

app.http('bridge', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bridge',
  handler: async (request) => {
    // Verifica chave de API quando configurada
    const apiKey = process.env.BRIDGE_API_KEY;
    if (apiKey) {
      const provided = request.headers.get('x-api-key')
        ?? new URL(request.url).searchParams.get('apiKey');
      if (provided !== apiKey) {
        return { status: 401, jsonBody: { error: 'Chave de API inválida ou ausente.' } };
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Body JSON inválido.' } };
    }

    const { type, data } = body;
    if (!type)      return { status: 400, jsonBody: { error: 'Campo "type" é obrigatório. Valores aceitos: client, payment, product, stock.' } };
    if (data == null) return { status: 400, jsonBody: { error: 'Campo "data" é obrigatório.' } };

    const pool = await getPool();

    let result;
    switch (type) {
      case 'client':
        result = await handleClient(data, pool);
        break;
      case 'payment':
        result = await handlePayment(data, pool);
        break;
      case 'product':
        result = await handleProduct(data, pool);
        break;
      case 'stock':
        result = await handleStock(data, pool);
        break;
      default:
        return { status: 400, jsonBody: { error: `Tipo desconhecido: "${type}". Use: client, payment, product, stock.` } };
    }

    const hasErrors = result.errors?.length > 0;
    const status = hasErrors && !result.created?.length && !result.updated?.length ? 422 : 200;
    return { status, jsonBody: { ok: true, type, result } };
  },
});
