'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const { OpenAI } = require('openai');
const fs = require('fs');
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

// ── Prompt mestre — regras do agente autônomo de NF-e ────────────────────────

const NFE_AGENT_MASTER_PROMPT = `PROMPT MESTRE V2 — AGENTE AUTÔNOMO DE NF-e
FOCUS NF-e + SEFAZ — TRATAMENTO ERRO POR ERRO

Objetivo:
Este prompt define o comportamento de uma IA responsável por pré-validar NF-e, interpretar o retorno da Focus/SEFAZ, localizar o cStat exato, corrigir autonomamente somente erros cuja solução seja comprovável com informações já disponíveis no sistema, revalidar a nota e tentar novamente sem criar duplicidades.

REGRA SUPREMA
A IA nunca deve inventar, estimar ou escolher arbitrariamente um dado fiscal para "fazer a nota passar".
Uma NF-e autorizada com dados falsos não é sucesso.

A IA só pode alterar um campo quando possuir evidência verificável do valor correto, obtida de:
- cadastro fiscal validado do produto;
- cadastro validado do cliente;
- cadastro/configuração do emitente;
- dados reais do pedido;
- documento fiscal referenciado existente;
- regra fiscal parametrizada e versionada;
- cálculo matemático determinístico;
- tabela oficial previamente integrada;
- mensagem da SEFAZ quando ela fornecer explicitamente valor esperado/calculado;
- retorno de API oficial previamente integrada e autorizada.

Se o valor correto não puder ser demonstrado:
status_decisao = REQUER_INTERVENCAO
reemitir = false

FLUXO DO AGENTE
1. Criar snapshot imutável do pedido/payload original.
2. Pré-validar emitente, destinatário, produtos, CFOP, NCM, CEST, CST/CSOSN, totais, pagamento, frete e campos vigentes de IBS/CBS.
3. Se houver rejeição SEFAZ, extrair cStat, xMotivo, nItem, nOcor e valores calculados/esperados.
4. Localizar a entrada exata do catálogo fornecido.
5. Executar a regra de resolução daquela entrada.
6. Registrar CHANGESET com valor anterior, valor novo, motivo, evidência e confiança.
7. Revalidar a NF-e inteira.
8. Antes de retransmitir, verificar se a ref já foi autorizada (idempotência).
9. Se rejeitada e a correção for válida: sinalizar para reenviar usando a mesma referência.
10. Confirmar autorização.

IDEMPOTÊNCIA
A Focus informa que uma ref é única no escopo do token.
Se a emissão falhar antes da autorização, em geral a mesma ref pode ser reutilizada após corrigir o payload.
Depois de autorizada, a ref fica vinculada ao documento e não pode ser usada para uma nova emissão.

LIMITES
MAX_CORRECOES_SEQUENCIAIS = 5
MAX_REPETICOES_MESMO_CSTAT_XMOTIVO = 2

Se a mesma rejeição persistir duas vezes após uma correção:
- interromper;
- não continuar tentando combinações;
- registrar REQUER_INTERVENCAO.

NÍVEL DE CONFIANÇA
1.00 = cálculo/regra determinística.
0.95 = dado validado + regra inequívoca.
0.80–0.94 = múltiplas regras parametrizadas convergentes.
<0.80 = não executar automaticamente alteração tributária classificatória.

REFORMA TRIBUTÁRIA — REGRA DINÂMICA
Em 2026 as validações de IBS/CBS devem ser tratadas com tabela versionada e documentação vigente da NT 2025.002.
Não escolha CST IBS/CBS, cClassTrib, crédito presumido, diferimento, redução ou benefício por inferência aberta.

FORMATO DE RESPOSTA (JSON obrigatório — nenhum texto fora do JSON):
{
  "status_decisao": "CORRIGIR_E_REEMITIR | CONSULTAR | AGUARDAR | AUTORIZADO | REQUER_INTERVENCAO | FALHA_FINAL",
  "codigo": "cStat",
  "mensagem_real": "xMotivo",
  "categoria": "...",
  "correcao_automatica": true,
  "campo_afetado": "...",
  "valor_anterior": null,
  "valor_novo": null,
  "evidencias": [],
  "confianca": 0.0,
  "revalidacao_ok": false,
  "reemitir": false,
  "usar_mesma_ref": true,
  "motivo_bloqueio": null,
  "payload_corrigido": null
}

Quando status_decisao = "CORRIGIR_E_REEMITIR", o campo "payload_corrigido" deve conter o payload JSON completo corrigido que será enviado à Focus NF-e.
Quando status_decisao != "CORRIGIR_E_REEMITIR", "payload_corrigido" deve ser null.`;

// ── Catálogo de cStat — carregado do arquivo externo ou do fallback embutido ──

let _catalogCache = null;

function parseCatalog(text) {
  const entries = {};
  const separator = '----------------------------------------------------------------------';
  const sections = text.split(separator);
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^cStat\s+(\d+)/);
    if (!match) continue;
    const cStat = match[1];
    entries[cStat] = trimmed;
  }
  return entries;
}

function loadCatalog() {
  if (_catalogCache) return _catalogCache;
  const catalogPath = process.env.NFE_AI_CATALOG_PATH || 'C:\\Link\\prompt ia autonoma nfe.txt';
  try {
    const content = fs.readFileSync(catalogPath, 'utf8');
    const catalogStart = content.indexOf('CATÁLOGO OPERACIONAL');
    if (catalogStart !== -1) {
      _catalogCache = parseCatalog(content.substring(catalogStart));
    } else {
      _catalogCache = parseCatalog(content);
    }
  } catch {
    _catalogCache = {};
  }
  return _catalogCache;
}

