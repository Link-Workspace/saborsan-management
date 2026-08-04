'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const { initializeApp: initFirebase, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

if (!getApps().length) {
  initFirebase({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

// ── FCM: notifica entregador quando NF-e é autorizada ────────────────────────

async function notifyDriverNfeAuthorized(orderId) {
  try {
    const deliveryResult = await sql.query`
      SELECT d.seller_id, d.code AS deliveryCode
      FROM Deliveries d
      INNER JOIN DeliveryOrders dord ON dord.delivery_id = d.id
      WHERE dord.order_id = ${orderId}
        AND d.status NOT IN (N'Cancelada', N'Concluída')
    `;
    if (!deliveryResult.recordset.length) return;
    const { seller_id: sellerId, deliveryCode } = deliveryResult.recordset[0];

    const sellerResult = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerResult.recordset.length) return;
    const { userId } = sellerResult.recordset[0];

    const orderResult = await sql.query`SELECT clientName FROM GestaoOrders WHERE id = ${orderId}`;
    const clientName = orderResult.recordset[0]?.clientName || 'cliente';

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;

    const messaging = getMessaging();
    const msgTitle = `Nota fiscal do pedido ${orderId} emitida`;
    const msgBody = `A NF-e de ${clientName} (entrega ${deliveryCode}) foi autorizada. Confirme para colocar em rota.`;

    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title: msgTitle, body: msgBody },
          data: { type: 'nfe_authorized', orderId: String(orderId), deliveryCode: String(deliveryCode) },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
        }
      }
    }
  } catch {
    // Não quebrar o fluxo principal de emissão da NF-e
  }
}

// ── Focus NFe helpers ─────────────────────────────────────────────────────────

function getFocusConfig() {
  const baseUrl = process.env.FOCUS_NFE_BASE_URL;
  const token = process.env.FOCUS_NFE_TOKEN;
  if (!baseUrl) throw Object.assign(new Error('FOCUS_NFE_BASE_URL não configurada no servidor'), { configError: true });
  if (!token) throw Object.assign(new Error('FOCUS_NFE_TOKEN não configurado no servidor'), { configError: true });
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
    timeoutMs: Number(process.env.FOCUS_NFE_TIMEOUT_MS ?? 30000),
  };
}

function createBasicAuth(token) {
  return `Basic ${Buffer.from(`${token}:`, 'utf8').toString('base64')}`;
}

