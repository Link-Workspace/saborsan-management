'use strict';

/**
 * Motor de regras fiscais — validação pré-emissão de NF-e
 *
 * Executa ANTES de qualquer chamada à Focus NFe e bloqueia a emissão caso
 * alguma regra seja violada, evitando rejeições do SEFAZ.
 *
 * Regras implementadas:
 *   1. CRT × CST/CSOSN — compatibilidade entre regime tributário e código ICMS
 *   2. CFOP × direção da operação — prefixo 5 (interna) vs 6 (interestadual)
 *   3. Produto sem configuração fiscal — bloqueia como "configuração pendente"
 */

// ---------------------------------------------------------------------------
// Tabelas de referência
// ---------------------------------------------------------------------------

// CSOSN válidos (Simples Nacional — CRT 1 e 4)
const CSOSN_VALIDOS = new Set([
  '101', '102', '103', '201', '202', '203', '300', '400', '500', '900',
]);

// CST ICMS válidos (Regime Normal — CRT 2 e 3)
const CST_ICMS_VALIDOS = new Set([
  '00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90',
]);

// ---------------------------------------------------------------------------
// Predicados
// ---------------------------------------------------------------------------

function ehCSOSN(cst) {
  return CSOSN_VALIDOS.has(String(cst ?? '').trim());
}

function ehCST(cst) {
  return CST_ICMS_VALIDOS.has(String(cst ?? '').trim());
}

/** CRT 1 (Simples Nacional) e 4 (MEI) exigem CSOSN */
function crtExigeCSOSN(crt) {
  return crt === 1 || crt === 4;
}

/** CRT 2 (Simples Nacional — excesso de sublimite) e 3 (Regime Normal) exigem CST */
function crtExigeCST(crt) {
  return crt === 2 || crt === 3;
}

// ---------------------------------------------------------------------------
// Validação de direção do CFOP
// ---------------------------------------------------------------------------

/**
 * Verifica se o prefixo do CFOP é compatível com a direção da operação.
 * Operação interna (mesma UF) → prefixo 5
 * Operação interestadual     → prefixo 6
 */
function validarDirecaoCfop(cfop, ufEmitente, ufDestinatario) {
  const codigo = String(cfop ?? '').trim();
  if (!codigo || !ufEmitente || !ufDestinatario) return { valido: true };

  const prefixo = codigo.charAt(0);
  const interna = ufEmitente.toUpperCase() === ufDestinatario.toUpperCase();

  if (interna && prefixo !== '5') {
    const corrigido = `5${codigo.slice(1)}`;
    return {
      valido: false,
      mensagem:
        `CFOP ${codigo} tem prefixo '${prefixo}', mas a operação é interna ` +
        `(${ufEmitente} → ${ufDestinatario}). Esperado prefixo 5 (ex: ${corrigido}).`,
    };
  }

  if (!interna && prefixo !== '6') {
    const corrigido = `6${codigo.slice(1)}`;
    return {
      valido: false,
      mensagem:
        `CFOP ${codigo} tem prefixo '${prefixo}', mas a operação é interestadual ` +
        `(${ufEmitente} → ${ufDestinatario}). Esperado prefixo 6 (ex: ${corrigido}).`,
    };
  }

  return { valido: true };
}

// ---------------------------------------------------------------------------
// Função principal de validação
// ---------------------------------------------------------------------------

/**
 * Valida as regras fiscais de todos os itens do pedido antes da emissão.
 *
 * @param {object}   opts
 * @param {number}   opts.crt              - Regime tributário do emitente (1, 2, 3 ou 4)
 * @param {object[]} opts.items            - Itens do pedido [{ productName }]
 * @param {object}   opts.fiscalConfigs    - Configs do banco, keyed por toLowerCase(productName)
 * @param {object}   opts.fiscalMap        - Mapa hardcoded de fallback { [productName]: config }
 * @param {string}   opts.ufEmitente       - UF do emitente (ex: 'SC')
 * @param {string}   opts.ufDestinatario   - UF do destinatário (ex: 'SP')
 *
 * @returns {{ valido: boolean, erros: string[] }}
 */
function validarRegrasFiscais({ crt, items, fiscalConfigs, fiscalMap, ufEmitente, ufDestinatario }) {
  const erros = [];

  for (const item of items) {
    const chave = item.productName.toLowerCase();
    const cfgBanco     = fiscalConfigs[chave] || fiscalConfigs[item.productName] || null;
    const cfgHardcoded = fiscalMap?.[item.productName] || null;
    const cfg          = cfgBanco || cfgHardcoded;

    // ── Produto sem qualquer configuração fiscal ─────────────────────────────
    if (!cfg) {
      erros.push(
        `Configuração fiscal pendente para "${item.productName}". ` +
        `Acesse Configurações → Configuração Fiscal e defina NCM, CFOP e CST antes de emitir.`,
      );
      continue;
    }

    const icmsCst = String(cfg.icmsCst ?? '').trim();

    // ── CRT × CST/CSOSN ─────────────────────────────────────────────────────
    if (!icmsCst) {
      erros.push(`Produto "${item.productName}": CST/CSOSN do ICMS não preenchido.`);
    } else if (crtExigeCST(crt) && ehCSOSN(icmsCst)) {
      erros.push(
        `Produto "${item.productName}": CSOSN "${icmsCst}" é incompatível com CRT ${crt} (Regime Normal). ` +
        `Configure o CST correto (ex: 00, 40, 41, 60) em Configurações → Configuração Fiscal.`,
      );
    } else if (crtExigeCSOSN(crt) && !ehCSOSN(icmsCst)) {
      erros.push(
        `Produto "${item.productName}": CST "${icmsCst}" é incompatível com CRT ${crt} (Simples Nacional). ` +
        `Configure o CSOSN correto (ex: 102, 400, 500) em Configurações → Configuração Fiscal.`,
      );
    } else if (!ehCSOSN(icmsCst) && !ehCST(icmsCst)) {
      erros.push(
        `Produto "${item.productName}": código "${icmsCst}" não é um CST nem CSOSN válido.`,
      );
    }

    // ── CFOP × direção da operação ───────────────────────────────────────────
    if (cfg.cfop) {
      const checagem = validarDirecaoCfop(cfg.cfop, ufEmitente, ufDestinatario);
      if (!checagem.valido) {
        erros.push(`Produto "${item.productName}": ${checagem.mensagem}`);
      }
    }
  }

  return { valido: erros.length === 0, erros };
}

module.exports = { validarRegrasFiscais };