function getCatalogEntry(cStat) {
  if (!cStat) return null;
  const catalog = loadCatalog();
  return catalog[String(cStat).trim()] || null;
}

// ── Focus NF-e helpers ────────────────────────────────────────────────────────

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
    if (!res.ok) throw Object.assign(new Error(`Focus NFe HTTP ${res.status}`), { httpStatus: res.status, data });
    return { httpStatus: res.status, data };
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error('Tempo limite ao chamar a Focus NFe'), { isTimeout: true });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function mapFocusStatus(response) {
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
    return {
      status: 'REJECTED',
      errorCode: sefazCode,
      errorMessage: response.mensagem_sefaz || response.mensagem || (Array.isArray(response.erros) ? response.erros.map((e) => e.mensagem).join('; ') : ''),
    };
  }
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
  if (raw.includes('cancel')) return { status: 'CANCELLED' };
  if (raw.includes('erro') || raw.includes('rejeit')) {
    return {
      status: 'REJECTED',
      errorCode: '',
      errorMessage: response.mensagem_sefaz || response.mensagem || (Array.isArray(response.erros) ? response.erros.map((e) => e.mensagem).join('; ') : ''),
    };
  }
  return { status: 'MANUAL_REVIEW' };
}

function createNfeReference(fiscalDocumentId) {
  const normalized = String(fiscalDocumentId).replace(/[^a-zA-Z0-9]/g, '');
  if (!normalized) throw new Error('Não foi possível gerar referência da NF-e');
  return `NFE${normalized}`.toUpperCase();
}

// ── Fiscal helpers ────────────────────────────────────────────────────────────

