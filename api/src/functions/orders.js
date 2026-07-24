const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

function formatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDelivery(deliveryAt, status) {
  if (!deliveryAt) return 'A confirmar';
  if (status === 'Entregue') return 'Entregue';
  const d = new Date(deliveryAt);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje, ${timeStr}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${timeStr}`;
}

app.http('orders', {
  methods: ['GET', 'PATCH', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const [ordersResult, itemsResult, nfeResult] = await Promise.all([
          sql.query`
            SELECT id, source, clientName, clientCnpj, clientCity, clientPhone,
                   status, totalValue, deliveryAt, observations, createdAt
            FROM GestaoOrders
            ORDER BY createdAt DESC
          `,
          sql.query`
            SELECT orderId, productName, quantity, unit, unitPrice
            FROM GestaoOrderItems
            ORDER BY id ASC
          `,
          sql.query`
            SELECT orderId, focusReference, nfeNumber, nfeSeries, accessKey, protocol
            FROM GestaoFiscalDocuments
            WHERE status = 'AUTHORIZED'
          `.catch(() => ({ recordset: [] })),
        ]);

        const nfeByOrder = {};
        for (const doc of nfeResult.recordset) {
          nfeByOrder[doc.orderId] = {
            reference: doc.focusReference,
            number: doc.nfeNumber,
            series: doc.nfeSeries,
            accessKey: doc.accessKey,
            protocol: doc.protocol,
          };
        }

        const orders = ordersResult.recordset.map((o) => ({
          id: o.id,
          source: o.source,
          customer: o.clientName,
          cnpj: o.clientCnpj || '',
          city: o.clientCity || '',
          whatsapp: o.clientPhone || '',
          value: Number(o.totalValue),
          status: o.status,
          priority: 'Normal',
          time: formatTime(new Date(o.createdAt)),
          delivery: formatDelivery(o.deliveryAt, o.status),
          products: itemsResult.recordset
            .filter((i) => i.orderId === o.id)
            .map((i) => ({
              name: i.productName,
              qty: i.quantity,
              unit: i.unit,
              price: Number(i.unitPrice || 0),
            })),
          notes: o.observations || '',
          ...(nfeByOrder[o.id] ? { nfeData: nfeByOrder[o.id] } : {}),
        }));

        return { jsonBody: { orders } };
      }

      if (request.method === 'PATCH') {
        const { orderId, status } = await request.json();
        if (!orderId || !status) {
          return { status: 400, jsonBody: { error: 'orderId e status são obrigatórios' } };
        }

        await sql.query`
          UPDATE GestaoOrders
          SET status = ${status}, updatedAt = GETUTCDATE()
          WHERE id = ${orderId}
        `;

        return { jsonBody: { success: true } };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { source, clientName, clientCnpj, clientCity, clientPhone, totalValue, observations, items } = body;

        if (!clientName || !items || items.length === 0) {
          return { status: 400, jsonBody: { error: 'clientName e items são obrigatórios' } };
        }

        const idResult = await sql.query`
          SELECT ISNULL(MAX(CAST(SUBSTRING(id, 5, LEN(id)) AS INT)), 2000) + 1 AS nextNum
          FROM GestaoOrders
          WHERE id LIKE 'PED-%' AND ISNUMERIC(SUBSTRING(id, 5, LEN(id))) = 1
        `;
        const newId = `PED-${idResult.recordset[0].nextNum}`;

        const insertResult = await sql.query`
          INSERT INTO GestaoOrders (id, source, clientName, clientCnpj, clientCity, clientPhone, status, totalValue, observations, createdAt, updatedAt)
          OUTPUT INSERTED.createdAt
          VALUES (
            ${newId},
            ${source || 'Manual'},
            ${clientName},
            ${clientCnpj || null},
            ${clientCity || null},
            ${clientPhone || null},
            'Recebido',
            ${totalValue || 0},
            ${observations || null},
            GETUTCDATE(),
            GETUTCDATE()
          )
        `;

        const orderId = newId;

        for (const item of items) {
          await sql.query`
            INSERT INTO GestaoOrderItems (orderId, productName, quantity, unit, unitPrice)
            VALUES (${orderId}, ${item.productName}, ${item.quantity}, ${item.unit || ''}, ${item.unitPrice || 0})
          `;
        }

        return {
          status: 201,
          jsonBody: {
            order: {
              id: orderId,
              source: source || 'Manual',
              customer: clientName,
              cnpj: clientCnpj || '',
              city: clientCity || '',
              whatsapp: clientPhone || '',
              value: Number(totalValue) || 0,
              status: 'Recebido',
              priority: 'Normal',
              time: formatTime(new Date(insertResult.recordset[0].createdAt)),
              delivery: 'A confirmar',
              products: items.map((i) => ({
                name: i.productName,
                qty: i.quantity,
                unit: i.unit || '',
                price: Number(i.unitPrice) || 0,
              })),
              notes: observations || '',
            },
          },
        };
      }
    } catch (error) {
      context.error('Erro na função orders:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    } finally {
      await sql.close();
    }
  },
});
