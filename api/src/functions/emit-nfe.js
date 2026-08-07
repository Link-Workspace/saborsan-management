'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const { validarRegrasFiscais, resolverCBenefParaItens } = require('./fiscal-rules-engine');
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

async function notifyDriverNfeAuthorized(orderId, context) {
  try {
    const deliveryResult = await sql.query`
      SELECT d.id AS deliveryId, d.seller_id, d.code AS deliveryCode
      FROM Deliveries d
      INNER JOIN DeliveryOrders dord ON dord.delivery_id = d.id
      WHERE dord.order_id = ${orderId}
        AND d.status NOT IN (N'Cancelada', N'Concluída')
    `;
    if (!deliveryResult.recordset.length) {
      context.warn(`[notifyDriverNfe] pedido ${orderId} não tem entrega vinculada ou está cancelada/concluída`);
      return;
    }
    const { deliveryId, seller_id: sellerId, deliveryCode } = deliveryResult.recordset[0];

    // Verifica se TODOS os pedidos da entrega já têm NFe com status AUTHORIZED
    const pendingResult = await sql.query`
      SELECT dord.order_id
      FROM DeliveryOrders dord
      WHERE dord.delivery_id = ${deliveryId}
        AND NOT EXISTS (
          SELECT 1 FROM GestaoFiscalDocuments fd
          WHERE fd.orderId = dord.order_id AND fd.status = 'AUTHORIZED'
        )
    `;
    if (pendingResult.recordset.length > 0) {
      context.log(`[notifyDriverNfe] entrega ${deliveryId} ainda tem ${pendingResult.recordset.length} pedido(s) sem NFe autorizada`);
      return;
    }

    const sellerResult = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerResult.recordset.length) {
      context.warn(`[notifyDriverNfe] seller_id ${sellerId} não encontrado na tabela Sellers`);
      return;
    }
    const { userId } = sellerResult.recordset[0];

    const allOrdersResult = await sql.query`
      SELECT dord.order_id AS orderId FROM DeliveryOrders dord WHERE dord.delivery_id = ${deliveryId}
    `;
    const allOrderIds = allOrdersResult.recordset.map((r) => r.orderId);
    const isMultiple = allOrderIds.length > 1;

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) {
      context.warn(`[notifyDriverNfe] userId ${userId} não tem push token registrado em PushTokens`);
      return;
    }

    context.log(`[notifyDriverNfe] enviando FCM para userId ${userId}, tokens: ${tokens.length}`);
    const messaging = getMessaging();
    const msgTitle = isMultiple
      ? `Notas fiscais da entrega ${deliveryCode} emitidas`
      : `Nota fiscal do pedido ${orderId} emitida`;
    const msgBody = isMultiple
      ? `Todas as NF-e da entrega ${deliveryCode} foram autorizadas pelo SEFAZ. Confirme para colocar em rota.`
      : `A NF-e do pedido ${orderId} (entrega ${deliveryCode}) foi autorizada pelo SEFAZ. Confirme para colocar em rota.`;

    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title: msgTitle, body: msgBody },
          data: {
            type: 'nfe-confirmations',
            deliveryId: String(deliveryId),
            deliveryCode: String(deliveryCode),
            orderId: String(orderId),
          },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        context.log(`[notifyDriverNfe] FCM enviado com sucesso para token ...${token.slice(-8)}`);
      } catch (err) {
        context.error(`[notifyDriverNfe] erro ao enviar FCM: ${err.code || err.message}`);
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
        }
      }
    }
  } catch (err) {
    context.error('[notifyDriverNfe] erro inesperado:', err);
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
  // O código SEFAZ (status_sefaz) é a fonte de verdade definitiva; verificar primeiro
  // para evitar falso AUTHORIZED quando status interno da Focus NFe contém 'autoriz'
  // mas o SEFAZ já rejeitou (ex: status='autorizado', status_sefaz='1115').
  const sefazCode = String(response.status_sefaz || '').trim();

  if (sefazCode === '100') {
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
  if (sefazCode) {
    // Qualquer código SEFAZ diferente de 100 indica rejeição
    return {
      status: 'REJECTED',
      errorCode: sefazCode,
      errorMessage:
        response.mensagem_sefaz ||
        response.mensagem ||
        (Array.isArray(response.erros) ? response.erros.map((e) => e.mensagem).join('; ') : ''),
    };
  }

  // Sem código SEFAZ ainda: usar o status interno da Focus NFe para estados intermediários
  const raw = String(response.status || response.situacao || '').toLowerCase();

  if (raw.includes('autoriz')) {
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
      errorCode: '',
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
  'Pão de Queijo Tradicional': { ncm: '19059090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Mini Pizza Congelada':      { ncm: '19012000', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Açaí Premium Balde':        { ncm: '20089200', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Croissant Folhado':         { ncm: '19059090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Mix de Salgados':           { ncm: '21069090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Polpas de Frutas Sortidas': { ncm: '20089900', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
};

// Fallback para produtos não mapeados: PIS/COFINS CST 07 = isento, ICMS zerado.
// O contador deve validar a correta classificação de cada produto.
const DEFAULT_FISCAL = {
  ncm: '21069090', cfop: '5102', icmsCst: '41', icmsOrigin: 0,
  pisCST: '07', cofinsCST: '07', icmsAliq: 0, pisAliq: 0, cofinsAliq: 0,
  ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0,
};

function round2(v) { return Number(Number(v ?? 0).toFixed(2)); }
function round4(v) { return Number(Number(v ?? 0).toFixed(4)); }
function digits(v) { return v ? String(v).replace(/\D/g, '') : undefined; }

// Alíquotas transitórias 2026 (LC 214/2024) — usadas quando o produto não tem valor configurado
const IBS_UF_ALIQ_DEFAULT  = Number(process.env.IBS_2026_UF_ALIQ  ?? 0.1);
const IBS_MUN_ALIQ_DEFAULT = Number(process.env.IBS_2026_MUN_ALIQ ?? 0);
const CBS_ALIQ_DEFAULT     = Number(process.env.IBS_2026_CBS_ALIQ  ?? 0.9);

// ── Helpers de classificação fiscal (IE / consumidor final) ───────────────────

function classificarIEFocus(numero, situacao, ufRetorno) {
  const sit = String(situacao || '').toUpperCase().trim();
  const num = String(numero || '').trim();

  if (sit === 'ISENTA' || sit === 'ISENTO' || num.toUpperCase() === 'ISENTO') {
    return { stateRegistrationIndicator: 2, stateRegistration: null, stateRegistrationStatus: 'ISENTA', stateRegistrationUF: ufRetorno };
  }
  const inativas = ['CANCELADA', 'INAPTA', 'NULA', 'BAIXADA', 'SUSPENSA'];
  if (inativas.includes(sit) || !num) {
    return { stateRegistrationIndicator: 9, stateRegistration: null, stateRegistrationStatus: sit || 'NOT_FOUND', stateRegistrationUF: ufRetorno };
  }
  return { stateRegistrationIndicator: 1, stateRegistration: num, stateRegistrationStatus: sit || 'ACTIVE', stateRegistrationUF: ufRetorno };
}

function extrairIEDaResposta(data, targetUf) {
  const uf = String(targetUf || '').toUpperCase().trim();

  if (Array.isArray(data.inscricoes_estaduais) && data.inscricoes_estaduais.length > 0) {
    const match = uf
      ? data.inscricoes_estaduais.find((ie) => String(ie.uf || ie.estado || '').toUpperCase().trim() === uf)
      : null;
    const ie = match || data.inscricoes_estaduais[0];
    const num = String(ie.inscricao_estadual || ie.numero || ie.ie || '').trim();
    const sit = String(ie.situacao || ie.situacao_inscricao_estadual || ie.status || '').trim();
    return classificarIEFocus(num, sit, String(ie.uf || ie.estado || targetUf || '').toUpperCase());
  }

  const num = String(data.inscricao_estadual || data.ie || '').trim();
  const sit = String(data.situacao_inscricao_estadual || data.situacao_ie || data.situacao || '').trim();
  const ufRetorno = String(data.uf || data.estado || targetUf || '').toUpperCase().trim();
  return classificarIEFocus(num, sit, ufRetorno);
}

function buildNfePayload(order, items, { stateRegistrationIndicator = 9, stateRegistration = null, purchasePurpose = 'consumo', fiscalConfigs = {}, codigosBenef = {} } = {}) {
  const cityStr = String(order.clientCity || '').trim();
  const uf = cityStr.includes(' - ') ? cityStr.split(' - ').pop().trim() : 'SC';
  const city = cityStr.includes(' - ') ? cityStr.split(' - ')[0].trim() : (cityStr || 'Lages');

  const productTotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));

  const nfeItems = items.map((item, index) => {
    const nameKey = item.productName.toLowerCase();
    const dbCfg = fiscalConfigs[nameKey] || fiscalConfigs[item.productName] || null;
    const base = FISCAL_MAP[item.productName] || DEFAULT_FISCAL;
    // DB config overrides hardcoded map values
    const f = dbCfg ? { ...base, ...dbCfg } : base;
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
      unidade_comercial: (item.unit || 'UN').trim().split(/\s+/)[0].substring(0, 6).toUpperCase(),
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: round4(item.unitPrice),
      valor_bruto: gross,
      unidade_tributavel: (item.unit || 'UN').trim().split(/\s+/)[0].substring(0, 6).toUpperCase(),
      quantidade_tributavel: item.quantity,
      valor_unitario_tributavel: round4(item.unitPrice),
      inclui_no_total: 1,
      icms_origem: f.icmsOrigin,
      icms_situacao_tributaria: f.icmsCst,
    };

    // CST 41 obriga o envio do cBenef à Focus NF-e
    const cBenef = codigosBenef[item.productName];
    if (String(f.icmsCst).trim() === '41' && cBenef) {
      itemObj.codigo_beneficio_fiscal = cBenef;
    }

    // CST 00: modBC deve preceder vBC no XML — campos agrupados em ordem antes de PIS/COFINS
    if (String(f.icmsCst).trim() === '00') {
      // CST 00 (tributação integral) exige alíquota > 0; fallback para base do FISCAL_MAP se DB retornar 0
      const icmsAliqEfetiva = Number(f.icmsAliq) > 0 ? Number(f.icmsAliq) : (Number(base.icmsAliq) || 0);
      Object.assign(itemObj, {
        icms_modalidade_base_calculo: 3,
        icms_base_calculo: icmsBase,
        icms_aliquota: icmsAliqEfetiva,
        icms_valor: round2(icmsBase * icmsAliqEfetiva / 100),
      });
    }

    itemObj.pis_situacao_tributaria = f.pisCST;
    if (f.pisAliq > 0) {
      Object.assign(itemObj, {
        pis_base_calculo: gross,
        pis_aliquota_percentual: f.pisAliq,
        pis_valor: pisVal,
      });
    }

    itemObj.cofins_situacao_tributaria = f.cofinsCST;
    if (f.cofinsAliq > 0) {
      Object.assign(itemObj, {
        cofins_base_calculo: gross,
        cofins_aliquota_percentual: f.cofinsAliq,
        cofins_valor: cofinsVal,
      });
    }

    // IBS/CBS — Reforma Tributária (LC 214/2024)
    if (f.ibsCbsCst) {
      const reducao       = Number(f.ibsCbsReducaoAliq) || 0;
      const fator         = reducao > 0 ? (1 - reducao / 100) : 1;
      // Fallback para alíquotas transitórias de 2026 quando o produto não tem valor salvo
      const ibsUfAliq     = Number(f.ibsCbsAliqUF)  || IBS_UF_ALIQ_DEFAULT;
      const ibsMunAliq    = Number(f.ibsCbsAliqMun) > 0 ? Number(f.ibsCbsAliqMun) : IBS_MUN_ALIQ_DEFAULT;
      const cbsAliq       = Number(f.ibsCbsAliqCbs) || CBS_ALIQ_DEFAULT;
      const ibsUfEfetiva  = round4(ibsUfAliq  * fator);
      const ibsMunEfetiva = round4(ibsMunAliq * fator);
      const cbsEfetiva    = round4(cbsAliq    * fator);
      const ibsUfVal      = round2(gross * ibsUfEfetiva  / 100);
      const ibsMunVal     = round2(gross * ibsMunEfetiva / 100);
      const cbsVal        = round2(gross * cbsEfetiva    / 100);
      Object.assign(itemObj, {
        ibs_cbs_situacao_tributaria:      f.ibsCbsCst,
        ibs_cbs_classificacao_tributaria: f.ibsCbsClassTrib,
        ibs_cbs_base_calculo:             gross,
        ibs_uf_aliquota:                  ibsUfAliq,
        ...(reducao > 0 ? { ibs_uf_percentual_reducao_aliquota: reducao } : {}),
        ibs_uf_aliquota_efetiva:          ibsUfEfetiva,
        ibs_uf_valor:                     ibsUfVal,
        ibs_mun_aliquota:                 ibsMunAliq,
        ...(reducao > 0 ? { ibs_mun_percentual_reducao_aliquota: reducao } : {}),
        ibs_mun_aliquota_efetiva:         ibsMunEfetiva,
        ibs_mun_valor:                    ibsMunVal,
        ibs_valor_total:                  round2(ibsUfVal + ibsMunVal),
        cbs_aliquota:                     cbsAliq,
        ...(reducao > 0 ? { cbs_percentual_reducao_aliquota: reducao } : {}),
        cbs_aliquota_efetiva:             cbsEfetiva,
        cbs_valor:                        cbsVal,
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
    consumidor_final: (stateRegistrationIndicator === 9 || purchasePurpose === 'consumo') ? 1 : 0,
    presenca_comprador: 4,
    cnpj_emitente: digits(process.env.SABORSAN_CNPJ) || '12345678000199',
    regime_tributario_emitente: Number(process.env.SABORSAN_TAX_REGIME || 3),
    nome_destinatario: order.clientName,
    cnpj_destinatario: order.clientCnpj ? digits(order.clientCnpj) : undefined,
    indicador_inscricao_estadual_destinatario: stateRegistrationIndicator,
    ...(stateRegistrationIndicator === 1 && stateRegistration ? { inscricao_estadual_destinatario: stateRegistration } : {}),
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

// ── SQL: ensure tables ───────────────────────────────────────────────────────

async function ensureTable() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProductFiscalConfig'
    )
    BEGIN
      CREATE TABLE ProductFiscalConfig (
        id                     INT IDENTITY(1,1) PRIMARY KEY,
        productId              NVARCHAR(100)   NOT NULL,
        productName            NVARCHAR(255)   NOT NULL,
        ncm                    NVARCHAR(10)    NOT NULL DEFAULT '21069090',
        cfop                   NVARCHAR(5)     NOT NULL DEFAULT '5102',
        icmsOrigin             INT             NOT NULL DEFAULT 0,
        icmsCst                NVARCHAR(5)     NOT NULL DEFAULT '400',
        icmsAliq               DECIMAL(10,4)   NOT NULL DEFAULT 0,
        pisCST                 NVARCHAR(3)     NOT NULL DEFAULT '07',
        pisAliq                DECIMAL(10,4)   NOT NULL DEFAULT 0,
        cofinsCST              NVARCHAR(3)     NOT NULL DEFAULT '07',
        cofinsAliq             DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsCst              NVARCHAR(5)     NULL,
        ibsCbsClassTrib        NVARCHAR(10)    NULL,
        ibsCbsAliqUF           DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsAliqMun          DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsAliqCbs          DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsReducaoAliq      DECIMAL(10,4)   NOT NULL DEFAULT 0,
        codigoBeneficioFiscal  NVARCHAR(20)    NULL,
        fiscalApproved         BIT             NOT NULL DEFAULT 0,
        approvedBy             NVARCHAR(100)   NULL,
        notes                  NVARCHAR(500)   NULL,
        createdAt              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updatedAt              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_ProductFiscalConfig_ProductId UNIQUE (productId)
      );
      CREATE INDEX IX_ProductFiscalConfig_Name ON ProductFiscalConfig (productName);
    END
    ELSE
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'codigoBeneficioFiscal'
      )
        ALTER TABLE ProductFiscalConfig ADD codigoBeneficioFiscal NVARCHAR(20) NULL;
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'ibsCbsReducaoAliq'
      )
        ALTER TABLE ProductFiscalConfig ADD ibsCbsReducaoAliq DECIMAL(10,4) NOT NULL DEFAULT 0;
    END
  `;
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FiscalBenefits'
    )
    BEGIN
      CREATE TABLE FiscalBenefits (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        codigo           NVARCHAR(20)   NOT NULL,
        uf               NVARCHAR(2)    NOT NULL DEFAULT 'SC',
        descricao        NVARCHAR(500)  NOT NULL,
        tipoBeneficio    NVARCHAR(50)   NOT NULL,
        cstsPermitidos   NVARCHAR(100)  NOT NULL,
        aplicavelSimples BIT            NOT NULL DEFAULT 0,
        fundamentoLegal  NVARCHAR(500)  NULL,
        inicioVigencia   DATE           NULL,
        fimVigencia      DATE           NULL,
        ativo            BIT            NOT NULL DEFAULT 1,
        createdAt        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        updatedAt        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_FiscalBenefits_Codigo_UF UNIQUE (codigo, uf)
      );
      CREATE INDEX IX_FiscalBenefits_UF_Ativo ON FiscalBenefits (uf, ativo);
    END
  `;
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

// ── Load fiscal configs from DB (keyed by lowercase product name) ─────────────

async function loadFiscalConfigs() {
  try {
    const result = await sql.query`
      SELECT productName, ncm, cfop, icmsOrigin, icmsCst, icmsAliq,
             pisCST, pisAliq, cofinsCST, cofinsAliq,
             ibsCbsCst, ibsCbsClassTrib, ibsCbsAliqUF, ibsCbsAliqMun, ibsCbsAliqCbs,
             ibsCbsReducaoAliq, codigoBeneficioFiscal
      FROM ProductFiscalConfig
    `;
    const map = {};
    for (const row of result.recordset) {
      map[row.productName.toLowerCase()] = row;
    }
    return map;
  } catch {
    return {};
  }
}

async function loadFiscalBenefits() {
  try {
    const result = await sql.query`
      SELECT codigo, uf, cstsPermitidos, aplicavelSimples,
             inicioVigencia, fimVigencia, ativo
      FROM FiscalBenefits
      WHERE ativo = 1
    `;
    return result.recordset;
  } catch {
    return [];
  }
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

          // Corrige divergência: se o BD tem AUTHORIZED mas o SEFAZ retornou rejeição
          const detailsSefazCode = String(d.status_sefaz || '').trim();
          if (detailsSefazCode && detailsSefazCode !== '100') {
            try {
              await sql.query`
                UPDATE GestaoFiscalDocuments
                SET status       = 'REJECTED',
                    errorCode    = ${detailsSefazCode},
                    errorMessage = ${d.mensagem_sefaz || d.mensagem || null},
                    updatedAt    = GETUTCDATE()
                WHERE focusReference = ${ref} AND status = 'AUTHORIZED'
              `;
            } catch (_) { /* não interromper o fluxo */ }
          }

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
              SET status = N'Pronto', updatedAt = GETUTCDATE()
              WHERE id = ${doc.orderId}
            `;
            await notifyDriverNfeAuthorized(doc.orderId, context);
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
            SELECT id, clientName, clientCnpj, clientCity, clientPhone, status, totalValue, purchasePurpose
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

        // ── Carrega configurações fiscais e benefícios fiscais ──────────────
        const [fiscalConfigs, fiscalBenefits] = await Promise.all([
          loadFiscalConfigs(),
          loadFiscalBenefits(),
        ]);

        // ── Motor de regras fiscais — validação pré-emissão ──────────────────
        const cityStrFiscal = String(order.clientCity || '').trim();
        const ufDestinatario = cityStrFiscal.includes(' - ') ? cityStrFiscal.split(' - ').pop().trim() : 'SC';
        const ufEmitente = (process.env.SABORSAN_UF || 'SC').toUpperCase().trim();
        const crtEmitente = Number(process.env.SABORSAN_TAX_REGIME || 3);

        const checagemFiscal = validarRegrasFiscais({
          crt: crtEmitente,
          items,
          fiscalConfigs,
          fiscalMap: FISCAL_MAP,
          ufEmitente,
          ufDestinatario,
        });

        if (!checagemFiscal.valido) {
          return {
            status: 422,
            jsonBody: {
              status: 'FISCAL_RULES_ERROR',
              errorMessage: checagemFiscal.erros.join('\n'),
              errors: checagemFiscal.erros,
            },
          };
        }

        // ── Resolução do cBenef para itens com CST 41 ────────────────────────
        const { map: codigosBenef, erros: errosCBenef } = resolverCBenefParaItens({
          items,
          fiscalConfigs,
          fiscalMap: FISCAL_MAP,
          fiscalBenefits,
          ufEmitente,
        });

        if (errosCBenef.length > 0) {
          return {
            status: 422,
            jsonBody: {
              status: 'FISCAL_CONFIG_PENDING',
              errorMessage: errosCBenef.join('\n'),
              errors: errosCBenef,
            },
          };
        }

        // ── Valida IBS/CBS antes de qualquer outra coisa ─────────────────────
        const semIbsCbs = items.filter((item) => {
          const cfg = fiscalConfigs[item.productName.toLowerCase()];
          return !cfg || !cfg.ibsCbsCst;
        });
        if (semIbsCbs.length > 0) {
          const nomes = semIbsCbs.map((i) => `"${i.productName}"`).join(', ');
          return {
            status: 422,
            jsonBody: {
              status: 'VALIDATION_ERROR',
              errorMessage:
                `IBS/CBS não configurado para: ${nomes}. ` +
                'Acesse Configurações → Configuração Fiscal e preencha o CST e a Classificação Tributária de cada produto.',
            },
          };
        }

        // ── Consulta e validação fiscal do destinatário ──────────────────────
        // Prioridade: corpo da requisição > salvo no pedido > padrão 'consumo'
        const purchasePurpose = body.purchasePurpose || order.purchasePurpose || 'consumo';

        let stateRegistrationIndicator = 9;
        let stateRegistration = null;

        const cnpjNorm = digits(order.clientCnpj);
        if (cnpjNorm && cnpjNorm.length === 14) {
          // Busca cliente pelo CNPJ normalizado ou pelo nome
          const clientRes = await sql.query`
            SELECT TOP 1 id, stateRegistrationIndicator, stateRegistration,
                         nextFiscalLookupAt, requiresFiscalReview
            FROM Clients
            WHERE cnpjNormalized = ${cnpjNorm}
               OR (cnpjNormalized IS NULL AND REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.',''),'/',''),'-',''),' ','') = ${cnpjNorm})
               OR (cnpj IS NULL AND establishmentName = ${order.clientName})
          `;

          const clientRow = clientRes.recordset[0];

          if (clientRow) {
            const precisaConsultar =
              clientRow.stateRegistrationIndicator === null ||
              clientRow.stateRegistrationIndicator === undefined ||
              !clientRow.nextFiscalLookupAt ||
              new Date(clientRow.nextFiscalLookupAt) <= new Date() ||
              clientRow.requiresFiscalReview;

            if (precisaConsultar) {
              try {
                const clientUf = String(order.clientCity || '').includes(' - ')
                  ? order.clientCity.split(' - ').pop().trim()
                  : null;

                const focusRes = await focusRequest(`/v2/cnpjs/${cnpjNorm}`);
                const ieResult = extrairIEDaResposta(focusRes.data, clientUf);

                // Preserva IE anterior se a nova consulta não a encontrou
                const perdeuIE = clientRow.stateRegistrationIndicator === 1 && clientRow.stateRegistration && ieResult.stateRegistrationIndicator !== 1;
                const novoIndicador = perdeuIE ? clientRow.stateRegistrationIndicator : ieResult.stateRegistrationIndicator;
                const novaIE = perdeuIE ? clientRow.stateRegistration : ieResult.stateRegistration;
                const requerRevisao = perdeuIE ? 1 : 0;
                const proxima = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

                await sql.query`
                  UPDATE Clients SET
                    cnpjNormalized                  = ${cnpjNorm},
                    stateRegistrationIndicator      = ${novoIndicador},
                    stateRegistration               = ${novaIE},
                    stateRegistrationUF             = ${ieResult.stateRegistrationUF || null},
                    stateRegistrationStatus         = ${ieResult.stateRegistrationStatus || null},
                    lastFiscalLookupAt              = GETUTCDATE(),
                    lastFiscalLookupSuccessAt       = GETUTCDATE(),
                    nextFiscalLookupAt              = ${proxima},
                    fiscalLookupSource              = 'FOCUS_NFE',
                    lastFiscalLookupError           = NULL,
                    requiresFiscalReview            = ${requerRevisao},
                    fiscalLookupResponseJson        = ${JSON.stringify(focusRes.data)}
                  WHERE id = ${clientRow.id}
                `;

                stateRegistrationIndicator = novoIndicador;
                stateRegistration = novaIE;
              } catch (consultaErr) {
                // Focus indisponível: usa último dado válido se existir
                if (clientRow.stateRegistrationIndicator !== null && clientRow.stateRegistrationIndicator !== undefined) {
                  stateRegistrationIndicator = clientRow.stateRegistrationIndicator;
                  stateRegistration = clientRow.stateRegistration;
                }
                try {
                  const errMsg = String(consultaErr.message || 'Erro na consulta CNPJ').slice(0, 490);
                  await sql.query`
                    UPDATE Clients SET
                      lastFiscalLookupAt    = GETUTCDATE(),
                      lastFiscalLookupError = ${errMsg}
                    WHERE id = ${clientRow.id}
                  `;
                } catch (_) {}
              }
            } else {
              // Dados ainda válidos
              if (clientRow.stateRegistrationIndicator !== null && clientRow.stateRegistrationIndicator !== undefined) {
                stateRegistrationIndicator = clientRow.stateRegistrationIndicator;
                stateRegistration = clientRow.stateRegistration;
              }
            }
          }
        }

        // Bloqueia emissão quando a combinação indicador 9 + revenda geraria rejeição 696
        if (stateRegistrationIndicator === 9 && purchasePurpose === 'revenda') {
          return {
            status: 422,
            jsonBody: {
              status: 'VALIDATION_ERROR',
              errorMessage:
                'O destinatário está cadastrado como não contribuinte do ICMS, mas a compra foi ' +
                'informada como destinada à revenda ou industrialização. Confirme a finalidade da ' +
                'compra ou verifique se o cliente possui Inscrição Estadual antes de emitir a NF-e.',
            },
          };
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
        const payload = buildNfePayload(order, items, { stateRegistrationIndicator, stateRegistration, purchasePurpose, fiscalConfigs, codigosBenef });

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

          // Persiste o vínculo cBenef recém-resolvido para reutilização futura
          if (Object.keys(codigosBenef).length > 0) {
            for (const [prodName, cBenef] of Object.entries(codigosBenef)) {
              try {
                await new sql.Request()
                  .input('cBenef',   cBenef)
                  .input('prodName', prodName)
                  .query(`
                    UPDATE ProductFiscalConfig
                    SET codigoBeneficioFiscal = @cBenef, updatedAt = GETUTCDATE()
                    WHERE productName = @prodName
                      AND (codigoBeneficioFiscal IS NULL OR codigoBeneficioFiscal <> @cBenef)
                  `);
              } catch (_) { /* não quebrar o fluxo */ }
            }
          }

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
              SET status = N'Pronto', updatedAt = GETUTCDATE()
              WHERE id = ${orderId}
            `;
            await notifyDriverNfeAuthorized(orderId, context);
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