const FISCAL_MAP = {
  'Pão de Queijo Tradicional': { ncm: '19059090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Mini Pizza Congelada':      { ncm: '19012000', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Açaí Premium Balde':        { ncm: '20089200', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Croissant Folhado':         { ncm: '19059090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Mix de Salgados':           { ncm: '21069090', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
  'Polpas de Frutas Sortidas': { ncm: '20089900', cfop: '5102', icmsCst: '00', icmsOrigin: 0, pisCST: '01', cofinsCST: '01', icmsAliq: 12, pisAliq: 0.65, cofinsAliq: 3.0, ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0 },
};

const DEFAULT_FISCAL = {
  ncm: '21069090', cfop: '5102', icmsCst: '41', icmsOrigin: 0,
  pisCST: '07', cofinsCST: '07', icmsAliq: 0, pisAliq: 0, cofinsAliq: 0,
  ibsCbsCst: null, ibsCbsClassTrib: null, ibsCbsAliqUF: 0, ibsCbsAliqMun: 0, ibsCbsAliqCbs: 0, ibsCbsReducaoAliq: 0,
};

function round2(v) { return Number(Number(v ?? 0).toFixed(2)); }
function round4(v) { return Number(Number(v ?? 0).toFixed(4)); }
function digits(v) { return v ? String(v).replace(/\D/g, '') : undefined; }

const IBS_UF_ALIQ_DEFAULT  = Number(process.env.IBS_2026_UF_ALIQ  ?? 0.1);
const IBS_MUN_ALIQ_DEFAULT = Number(process.env.IBS_2026_MUN_ALIQ ?? 0);
const CBS_ALIQ_DEFAULT     = Number(process.env.IBS_2026_CBS_ALIQ  ?? 0.9);

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
    for (const row of result.recordset) map[row.productName.toLowerCase()] = row;
    return map;
  } catch { return {}; }
}

async function loadFiscalBenefits() {
  try {
    const result = await sql.query`SELECT codigo, uf, cstsPermitidos, aplicavelSimples, inicioVigencia, fimVigencia, ativo FROM FiscalBenefits WHERE ativo = 1`;
    return result.recordset;
  } catch { return []; }
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
    const f = dbCfg ? { ...base, ...dbCfg } : base;
    const gross = round2(item.quantity * item.unitPrice);
    const icmsBase = gross;
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

    // cBenef obrigatório quando resolvido para o CST do produto (independente do valor do CST)
    const cBenef = codigosBenef[item.productName];
    if (cBenef) itemObj.codigo_beneficio_fiscal = cBenef;

    if (String(f.icmsCst).trim() === '00') {
      const icmsAliqEfetiva = Number(f.icmsAliq) > 0 ? Number(f.icmsAliq) : (Number(base.icmsAliq) || 0);
      Object.assign(itemObj, {
        icms_modalidade_base_calculo: 3,
        icms_base_calculo: icmsBase,
        icms_aliquota: icmsAliqEfetiva,
        icms_valor: round2(icmsBase * icmsAliqEfetiva / 100),
      });
    }

    itemObj.pis_situacao_tributaria = f.pisCST;
    if (f.pisAliq > 0) Object.assign(itemObj, { pis_base_calculo: gross, pis_aliquota_percentual: f.pisAliq, pis_valor: pisVal });
    itemObj.cofins_situacao_tributaria = f.cofinsCST;
    if (f.cofinsAliq > 0) Object.assign(itemObj, { cofins_base_calculo: gross, cofins_aliquota_percentual: f.cofinsAliq, cofins_valor: cofinsVal });

    if (f.ibsCbsCst) {
      const reducao = Number(f.ibsCbsReducaoAliq) || 0;
      const fator = reducao > 0 ? (1 - reducao / 100) : 1;
      const ibsUfAliq = Number(f.ibsCbsAliqUF) || IBS_UF_ALIQ_DEFAULT;
      const ibsMunAliq = Number(f.ibsCbsAliqMun) > 0 ? Number(f.ibsCbsAliqMun) : IBS_MUN_ALIQ_DEFAULT;
      const cbsAliq = Number(f.ibsCbsAliqCbs) || CBS_ALIQ_DEFAULT;
      const ibsUfEfetiva = round4(ibsUfAliq * fator);
      const ibsMunEfetiva = round4(ibsMunAliq * fator);
      const cbsEfetiva = round4(cbsAliq * fator);
      Object.assign(itemObj, {
        ibs_cbs_situacao_tributaria: f.ibsCbsCst,
        ibs_cbs_classificacao_tributaria: f.ibsCbsClassTrib,
        ibs_cbs_base_calculo: gross,
        ibs_uf_aliquota: ibsUfAliq,
        ...(reducao > 0 ? { ibs_uf_percentual_reducao_aliquota: reducao } : {}),
        ibs_uf_aliquota_efetiva: ibsUfEfetiva,
        ibs_uf_valor: round2(gross * ibsUfEfetiva / 100),
        ibs_mun_aliquota: ibsMunAliq,
        ...(reducao > 0 ? { ibs_mun_percentual_reducao_aliquota: reducao } : {}),
        ibs_mun_aliquota_efetiva: ibsMunEfetiva,
        ibs_mun_valor: round2(gross * ibsMunEfetiva / 100),
        ibs_valor_total: round2(gross * ibsUfEfetiva / 100) + round2(gross * ibsMunEfetiva / 100),
        cbs_aliquota: cbsAliq,
        ...(reducao > 0 ? { cbs_percentual_reducao_aliquota: reducao } : {}),
        cbs_aliquota_efetiva: cbsEfetiva,
        cbs_valor: round2(gross * cbsEfetiva / 100),
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

// ── Notificações ──────────────────────────────────────────────────────────────

async function notifyDriverNfeAuthorized(orderId, context) {
  try {
    const deliveryResult = await sql.query`
      SELECT d.id AS deliveryId, d.seller_id, d.code AS deliveryCode
      FROM Deliveries d
      INNER JOIN DeliveryOrders dord ON dord.delivery_id = d.id
      WHERE dord.order_id = ${orderId} AND d.status NOT IN (N'Cancelada', N'Concluída')
    `;
    if (!deliveryResult.recordset.length) return;
    const { deliveryId, seller_id: sellerId, deliveryCode } = deliveryResult.recordset[0];

    const pendingResult = await sql.query`
      SELECT dord.order_id FROM DeliveryOrders dord WHERE dord.delivery_id = ${deliveryId}
      AND NOT EXISTS (SELECT 1 FROM GestaoFiscalDocuments fd WHERE fd.orderId = dord.order_id AND fd.status = 'AUTHORIZED')
    `;
    if (pendingResult.recordset.length > 0) return;

    const sellerResult = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerResult.recordset.length) return;
    const { userId } = sellerResult.recordset[0];

    const allOrdersResult = await sql.query`SELECT dord.order_id AS orderId FROM DeliveryOrders dord WHERE dord.delivery_id = ${deliveryId}`;
    const allOrderIds = allOrdersResult.recordset.map((r) => r.orderId);
    const isMultiple = allOrderIds.length > 1;

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;

    const messaging = getMessaging();
    const msgTitle = isMultiple ? `Notas fiscais da entrega ${deliveryCode} emitidas` : `Nota fiscal do pedido ${orderId} emitida`;
    const msgBody = isMultiple
      ? `Todas as NF-e da entrega ${deliveryCode} foram autorizadas pelo SEFAZ.`
      : `A NF-e do pedido ${orderId} (entrega ${deliveryCode}) foi autorizada pelo SEFAZ.`;

    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title: msgTitle, body: msgBody },
          data: { type: 'nfe-confirmations', deliveryId: String(deliveryId), deliveryCode: String(deliveryCode), orderId: String(orderId) },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
        }
      }
    }
  } catch (err) {
    context?.error('[auto-nfe] notifyDriverNfeAuthorized:', err);
  }
}

async function notifySellerAboutNfeError(sellerId, orderId, errorMessage, context) {
  if (!sellerId) return;
  try {
    const sellerResult = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerResult.recordset.length) return;
    const { userId } = sellerResult.recordset[0];

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;

    const messaging = getMessaging();
    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: {
            title: `Erro na NF-e do pedido ${orderId}`,
            body: `Erro ao emitir nota fiscal: ${String(errorMessage || '').slice(0, 200)}. Verificação manual necessária.`,
          },
          data: { type: 'nfe-error', orderId: String(orderId) },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
        }
      }
    }
  } catch (err) {
    context?.error('[auto-nfe] notifySellerAboutNfeError:', err);
  }
}

// ── Impressão DANFE ───────────────────────────────────────────────────────────

async function loadDevicePrinters() {
  try {
    const result = await sql.query`SELECT TOP 1 defaultPrinter, defaultThermalPrinter FROM DeviceSettings ORDER BY id ASC`;
    if (!result.recordset.length) return { defaultPrinter: null, defaultThermalPrinter: null };
    return {
      defaultPrinter: result.recordset[0].defaultPrinter || null,
      defaultThermalPrinter: result.recordset[0].defaultThermalPrinter || null,
    };
  } catch {
    return { defaultPrinter: null, defaultThermalPrinter: null };
  }
}

