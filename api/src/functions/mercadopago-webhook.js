'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const crypto = require('crypto');
const https = require('https');

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

// Garante que a coluna mercadoPagoPaymentId existe na tabela Payments
let _schemaEnsured = false;
async function ensureSchema(pool) {
  if (_schemaEnsured) return;
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Payments' AND COLUMN_NAME = 'mercadoPagoPaymentId'
    )
    ALTER TABLE Payments ADD mercadoPagoPaymentId VARCHAR(50) NULL
  `);
  _schemaEnsured = true;
}

// Mapeia o tipo de pagamento do Mercado Pago para nome legível em português
function mapPaymentMethod(methodId, typeId) {
  if (typeId === 'pix') return 'PIX';
  if (typeId === 'ticket') return 'Boleto';
  if (typeId === 'credit_card') return 'Cartão de Crédito';
  if (typeId === 'debit_card') return 'Cartão de Débito';
  if (methodId === 'account_money') return 'Saldo Mercado Pago';
  return 'Mercado Pago';
}

// Consulta o pagamento diretamente na API do Mercado Pago
function fetchMpPayment(paymentId, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mercadopago.com',
      path: `/v1/payments/${encodeURIComponent(String(paymentId))}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode !== 200) {
            reject(new Error(`MP API retornou ${res.statusCode}: ${parsed.message || raw}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Resposta inválida da API do Mercado Pago'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Timeout na consulta à API do Mercado Pago')));
    req.end();
  });
}

// Verifica a assinatura HMAC-SHA256 enviada pelo Mercado Pago
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
function verifyWebhookSignature(xSignature, xRequestId, dataId, secret) {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;

  const parts = {};
  for (const part of xSignature.split(',')) {
    const idx = part.indexOf('=');
    if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(template).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

app.http('mercadopago-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mercadopago/webhook',
  handler: async (request) => {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      return { status: 503, jsonBody: { error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' } };
    }

    // Lê o corpo da requisição
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Corpo da requisição inválido' } };
    }

    const { type, data } = body;
    const paymentId = data?.id;

    // Responde imediatamente a eventos que não são de pagamento
    if (type !== 'payment') {
      return { status: 200, jsonBody: { received: true } };
    }

    if (!paymentId) {
      return { status: 400, jsonBody: { error: 'ID de pagamento ausente no webhook' } };
    }

    // Verifica assinatura se o secret estiver configurado
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (webhookSecret) {
      const xSignature = request.headers.get('x-signature') || '';
      const xRequestId = request.headers.get('x-request-id') || '';
      if (!verifyWebhookSignature(xSignature, xRequestId, String(paymentId), webhookSecret)) {
        return { status: 401, jsonBody: { error: 'Assinatura do webhook inválida' } };
      }
    }

    // Consulta a API do Mercado Pago para obter os dados reais do pagamento
    // (nunca confiar apenas nos dados do webhook body)
    let payment;
    try {
      payment = await fetchMpPayment(paymentId, token);
    } catch (err) {
      return { status: 500, jsonBody: { error: `Falha ao consultar pagamento no Mercado Pago: ${err.message}` } };
    }

    // Só processa pagamentos aprovados (valor efetivamente depositado)
    if (payment.status !== 'approved') {
      return { status: 200, jsonBody: { received: true, skipped: true, reason: payment.status } };
    }

    const pool = await getPool();
    await ensureSchema(pool);

    // Idempotência: evita criar pagamento duplicado para o mesmo ID do Mercado Pago
    const existing = await pool
      .request()
      .input('mpId', sql.VarChar(50), String(paymentId))
      .query('SELECT id FROM Payments WHERE mercadoPagoPaymentId = @mpId');

    if (existing.recordset.length > 0) {
      return { status: 200, jsonBody: { received: true, skipped: true, reason: 'already_processed' } };
    }

    // Extrai os dados do pagamento aprovado
    const paymentDate = new Date(payment.date_approved || payment.date_created);
    const paymentValue = parseFloat(payment.transaction_amount) || 0;
    const totalPaid = parseFloat(payment.transaction_amount) || 0;
    const paymentMethod = mapPaymentMethod(payment.payment_method_id, payment.payment_type_id);

    // Cria o pagamento no sistema Saborsan com os dados estáticos definidos
    await pool
      .request()
      .input('paymentDate', sql.DateTime, paymentDate)
      .input('paymentMethod', sql.VarChar(100), paymentMethod)
      .input('paymentValue', sql.Decimal(10, 2), paymentValue)
      .input('totalPaid', sql.Decimal(10, 2), totalPaid)
      .input('mpId', sql.VarChar(50), String(paymentId))
      .query(`
        INSERT INTO Payments
          (clientName, orderId, sellerName, paymentDate, paymentMethod, paymentValue, totalPaid, status, mercadoPagoPaymentId, createdAt)
        VALUES
          ('Cafeteria Central', NULL, 'João Silva', @paymentDate, @paymentMethod, @paymentValue, @totalPaid, 'Pago', @mpId, GETUTCDATE())
      `);

    return {
      status: 200,
      jsonBody: { received: true, created: true, mercadoPagoPaymentId: String(paymentId) },
    };
  },
});