async function focusRequest(path, { method = 'GET', body } = {}) {
  const { baseUrl, token, timeoutMs } = getFocusConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: createBasicAuth(token),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      throw Object.assign(new Error(`Focus NFe HTTP ${res.status}`), { httpStatus: res.status, data });
    }

    return { httpStatus: res.status, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(new Error('Tempo limite ao chamar a Focus NFe'), { isTimeout: true });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Reference ─────────────────────────────────────────────────────────────────

function createNfeReference(fiscalDocumentId) {
  const normalized = String(fiscalDocumentId).replace(/[^a-zA-Z0-9]/g, '');
  if (!normalized) throw new Error('Não foi possível gerar referência da NF-e');
  return `NFE${normalized}`.toUpperCase();
}

// ── Status mapper ─────────────────────────────────────────────────────────────

function mapFocusStatus(response) {
  const raw = String(
    response.status || response.status_sefaz || response.situacao || ''
  ).toLowerCase();

  if (raw.includes('autoriz') || response.status_sefaz === '100') {
    return {
      status: 'AUTHORIZED',
      number: response.numero,
      series: response.serie,
      accessKey: response.chave_nfe || response.chave || response.chave_acesso,
      protocol: response.protocolo || response.numero_protocolo,
      xmlPath: response.caminho_xml_nota_fiscal || response.caminho_xml,
      danfePath: response.caminho_danfe || response.caminho_pdf,
    };
  }
  if (raw.includes('process') || raw.includes('fila') || raw.includes('em processamento') || raw.includes('recebido')) {
    return { status: 'PROCESSING' };
  }
  if (raw.includes('cancel')) {
    return { status: 'CANCELLED' };
  }
  if (raw.includes('erro') || raw.includes('rejeit')) {
    return {
      status: 'REJECTED',
      errorCode: String(response.codigo_status || response.status_sefaz || ''),
      errorMessage:
        response.mensagem_sefaz ||
        response.mensagem ||
        (Array.isArray(response.erros) ? response.erros.map((e) => e.mensagem).join('; ') : ''),
    };
  }
  return { status: 'MANUAL_REVIEW' };
}

// ── Fiscal configuration per product ─────────────────────────────────────────
// ATENÇÃO: Os dados fiscais abaixo (NCM, CFOP, CST, alíquotas) são uma
// configuração inicial para homologação. Devem ser validados pelo contador
// da Saborsan antes da emissão em produção.

const FISCAL_MAP = {
  'Pão de Queijo Tradicional': { ncm: '19059090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0 },
  'Mini Pizza Congelada':      { ncm: '19012000', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0 },
  'Açaí Premium Balde':        { ncm: '20089200', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0 },
  'Croissant Folhado':         { ncm: '19059090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0 },
  'Mix de Salgados':           { ncm: '21069090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0 },
  'Polpas de Frutas Sortidas': { ncm: '20089900', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0 },
};

// Fallback para produtos não mapeados: PIS/COFINS CST 07 = isento, ICMS zerado.
// O contador deve validar a correta classificação de cada produto.
const DEFAULT_FISCAL = {
  ncm: '21069090', cfop: '5102', icmsCst: '41', icmsOrigin: 0,
  pisCST: '07', cofinsCST: '07', icmsAliq: 0, pisAliq: 0, cofinsAliq: 0,
};

function round2(v) { return Number(Number(v ?? 0).toFixed(2)); }
function round4(v) { return Number(Number(v ?? 0).toFixed(4)); }
function digits(v) { return v ? String(v).replace(/\D/g, '') : undefined; }

function buildNfePayload(order, items) {
  const cityStr = String(order.clientCity || '').trim();
  const uf = cityStr.includes(' - ') ? cityStr.split(' - ').pop().trim() : 'SC';
  const city = cityStr.includes(' - ') ? cityStr.split(' - ')[0].trim() : (cityStr || 'Lages');

  const productTotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));

  const nfeItems = items.map((item, index) => {
    const f = FISCAL_MAP[item.productName] || DEFAULT_FISCAL;
    const gross = round2(item.quantity * item.unitPrice);
    const icmsBase = gross;
    const icmsVal = round2(icmsBase * f.icmsAliq / 100);
    const pisVal = round2(gross * f.pisAliq / 100);
    const cofinsVal = round2(gross * f.cofinsAliq / 100);

    const itemObj = {
      numero_item: index + 1,
      codigo_produto: String(item.productCode || `PROD${String(index + 1).padStart(3, '0')}`),
      descricao: item.productName,
      codigo_ncm: f.ncm,
      cfop: f.cfop,
      unidade_comercial: item.unit || 'UN',
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: round4(item.unitPrice),
      valor_bruto: gross,
      unidade_tributavel: item.unit || 'UN',
      quantidade_tributavel: item.quantity,
      valor_unitario_tributavel: round4(item.unitPrice),
      inclui_no_total: 1,
      icms_origem: f.icmsOrigin,
      icms_situacao_tributaria: f.icmsCst,
      pis_situacao_tributaria: f.pisCST,
      cofins_situacao_tributaria: f.cofinsCST,
    };

    if (f.icmsAliq > 0) {
      Object.assign(itemObj, {
        icms_modalidade_base_calculo: 3,
        icms_base_calculo: icmsBase,
        icms_aliquota: f.icmsAliq,
        icms_valor: icmsVal,
      });
    }
    if (f.pisAliq > 0) {
      Object.assign(itemObj, {
        pis_base_calculo: gross,
        pis_aliquota_percentual: f.pisAliq,
        pis_valor: pisVal,
      });
    }
    if (f.cofinsAliq > 0) {
      Object.assign(itemObj, {
        cofins_base_calculo: gross,
        cofins_aliquota_percentual: f.cofinsAliq,
        cofins_valor: cofinsVal,
      });
    }

    return itemObj;
  });

  return {
    natureza_operacao: 'Venda de mercadoria',
    data_emissao: new Date().toISOString(),
    data_entrada_saida: new Date().toISOString(),
    tipo_documento: 1,
    local_destino: 1,
    finalidade_emissao: 1,
    consumidor_final: 0,
    presenca_comprador: 4,
    cnpj_emitente: digits(process.env.SABORSAN_CNPJ) || '12345678000199',
    regime_tributario_emitente: Number(process.env.SABORSAN_TAX_REGIME || 3),
    nome_destinatario: order.clientName,
    cnpj_destinatario: order.clientCnpj ? digits(order.clientCnpj) : undefined,
    indicador_inscricao_estadual_destinatario: 9,
    logradouro_destinatario: order.clientStreet || 'Não informado',
    numero_destinatario: order.clientNumber || 'SN',
    bairro_destinatario: order.clientDistrict || 'Centro',
    codigo_municipio_destinatario: order.clientIbgeCode || '4209300',
    municipio_destinatario: city,
    uf_destinatario: uf,
    cep_destinatario: digits(order.clientZip) || '88500000',
    modalidade_frete: 0,
    valor_produtos: productTotal,
    valor_total: productTotal,
    items: nfeItems,
  };
}

// ── SQL: ensure table exists ──────────────────────────────────────────────────

async function ensureTable() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'GestaoFiscalDocuments'
    )
    BEGIN
      CREATE TABLE GestaoFiscalDocuments (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        orderId         NVARCHAR(50)   NOT NULL,
        environment     NVARCHAR(20)   NOT NULL DEFAULT 'HOMOLOGATION',
        focusReference  NVARCHAR(100)  NULL,
        status          NVARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
        nfeNumber       NVARCHAR(20)   NULL,
        nfeSeries       NVARCHAR(5)    NULL,
        accessKey       NVARCHAR(60)   NULL,
        protocol        NVARCHAR(30)   NULL,
        xmlPath         NVARCHAR(500)  NULL,
        danfePath       NVARCHAR(500)  NULL,
        errorCode       NVARCHAR(10)   NULL,
        errorMessage    NVARCHAR(1000) NULL,
        requestPayload  NVARCHAR(MAX)  NULL,
        responsePayload NVARCHAR(MAX)  NULL,
        issuedAt        DATETIME2      NULL,
        authorizedAt    DATETIME2      NULL,
        createdAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        updatedAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_FiscalDoc_Env_Ref UNIQUE (environment, focusReference)
      )
    END
  `;
}

// ── Azure Function handler ────────────────────────────────────────────────────

app.http('emit-nfe', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTable();

      const url = new URL(request.url);
      const ref = url.searchParams.get('ref');
      const download = url.searchParams.get('download');

      // ── Download XML or DANFE ────────────────────────────────────────────
      if (request.method === 'GET' && ref && download) {
        if (download !== 'xml' && download !== 'danfe') {
          return { status: 400, jsonBody: { error: 'Parâmetro download deve ser "xml" ou "danfe"' } };
        }

        const docResult = await sql.query`
          SELECT xmlPath, danfePath FROM GestaoFiscalDocuments
          WHERE focusReference = ${ref} AND status = 'AUTHORIZED'
        `;
        const doc = docResult.recordset[0];
        if (!doc) {
          return { status: 404, jsonBody: { error: 'Documento não autorizado ou não encontrado' } };
        }

        const { baseUrl, token } = getFocusConfig();

        // Se o caminho não estiver salvo no banco, busca o status atual na Focus NFe
        let filePath = download === 'xml' ? doc.xmlPath : doc.danfePath;
        if (!filePath) {
          try {
            const statusRes = await focusRequest(`/v2/nfe/${encodeURIComponent(ref)}?completa=1`);
            const mapped = mapFocusStatus(statusRes.data);
            if (mapped.status === 'AUTHORIZED') {
              // Atualiza o banco para futuras consultas
              await sql.query`
                UPDATE GestaoFiscalDocuments
                SET xmlPath   = ${mapped.xmlPath || null},
                    danfePath = ${mapped.danfePath || null},
                    updatedAt = GETUTCDATE()
                WHERE focusReference = ${ref}
              `;
              filePath = download === 'xml' ? mapped.xmlPath : mapped.danfePath;
            }
          } catch (_) {}
        }

        // Fallback: construir URL direta da Focus NFe pelo padrão de endpoint
        if (!filePath) {
          filePath = download === 'xml'
            ? `${baseUrl}/v2/nfe/${encodeURIComponent(ref)}.xml`
            : `${baseUrl}/v2/nfe/${encodeURIComponent(ref)}.pdf`;
        }

        const fileUrl = filePath.startsWith('http') ? filePath : `${baseUrl}${filePath}`;

        const fileRes = await fetch(fileUrl, {
          headers: { Authorization: createBasicAuth(token) },
        });

        if (!fileRes.ok) {
          return { status: 502, jsonBody: { error: 'Falha ao baixar arquivo da Focus NFe' } };
        }

        const buffer = await fileRes.arrayBuffer();
        const isXml = download === 'xml';

        return {
          status: 200,
          headers: {
            'Content-Type': isXml ? 'application/xml' : 'application/pdf',
            'Content-Disposition': `attachment; filename="${isXml ? `NFe_${ref}.xml` : `DANFE_${ref}.pdf`}"`,
          },
          body: Buffer.from(buffer),
        };
      }

      // ── Full NF-e details from Focus NFe ─────────────────────────────────
      if (request.method === 'GET' && ref && url.searchParams.get('details') === '1') {
        try {
          const focusRes = await focusRequest(`/v2/nfe/${encodeURIComponent(ref)}?completa=1`);
          const d = focusRes.data;
          const rawItems = d.items || d.itens || [];
          const items = rawItems.map((i) => ({
            number: i.numero_item,
            code: i.codigo_produto,
            description: i.descricao,
            ncm: i.codigo_ncm,
            cfop: i.cfop,
            unit: i.unidade_comercial || i.unidade_tributavel,
            quantity: Number(i.quantidade_comercial ?? i.quantidade_tributavel ?? 0),
            unitPrice: Number(i.valor_unitario_comercial ?? i.valor_unitario_tributavel ?? 0),
            total: Number(i.valor_bruto ?? 0),
          }));

          return {
            jsonBody: {
              reference: ref,
              number: d.numero,
              series: d.serie,
              accessKey: d.chave_nfe || d.chave || d.chave_acesso,
              protocol: d.protocolo || d.numero_protocolo,
              statusSefaz: d.status_sefaz,
              messageSefaz: d.mensagem_sefaz || d.mensagem,
              issuedAt: d.data_emissao,
              natureza: d.natureza_operacao,
              emitter: {
                cnpj: d.cnpj_emitente,
                name: d.nome_emitente,
              },
              recipient: {
                name: d.nome_destinatario,
                cnpj: d.cnpj_destinatario,
                city: d.municipio_destinatario,
                state: d.uf_destinatario,
              },
              totals: {
                products: Number(d.valor_produtos ?? 0),
                total: Number(d.valor_total ?? 0),
                icms: Number(d.valor_icms ?? 0),
                pis: Number(d.valor_pis ?? 0),
                cofins: Number(d.valor_cofins ?? 0),
                freight: Number(d.valor_frete ?? 0),
                discount: Number(d.valor_desconto ?? 0),
              },
              items,
            },
          };
        } catch (err) {
          if (err.configError) {
            return { status: 503, jsonBody: { error: err.message, configError: true } };
          }
          context.error('Erro ao buscar detalhes NF-e:', err);
          return { status: 502, jsonBody: { error: 'Falha ao buscar detalhes na Focus NFe' } };
        }
      }

      // ── Query NF-e status ────────────────────────────────────────────────
      if (request.method === 'GET' && ref) {
        const docResult = await sql.query`
          SELECT id, orderId, status, focusReference, nfeNumber, nfeSeries,
                 accessKey, protocol, errorCode, errorMessage
          FROM GestaoFiscalDocuments WHERE focusReference = ${ref}
        `;
        const doc = docResult.recordset[0];
        if (!doc) {
          return { status: 404, jsonBody: { error: 'Documento fiscal não encontrado' } };
        }

        // Return cached for terminal states
        if (doc.status === 'AUTHORIZED') {
          return {
            jsonBody: {
              status: 'AUTHORIZED',
              reference: doc.focusReference,
              number: doc.nfeNumber,
              series: doc.nfeSeries,
              accessKey: doc.accessKey,
              protocol: doc.protocol,
            },
          };
        }
        if (doc.status === 'REJECTED') {
          return {
            jsonBody: {
              status: 'REJECTED',
              reference: doc.focusReference,
              errorCode: doc.errorCode,
              errorMessage: doc.errorMessage,
            },
          };
        }

        // Query Focus NFe for current status (completa=1 inclui caminho_xml e caminho_danfe)
        try {
          const focusRes = await focusRequest(`/v2/nfe/${encodeURIComponent(ref)}?completa=1`);
          const mapped = mapFocusStatus(focusRes.data);

          if (mapped.status === 'AUTHORIZED') {
            await sql.query`
              UPDATE GestaoFiscalDocuments
              SET status = 'AUTHORIZED',
                  nfeNumber    = ${mapped.number || null},
                  nfeSeries    = ${mapped.series || null},
                  accessKey    = ${mapped.accessKey || null},
                  protocol     = ${mapped.protocol || null},
                  xmlPath      = ${mapped.xmlPath || null},
                  danfePath    = ${mapped.danfePath || null},
                  authorizedAt = GETUTCDATE(),
                  responsePayload = ${JSON.stringify(focusRes.data)},
                  updatedAt    = GETUTCDATE()
              WHERE focusReference = ${ref}
            `;
            await sql.query`
              UPDATE GestaoOrders
              SET status = 'Nota emitida', updatedAt = GETUTCDATE()
              WHERE id = ${doc.orderId}
            `;
            await notifyDriverNfeAuthorized(doc.orderId);
            return {
              jsonBody: {
                status: 'AUTHORIZED',
                reference: ref,
                number: mapped.number,
                series: mapped.series,
                accessKey: mapped.accessKey,
                protocol: mapped.protocol,
              },
            };
          }

          if (mapped.status === 'REJECTED') {
            await sql.query`
              UPDATE GestaoFiscalDocuments
              SET status       = 'REJECTED',
                  errorCode    = ${mapped.errorCode || null},
                  errorMessage = ${mapped.errorMessage || null},
                  responsePayload = ${JSON.stringify(focusRes.data)},
                  updatedAt    = GETUTCDATE()
              WHERE focusReference = ${ref}
            `;
            await sql.query`
              UPDATE GestaoOrders
              SET status = 'Pronto', updatedAt = GETUTCDATE()
              WHERE id = ${doc.orderId}
            `;
            return {
              jsonBody: {
                status: 'REJECTED',
                reference: ref,
                errorCode: mapped.errorCode,
                errorMessage: mapped.errorMessage,
              },
            };
          }

          // Still processing
          await sql.query`
            UPDATE GestaoFiscalDocuments
            SET status = ${mapped.status}, updatedAt = GETUTCDATE()
            WHERE focusReference = ${ref}
          `;
          return { jsonBody: { status: mapped.status, reference: ref } };
        } catch (err) {
          if (err.configError) {
            return { status: 503, jsonBody: { error: err.message, configError: true } };
          }
          context.error('Erro ao consultar Focus NFe:', err);
          return { status: 502, jsonBody: { error: 'Falha ao consultar status na Focus NFe' } };
        }
      }

      // ── Emit NF-e ────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { orderId } = body;

        if (!orderId) {
          return { status: 400, jsonBody: { error: 'orderId é obrigatório' } };
        }

        // Validate Focus config before touching anything
        try {
          getFocusConfig();
        } catch (err) {
          return { status: 503, jsonBody: { error: err.message, configError: true } };
        }

        // Load order and items
        const [orderRes, itemsRes] = await Promise.all([
          sql.query`
            SELECT id, clientName, clientCnpj, clientCity, clientPhone, status, totalValue
            FROM GestaoOrders WHERE id = ${orderId}
          `,
          sql.query`
            SELECT productName, quantity, unit, unitPrice
            FROM GestaoOrderItems WHERE orderId = ${orderId} ORDER BY id ASC
          `,
        ]);

        const order = orderRes.recordset[0];
        if (!order) {
          return { status: 404, jsonBody: { error: 'Pedido não encontrado' } };
        }

        const items = itemsRes.recordset.map((i) => ({
          productName: i.productName,
          quantity: Number(i.quantity),
          unit: i.unit,
          unitPrice: Number(i.unitPrice || 0),
        }));

        if (!items.length) {
          return { status: 422, jsonBody: { error: 'Pedido sem itens cadastrados' } };
        }

        // Idempotency: check for existing active document
        const existingRes = await sql.query`
          SELECT id, status, focusReference, nfeNumber, nfeSeries, accessKey, protocol
          FROM GestaoFiscalDocuments
          WHERE orderId = ${orderId}
          AND status IN ('AUTHORIZED', 'PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')
        `;

        if (existingRes.recordset.length > 0) {
          const ex = existingRes.recordset[0];
          if (ex.status === 'AUTHORIZED') {
            return {
              jsonBody: {
                status: 'AUTHORIZED',
                reference: ex.focusReference,
                number: ex.nfeNumber,
                series: ex.nfeSeries,
                accessKey: ex.accessKey,
                protocol: ex.protocol,
              },
            };
          }
          // PROCESSING or SUBMITTING: return reference for polling
          return { jsonBody: { status: ex.status, reference: ex.focusReference } };
        }

        // Create new FiscalDocument
        const env = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'HOMOLOGATION';
        const createRes = await sql.query`
          INSERT INTO GestaoFiscalDocuments (orderId, environment, status)
          OUTPUT INSERTED.id
          VALUES (${orderId}, ${env}, 'SUBMITTING')
        `;
        const docId = createRes.recordset[0].id;
        const reference = createNfeReference(docId);
        const payload = buildNfePayload(order, items);

        await sql.query`
          UPDATE GestaoFiscalDocuments
          SET focusReference = ${reference},
              requestPayload = ${JSON.stringify(payload)},
              issuedAt       = GETUTCDATE(),
              updatedAt      = GETUTCDATE()
          WHERE id = ${docId}
        `;

        // Send to Focus NFe
        try {
          const focusRes = await focusRequest(
            `/v2/nfe?ref=${encodeURIComponent(reference)}`,
            { method: 'POST', body: payload }
          );

          const mapped = mapFocusStatus(focusRes.data);
          const nextStatus = mapped.status === 'AUTHORIZED' ? 'AUTHORIZED' : 'PROCESSING';

          await sql.query`
            UPDATE GestaoFiscalDocuments
            SET status          = ${nextStatus},
                responsePayload = ${JSON.stringify(focusRes.data)},
                updatedAt       = GETUTCDATE()
            WHERE id = ${docId}
          `;

          if (nextStatus === 'AUTHORIZED') {
            await sql.query`
              UPDATE GestaoFiscalDocuments
              SET nfeNumber    = ${mapped.number || null},
                  nfeSeries    = ${mapped.series || null},
                  accessKey    = ${mapped.accessKey || null},
                  protocol     = ${mapped.protocol || null},
                  xmlPath      = ${mapped.xmlPath || null},
                  danfePath    = ${mapped.danfePath || null},
                  authorizedAt = GETUTCDATE(),
                  updatedAt    = GETUTCDATE()
              WHERE id = ${docId}
            `;
            await sql.query`
              UPDATE GestaoOrders
              SET status = 'Nota emitida', updatedAt = GETUTCDATE()
              WHERE id = ${orderId}
            `;
            await notifyDriverNfeAuthorized(orderId);
            return {
              jsonBody: {
                status: 'AUTHORIZED',
                reference,
                number: mapped.number,
                series: mapped.series,
                accessKey: mapped.accessKey,
                protocol: mapped.protocol,
              },
            };
          }

          return { jsonBody: { status: 'PROCESSING', reference } };
        } catch (focusErr) {
          context.error('Erro Focus NFe:', focusErr);

          const isDataError = focusErr.httpStatus === 400 || focusErr.httpStatus === 422;
          const docStatus = isDataError ? 'REJECTED' : 'SUBMISSION_FAILED';

          const errMsg = (() => {
            if (!focusErr.data) return focusErr.message || 'Erro desconhecido';
            if (typeof focusErr.data === 'string') return focusErr.data;
            if (Array.isArray(focusErr.data?.erros)) {
              return focusErr.data.erros.map((e) => e.mensagem).join('; ');
            }
            return focusErr.data?.mensagem || JSON.stringify(focusErr.data);
          })();

          await sql.query`
            UPDATE GestaoFiscalDocuments
            SET status          = ${docStatus},
                errorCode       = ${String(focusErr.httpStatus || 'ERR')},
                errorMessage    = ${errMsg},
                responsePayload = ${JSON.stringify(focusErr.data || {})},
                updatedAt       = GETUTCDATE()
            WHERE id = ${docId}
          `;

          return {
            status: isDataError ? 422 : 500,
            jsonBody: {
              status: docStatus,
              reference,
              errorMessage: errMsg,
              errorCode: String(focusErr.httpStatus || 'ERR'),
            },
          };
        }
      }

      return { status: 405, jsonBody: { error: 'Método não permitido' } };
    } catch (err) {
      if (err.configError) {
        return { status: 503, jsonBody: { error: err.message, configError: true } };
      }
      context.error('Erro em emit-nfe:', err);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    } finally {
      try { await sql.close(); } catch (_) {}
    }
  },
});