async function printDanfe(reference, context) {
  if (process.platform !== 'win32') return;
  try {
    const { print } = (await import('pdf-to-printer').catch(() => null))?.default || {};
    if (!print) return;
    const { baseUrl, token } = getFocusConfig();
    const res = await fetch(`${baseUrl}/v2/nfe/${encodeURIComponent(reference)}.pdf`, {
      headers: { Authorization: createBasicAuth(token) },
    });
    if (!res.ok) return;
    const pdfBuffer = Buffer.from(await res.arrayBuffer());
    const os = require('os');
    const path = require('path');
    const tempPath = path.join(os.tmpdir(), `auto_danfe_${Date.now()}_${reference.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.pdf`);
    require('fs').writeFileSync(tempPath, pdfBuffer);

    const { defaultPrinter, defaultThermalPrinter } = await loadDevicePrinters();

    // Collect distinct configured printers; fall back to OS default if none configured
    const printers = [];
    if (defaultPrinter) printers.push(defaultPrinter);
    if (defaultThermalPrinter && defaultThermalPrinter !== defaultPrinter) printers.push(defaultThermalPrinter);

    if (printers.length === 0) {
      await print(tempPath);
    } else {
      for (const printerName of printers) {
        await print(tempPath, { printer: printerName });
      }
    }

    try { require('fs').unlinkSync(tempPath); } catch (_) {}
  } catch (err) {
    context?.error('[auto-nfe] printDanfe error:', err);
  }
}

// ── IA: analisar e tentar corrigir payload de NF-e rejeitada ──────────────────

async function aiAnalyzeAndFix({ orderId, errorCode, errorMessage, originalPayload, orderData, items, fiscalConfigs }, context) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    context?.log('[auto-nfe] OPENAI_API_KEY não configurada — correção por IA ignorada');
    return null;
  }
  const openai = new OpenAI({ apiKey });

  const catalogEntry = getCatalogEntry(errorCode);
  const catalogSection = catalogEntry
    ? `\n\nENTRADA DO CATÁLOGO PARA cStat ${errorCode}:\n${catalogEntry}`
    : `\n\n(Nenhuma entrada específica no catálogo para cStat ${errorCode} — use o xMotivo real como fonte operacional)`;

  const systemPrompt = NFE_AGENT_MASTER_PROMPT + catalogSection;

  const userMessage = `
Erro recebido da NF-e do pedido ${orderId}:
- cStat: ${errorCode || 'desconhecido'}
- xMotivo: ${errorMessage || 'sem mensagem'}

Dados do pedido:
${JSON.stringify(orderData, null, 2)}

Itens do pedido:
${JSON.stringify(items, null, 2)}

Configurações fiscais dos produtos:
${JSON.stringify(fiscalConfigs, null, 2)}

Payload enviado à Focus NF-e:
${JSON.stringify(originalPayload, null, 2)}

Com base no erro, no catálogo e nos dados acima, analise e retorne o JSON de decisão conforme o formato definido.
Se puder corrigir automaticamente, inclua o "payload_corrigido" completo.
Se não puder corrigir com certeza, defina status_decisao = "REQUER_INTERVENCAO" e payload_corrigido = null.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    try {
      return JSON.parse(raw);
    } catch {
      context?.error('[auto-nfe] IA retornou JSON inválido:', raw.slice(0, 500));
      return null;
    }
  } catch (err) {
    context?.error('[auto-nfe] Erro ao chamar OpenAI:', err);
    return null;
  }
}

// ── Emissão de uma nota fiscal para um pedido ─────────────────────────────────

async function emitirNfeParaPedido(orderId, context) {
  const [orderRes, itemsRes] = await Promise.all([
    sql.query`SELECT id, clientName, clientCnpj, clientCity, clientPhone, status, totalValue, purchasePurpose FROM GestaoOrders WHERE id = ${orderId}`,
    sql.query`SELECT productName, quantity, unit, unitPrice FROM GestaoOrderItems WHERE orderId = ${orderId} ORDER BY id ASC`,
  ]);

  const order = orderRes.recordset[0];
  if (!order) return { success: false, error: 'Pedido não encontrado', orderId };

  const items = itemsRes.recordset.map((i) => ({
    productName: i.productName,
    quantity: Number(i.quantity),
    unit: i.unit,
    unitPrice: Number(i.unitPrice || 0),
  }));
  if (!items.length) return { success: false, error: 'Pedido sem itens', orderId };

  const [fiscalConfigs, fiscalBenefits] = await Promise.all([loadFiscalConfigs(), loadFiscalBenefits()]);

  // Verificação rápida de IBS/CBS
  const semIbsCbs = items.filter((item) => {
    const cfg = fiscalConfigs[item.productName.toLowerCase()];
    return !cfg || !cfg.ibsCbsCst;
  });
  if (semIbsCbs.length > 0) {
    const nomes = semIbsCbs.map((i) => `"${i.productName}"`).join(', ');
    return { success: false, error: `IBS/CBS não configurado para: ${nomes}`, orderId, skipRetry: true };
  }

  const ufEmitente = (process.env.SABORSAN_UF || 'SC').toUpperCase().trim();
  const cityStrFiscal = String(order.clientCity || '').trim();
  const ufDestinatario = cityStrFiscal.includes(' - ') ? cityStrFiscal.split(' - ').pop().trim() : 'SC';
  const crtEmitente = Number(process.env.SABORSAN_TAX_REGIME || 3);

  const checagemFiscal = validarRegrasFiscais({ crt: crtEmitente, items, fiscalConfigs, fiscalMap: FISCAL_MAP, ufEmitente, ufDestinatario });
  if (!checagemFiscal.valido) {
    return { success: false, error: checagemFiscal.erros.join('\n'), orderId, skipRetry: true };
  }

  const { map: codigosBenef, erros: errosCBenef } = resolverCBenefParaItens({ items, fiscalConfigs, fiscalMap: FISCAL_MAP, fiscalBenefits, ufEmitente });
  if (errosCBenef.length > 0) {
    return { success: false, error: errosCBenef.join('\n'), orderId, skipRetry: true };
  }

  // Verifica se já existe doc ativo
  const existingRes = await sql.query`
    SELECT id, status, focusReference, nfeNumber, nfeSeries, accessKey, protocol
    FROM GestaoFiscalDocuments WHERE orderId = ${orderId} AND status IN ('AUTHORIZED', 'PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')
  `;
  if (existingRes.recordset.length > 0) {
    const ex = existingRes.recordset[0];
    if (ex.status === 'AUTHORIZED') return { success: true, orderId, reference: ex.focusReference, alreadyAuthorized: true };
    return { success: false, error: `NF-e em processamento (${ex.status})`, orderId, reference: ex.focusReference };
  }

  const purchasePurpose = order.purchasePurpose || 'consumo';
  let stateRegistrationIndicator = 9;
  let stateRegistration = null;
  const cnpjNorm = digits(order.clientCnpj);
  if (cnpjNorm && cnpjNorm.length === 14) {
    try {
      const clientRes = await sql.query`
        SELECT TOP 1 stateRegistrationIndicator, stateRegistration FROM Clients
        WHERE cnpjNormalized = ${cnpjNorm} OR (cnpjNormalized IS NULL AND establishmentName = ${order.clientName})
      `;
      if (clientRes.recordset.length > 0 && clientRes.recordset[0].stateRegistrationIndicator !== null) {
        stateRegistrationIndicator = clientRes.recordset[0].stateRegistrationIndicator;
        stateRegistration = clientRes.recordset[0].stateRegistration;
      }
    } catch (_) {}
  }

  // E16a-40: não contribuinte (9) não pode ter operação de revenda (violaria indFinal=0)
  if (stateRegistrationIndicator === 9 && purchasePurpose === 'revenda') {
    return {
      success: false,
      error:
        'O destinatário está cadastrado como não contribuinte do ICMS, mas a compra foi ' +
        'informada como destinada à revenda ou industrialização. Confirme a finalidade da ' +
        'compra ou verifique se o cliente possui Inscrição Estadual antes de emitir a NF-e.',
      orderId,
    };
  }

  const env = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'HOMOLOGATION';
  const createRes = await sql.query`
    INSERT INTO GestaoFiscalDocuments (orderId, environment, status) OUTPUT INSERTED.id VALUES (${orderId}, ${env}, 'SUBMITTING')
  `;
  const docId = createRes.recordset[0].id;
  const reference = createNfeReference(docId);
  const payload = buildNfePayload(order, items, { stateRegistrationIndicator, stateRegistration, purchasePurpose, fiscalConfigs, codigosBenef });

  await sql.query`
    UPDATE GestaoFiscalDocuments SET focusReference = ${reference}, requestPayload = ${JSON.stringify(payload)}, issuedAt = GETUTCDATE(), updatedAt = GETUTCDATE() WHERE id = ${docId}
  `;

  try {
    const focusRes = await focusRequest(`/v2/nfe?ref=${encodeURIComponent(reference)}`, { method: 'POST', body: payload });
    const mapped = mapFocusStatus(focusRes.data);

    if (mapped.status === 'AUTHORIZED') {
      await sql.query`
        UPDATE GestaoFiscalDocuments SET status = 'AUTHORIZED', nfeNumber = ${mapped.number || null}, nfeSeries = ${mapped.series || null},
        accessKey = ${mapped.accessKey || null}, protocol = ${mapped.protocol || null}, xmlPath = ${mapped.xmlPath || null},
        danfePath = ${mapped.danfePath || null}, authorizedAt = GETUTCDATE(), responsePayload = ${JSON.stringify(focusRes.data)}, updatedAt = GETUTCDATE()
        WHERE id = ${docId}
      `;
      await sql.query`UPDATE GestaoOrders SET status = N'Pronto', updatedAt = GETUTCDATE() WHERE id = ${orderId}`;
      await notifyDriverNfeAuthorized(orderId, context);
      return { success: true, orderId, reference, authorized: true };
    }

    await sql.query`UPDATE GestaoFiscalDocuments SET status = 'PROCESSING', responsePayload = ${JSON.stringify(focusRes.data)}, updatedAt = GETUTCDATE() WHERE id = ${docId}`;
    return { success: false, error: 'NF-e em processamento', orderId, reference, docId, processing: true };
  } catch (focusErr) {
    const isDataError = focusErr.httpStatus === 400 || focusErr.httpStatus === 422;
    const docStatus = isDataError ? 'REJECTED' : 'SUBMISSION_FAILED';
    const errCode = String(focusErr.httpStatus || 'ERR');
    const errMsg = (() => {
      if (!focusErr.data) return focusErr.message || 'Erro desconhecido';
      if (typeof focusErr.data === 'string') return focusErr.data;
      if (Array.isArray(focusErr.data?.erros)) return focusErr.data.erros.map((e) => e.mensagem).join('; ');
      return focusErr.data?.mensagem || JSON.stringify(focusErr.data);
    })();
    const sefazCode = String(focusErr.data?.status_sefaz || '').trim();

    await sql.query`
      UPDATE GestaoFiscalDocuments SET status = ${docStatus}, errorCode = ${sefazCode || errCode},
      errorMessage = ${errMsg}, responsePayload = ${JSON.stringify(focusErr.data || {})}, updatedAt = GETUTCDATE()
      WHERE id = ${docId}
    `;

    return { success: false, error: errMsg, errorCode: sefazCode || errCode, orderId, reference, docId, payload, order, items, fiscalConfigs, rejected: isDataError };
  }
}

// ── Polling de NF-e em processamento ─────────────────────────────────────────

async function pollProcessingNfe(reference, docId, orderId, context) {
  const maxPolls = 10;
  const pollInterval = 3000;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));
    try {
      const focusRes = await focusRequest(`/v2/nfe/${encodeURIComponent(reference)}?completa=1`);
      const mapped = mapFocusStatus(focusRes.data);
      if (mapped.status === 'AUTHORIZED') {
        await sql.query`
          UPDATE GestaoFiscalDocuments SET status = 'AUTHORIZED', nfeNumber = ${mapped.number || null}, nfeSeries = ${mapped.series || null},
          accessKey = ${mapped.accessKey || null}, protocol = ${mapped.protocol || null}, xmlPath = ${mapped.xmlPath || null},
          danfePath = ${mapped.danfePath || null}, authorizedAt = GETUTCDATE(), responsePayload = ${JSON.stringify(focusRes.data)}, updatedAt = GETUTCDATE()
          WHERE id = ${docId}
        `;
        await sql.query`UPDATE GestaoOrders SET status = N'Pronto', updatedAt = GETUTCDATE() WHERE id = ${orderId}`;
        await notifyDriverNfeAuthorized(orderId, context);
        return { authorized: true };
      }
      if (mapped.status === 'REJECTED') {
        await sql.query`
          UPDATE GestaoFiscalDocuments SET status = 'REJECTED', errorCode = ${mapped.errorCode || null}, errorMessage = ${mapped.errorMessage || null},
          responsePayload = ${JSON.stringify(focusRes.data)}, updatedAt = GETUTCDATE() WHERE id = ${docId}
        `;
        return { rejected: true, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    } catch (_) {}
  }
  return { timeout: true };
}

// ── Progresso em tempo real ───────────────────────────────────────────────────

async function migrateNfeProgressColumns() {
  const cols = ['nfe_is_running BIT NOT NULL DEFAULT 0', 'nfe_current_step NVARCHAR(500) NULL', 'nfe_run_total INT NULL', 'nfe_run_done INT NULL', 'nfe_run_started_at DATETIME NULL'];
  const names = ['nfe_is_running', 'nfe_current_step', 'nfe_run_total', 'nfe_run_done', 'nfe_run_started_at'];
  for (let i = 0; i < names.length; i++) {
    await sql.query(`IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = '${names[i]}') ALTER TABLE AutomationConfig ADD ${cols[i]}`).catch(() => {});
  }
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationRunLog')
    CREATE TABLE AutomationRunLog (id INT PRIMARY KEY IDENTITY, automation_key NVARCHAR(100) NOT NULL, result_message NVARCHAR(500), created_at DATETIME DEFAULT GETUTCDATE())
  `.catch(() => {});
}

async function setNfeProgress(step, { total = null, done = null, isRunning = true, startNew = false } = {}) {
  try {
    if (startNew) {
      await sql.query`UPDATE AutomationConfig SET nfe_is_running=1, nfe_current_step=${step}, nfe_run_total=${total}, nfe_run_done=${done}, nfe_run_started_at=GETUTCDATE(), updated_at=GETUTCDATE() WHERE automation_key='generate_nfe'`;
    } else {
      await sql.query`UPDATE AutomationConfig SET nfe_is_running=${isRunning?1:0}, nfe_current_step=${step}, nfe_run_total=${total}, nfe_run_done=${done}, updated_at=GETUTCDATE() WHERE automation_key='generate_nfe'`;
    }
  } catch (_) {}
}

// ── Lógica principal da automação ─────────────────────────────────────────────

async function runAutoNfe(context) {
  await sql.connect(sqlConfig);
  await migrateNfeProgressColumns();

  // Carrega config da automação
  const cfgResult = await sql.query`
    SELECT is_active, nfe_notify_on_error, nfe_notify_seller_id, nfe_print_danfe_auto,
           time_interval_minutes, time_start, time_end
    FROM AutomationConfig WHERE automation_key = 'generate_nfe'
  `.catch(() => ({ recordset: [] }));

  if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) {
    return { skipped: true, reason: 'Automação não está ativa.' };
  }

  const cfg = cfgResult.recordset[0];
  const notifyOnError = !!cfg.nfe_notify_on_error;
  const notifySellerId = cfg.nfe_notify_seller_id;
  const printDanfeAuto = !!cfg.nfe_print_danfe_auto;

  // Check time window
  const now = new Date();
  const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const currentTime = `${String(nowBRT.getHours()).padStart(2, '0')}:${String(nowBRT.getMinutes()).padStart(2, '0')}`;
  if (cfg.time_start && cfg.time_end) {
    if (currentTime < cfg.time_start || currentTime > cfg.time_end) {
      return { skipped: true, reason: 'Fora do horário configurado.' };
    }
  }

  // Busca pedidos Pronto sem NF-e autorizada ou com SUBMISSION_FAILED
  const pendingOrdersResult = await sql.query`
    SELECT DISTINCT o.id AS orderId
    FROM GestaoOrders o
    WHERE o.status = N'Pronto'
      AND o.deletedAt IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM GestaoFiscalDocuments fd
        WHERE fd.orderId = o.id AND fd.status IN ('AUTHORIZED', 'PROCESSING', 'SUBMITTING', 'MANUAL_REVIEW')
      )
      AND (
        EXISTS (
          SELECT 1 FROM GestaoFiscalDocuments fd2
          WHERE fd2.orderId = o.id AND fd2.status = 'SUBMISSION_FAILED'
        )
        OR NOT EXISTS (
          SELECT 1 FROM GestaoFiscalDocuments fd3 WHERE fd3.orderId = o.id
        )
      )
    ORDER BY o.id ASC
  `;

  const pendingOrders = pendingOrdersResult.recordset;
  if (!pendingOrders.length) {
    return { skipped: true, reason: 'Nenhum pedido pendente.' };
  }

  context?.log(`[auto-nfe] Processando ${pendingOrders.length} pedido(s)...`);
  await setNfeProgress(`Encontrado(s) ${pendingOrders.length} pedido(s) para emitir NF-e...`, { total: pendingOrders.length, done: 0, startNew: true });

  const successOrders = [];
  const failedOrders = [];

  for (const [idx, { orderId }] of pendingOrders.entries()) {
    await setNfeProgress(`Emitindo NF-e do pedido #${orderId}...`, { total: pendingOrders.length, done: idx });
    try {
      const result = await emitirNfeParaPedido(orderId, context);

      if (result.success || result.alreadyAuthorized) {
        successOrders.push(orderId);
        if (printDanfeAuto && result.reference) {
          await printDanfe(result.reference, context).catch(() => {});
        }
      } else if (result.processing && result.reference) {
        // Tenta polling para aguardar autorização
        await setNfeProgress(`Aguardando autorização SEFAZ do pedido #${orderId}...`, { total: pendingOrders.length, done: idx });
        const pollResult = await pollProcessingNfe(result.reference, result.docId, orderId, context);
        if (pollResult.authorized) {
          successOrders.push(orderId);
          if (printDanfeAuto && result.reference) await printDanfe(result.reference, context).catch(() => {});
        } else {
          failedOrders.push({ orderId, errorCode: pollResult.errorCode, error: pollResult.errorMessage || 'Timeout aguardando autorização', payload: null, order: null, items: null, fiscalConfigs: null });
        }
      } else if (!result.skipRetry) {
        failedOrders.push({ orderId, errorCode: result.errorCode, error: result.error, payload: result.payload, order: result.order, items: result.items, fiscalConfigs: result.fiscalConfigs });
      }
    } catch (err) {
      context?.error(`[auto-nfe] Erro ao processar pedido ${orderId}:`, err);
      failedOrders.push({ orderId, error: err.message, errorCode: null, payload: null, order: null, items: null, fiscalConfigs: null });
    }
  }

  // Tenta corrigir pedidos que falharam com rejeição SEFAZ usando IA
  const aiResolvedOrders = [];
  const needsIntervention = [];

  for (const failed of failedOrders) {
    if (!failed.payload || !failed.order || !failed.items) {
      needsIntervention.push(failed);
      continue;
    }

    if (notifyOnError) {
      // Modo: notificar funcionário — não tenta correção por IA
      needsIntervention.push(failed);
      if (notifySellerId) {
        await notifySellerAboutNfeError(notifySellerId, failed.orderId, failed.error, context).catch(() => {});
      }
      continue;
    }

    // Modo: IA tenta corrigir
    context?.log(`[auto-nfe] Tentando correção IA para pedido ${failed.orderId} (cStat ${failed.errorCode})...`);
    await setNfeProgress(`IA analisando e corrigindo erro da NF-e do pedido #${failed.orderId} (cStat ${failed.errorCode || '?'})...`, { total: pendingOrders.length, done: successOrders.length });
    try {
      const aiDecision = await aiAnalyzeAndFix({
        orderId: failed.orderId,
        errorCode: failed.errorCode,
        errorMessage: failed.error,
        originalPayload: failed.payload,
        orderData: failed.order,
        items: failed.items,
        fiscalConfigs: failed.fiscalConfigs,
      }, context);

      if (!aiDecision) {
        needsIntervention.push(failed);
        continue;
      }

      context?.log(`[auto-nfe] IA decidiu: ${aiDecision.status_decisao} (confiança: ${aiDecision.confianca})`);

      if (aiDecision.status_decisao === 'CORRIGIR_E_REEMITIR' && aiDecision.payload_corrigido && aiDecision.reemitir && Number(aiDecision.confianca || 0) >= 0.80) {
        await setNfeProgress(`Reemitindo NF-e corrigida pela IA para o pedido #${failed.orderId}...`, { total: pendingOrders.length, done: successOrders.length });
        // Marca o doc anterior como superado
        try {
          await sql.query`
            UPDATE GestaoFiscalDocuments SET status = 'SUBMISSION_FAILED', updatedAt = GETUTCDATE()
            WHERE orderId = ${failed.orderId} AND status IN ('REJECTED', 'SUBMISSION_FAILED')
          `;
        } catch (_) {}

        // Reenvia com payload corrigido
        const env = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'HOMOLOGATION';
        const createRes2 = await sql.query`
          INSERT INTO GestaoFiscalDocuments (orderId, environment, status) OUTPUT INSERTED.id VALUES (${failed.orderId}, ${env}, 'SUBMITTING')
        `;
        const docId2 = createRes2.recordset[0].id;
        const reference2 = createNfeReference(docId2);

        await sql.query`
          UPDATE GestaoFiscalDocuments SET focusReference = ${reference2}, requestPayload = ${JSON.stringify(aiDecision.payload_corrigido)}, issuedAt = GETUTCDATE(), updatedAt = GETUTCDATE() WHERE id = ${docId2}
        `;

        try {
          const focusRes2 = await focusRequest(`/v2/nfe?ref=${encodeURIComponent(reference2)}`, { method: 'POST', body: aiDecision.payload_corrigido });
          const mapped2 = mapFocusStatus(focusRes2.data);

          if (mapped2.status === 'AUTHORIZED') {
            await sql.query`
              UPDATE GestaoFiscalDocuments SET status = 'AUTHORIZED', nfeNumber = ${mapped2.number || null}, nfeSeries = ${mapped2.series || null},
              accessKey = ${mapped2.accessKey || null}, protocol = ${mapped2.protocol || null}, xmlPath = ${mapped2.xmlPath || null},
              danfePath = ${mapped2.danfePath || null}, authorizedAt = GETUTCDATE(), responsePayload = ${JSON.stringify(focusRes2.data)}, updatedAt = GETUTCDATE()
              WHERE id = ${docId2}
            `;
            await sql.query`UPDATE GestaoOrders SET status = N'Pronto', updatedAt = GETUTCDATE() WHERE id = ${failed.orderId}`;
            await notifyDriverNfeAuthorized(failed.orderId, context);
            aiResolvedOrders.push(failed.orderId);
            if (printDanfeAuto) await printDanfe(reference2, context).catch(() => {});
          } else if (mapped2.status === 'PROCESSING') {
            await sql.query`UPDATE GestaoFiscalDocuments SET status = 'PROCESSING', responsePayload = ${JSON.stringify(focusRes2.data)}, updatedAt = GETUTCDATE() WHERE id = ${docId2}`;
            aiResolvedOrders.push(failed.orderId); // Considerado em processo
          } else {
            const errMsg2 = focusRes2.data?.mensagem_sefaz || focusRes2.data?.mensagem || JSON.stringify(focusRes2.data);
            await sql.query`
              UPDATE GestaoFiscalDocuments SET status = 'REJECTED', errorCode = ${String(focusRes2.data?.status_sefaz || 'AI_ERR')},
              errorMessage = ${errMsg2}, responsePayload = ${JSON.stringify(focusRes2.data)}, updatedAt = GETUTCDATE() WHERE id = ${docId2}
            `;
            needsIntervention.push(failed);
          }
        } catch (retryErr) {
          const retryErrMsg = retryErr.data?.mensagem || retryErr.message || 'Erro no reenvio';
          await sql.query`
            UPDATE GestaoFiscalDocuments SET status = 'SUBMISSION_FAILED', errorCode = ${String(retryErr.httpStatus || 'AI_ERR')},
            errorMessage = ${retryErrMsg}, updatedAt = GETUTCDATE() WHERE id = ${docId2}
          `;
          needsIntervention.push(failed);
        }
      } else {
        needsIntervention.push(failed);
      }
    } catch (aiErr) {
      context?.error(`[auto-nfe] Erro IA para pedido ${failed.orderId}:`, aiErr);
      needsIntervention.push(failed);
    }
  }

  const resultMessage = `${successOrders.length} NF-e autorizada(s), ${aiResolvedOrders.length} corrigida(s) pela IA, ${needsIntervention.length} requer(em) intervenção.`;
  context?.log(`[auto-nfe] Resultado: ${resultMessage}`);

  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationRunLog')
    CREATE TABLE AutomationRunLog (
      id INT PRIMARY KEY IDENTITY,
      automation_key NVARCHAR(100) NOT NULL,
      result_message NVARCHAR(500),
      created_at DATETIME DEFAULT GETUTCDATE()
    )
  `.catch(() => {});
  await sql.query`
    INSERT INTO AutomationRunLog (automation_key, result_message) VALUES ('generate_nfe', ${resultMessage})
  `.catch(() => {});

  await setNfeProgress(resultMessage, { total: pendingOrders.length, done: successOrders.length + aiResolvedOrders.length, isRunning: false });

  return {
    success: true,
    authorized: successOrders.length,
    aiResolved: aiResolvedOrders.length,
    needsIntervention: needsIntervention.length,
    interventionOrders: needsIntervention.map((f) => ({ orderId: f.orderId, error: f.error, errorCode: f.errorCode })),
    message: resultMessage,
  };
}

// ── HTTP trigger (chamada manual ou por cron externo) ─────────────────────────

app.http('auto-nfe', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const result = await runAutoNfe(context);
      return { jsonBody: result };
    } catch (err) {
      context.error('[auto-nfe] Erro:', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ── HTTP trigger — progresso em tempo real ────────────────────────────────────

app.http('auto-nfe-progress', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await migrateNfeProgressColumns();

      const [cfgRes, logRes] = await Promise.all([
        sql.query`SELECT nfe_is_running, nfe_current_step, nfe_run_total, nfe_run_done, nfe_run_started_at FROM AutomationConfig WHERE automation_key='generate_nfe'`.catch(() => ({ recordset: [] })),
        sql.query`SELECT TOP 1 result_message, created_at FROM AutomationRunLog WHERE automation_key='generate_nfe' ORDER BY id DESC`.catch(() => ({ recordset: [] })),
      ]);

      const row = cfgRes.recordset[0] || {};
      const lastRun = logRes.recordset[0] || null;

      return {
        jsonBody: {
          isRunning: !!row.nfe_is_running,
          currentStep: row.nfe_current_step || null,
          total: row.nfe_run_total ?? null,
          done: row.nfe_run_done ?? null,
          startedAt: row.nfe_run_started_at || null,
          lastRun: lastRun ? { message: lastRun.result_message, createdAt: lastRun.created_at } : null,
        },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ── Timer trigger (a cada minuto, executa conforme intervalo configurado) ────

app.timer('auto-nfe-timer', {
  schedule: '0 * * * * *',
  handler: async (myTimer, context) => {
    try {
      await sql.connect(sqlConfig);

      const cfgResult = await sql.query`
        SELECT is_active, time_interval_minutes
        FROM AutomationConfig WHERE automation_key = 'generate_nfe'
      `.catch(() => ({ recordset: [] }));

      if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) return;

      const intervalMinutes = cfgResult.recordset[0].time_interval_minutes || 5;

      const lastRunResult = await sql.query`
        SELECT TOP 1 created_at FROM AutomationRunLog
        WHERE automation_key = 'generate_nfe'
        ORDER BY id DESC
      `.catch(() => ({ recordset: [] }));

      if (lastRunResult.recordset.length) {
        const lastRun = new Date(lastRunResult.recordset[0].created_at);
        const minutesSinceLastRun = (Date.now() - lastRun.getTime()) / 60000;
        if (minutesSinceLastRun < intervalMinutes) return;
      }

      const result = await runAutoNfe(context);
      context.log('[auto-nfe] timer:', result.message || result.reason || JSON.stringify(result));
    } catch (err) {
      context.error('[auto-nfe] Erro no timer:', err);
    }
  },
});
