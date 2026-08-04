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

const QUINZE_DIAS_MS = 15 * 24 * 60 * 60 * 1000;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function getFocusConfig() {
  const baseUrl = process.env.FOCUS_NFE_BASE_URL;
  const token = process.env.FOCUS_NFE_TOKEN;
  if (!baseUrl) throw Object.assign(new Error('FOCUS_NFE_BASE_URL não configurada'), { configError: true });
  if (!token) throw Object.assign(new Error('FOCUS_NFE_TOKEN não configurado'), { configError: true });
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
    timeoutMs: Number(process.env.FOCUS_NFE_TIMEOUT_MS ?? 30000),
  };
}

function createBasicAuth(token) {
  return `Basic ${Buffer.from(`${token}:`, 'utf8').toString('base64')}`;
}

function normalizarCnpj(cnpj) {
  return String(cnpj || '').replace(/\D/g, '');
}

async function chamarFocusCnpj(cnpjNorm) {
  const { baseUrl, token, timeoutMs } = getFocusConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/v2/cnpjs/${cnpjNorm}`, {
      headers: { Authorization: createBasicAuth(token), Accept: 'application/json' },
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
      throw Object.assign(new Error('Timeout ao consultar CNPJ na Focus NFe'), { isTimeout: true });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Classificação da IE ───────────────────────────────────────────────────────

function classificarIE(numero, situacao, ufRetorno) {
  const sit = String(situacao || '').toUpperCase().trim();
  const num = String(numero || '').trim();

  if (sit === 'ISENTA' || sit === 'ISENTO' || num.toUpperCase() === 'ISENTO') {
    return { stateRegistrationIndicator: 2, stateRegistration: null, stateRegistrationStatus: 'ISENTA', stateRegistrationUF: ufRetorno };
  }

  const situacoesInativas = ['CANCELADA', 'INAPTA', 'NULA', 'BAIXADA', 'SUSPENSA'];
  if (situacoesInativas.includes(sit) || !num) {
    return { stateRegistrationIndicator: 9, stateRegistration: null, stateRegistrationStatus: sit || 'NOT_FOUND', stateRegistrationUF: ufRetorno };
  }

  return { stateRegistrationIndicator: 1, stateRegistration: num, stateRegistrationStatus: sit || 'ACTIVE', stateRegistrationUF: ufRetorno };
}

function extrairIEDaResposta(data, targetUf) {
  // Os nomes de campo dependem do retorno real da Focus NF-e.
  // Guardamos o JSON completo para auditoria e tentamos múltiplos padrões conhecidos.

  const uf = String(targetUf || '').toUpperCase().trim();

  // Padrão 1: array inscricoes_estaduais
  if (Array.isArray(data.inscricoes_estaduais) && data.inscricoes_estaduais.length > 0) {
    const match = uf
      ? data.inscricoes_estaduais.find((ie) => String(ie.uf || ie.estado || '').toUpperCase().trim() === uf)
      : null;
    const ie = match || data.inscricoes_estaduais[0];
    const num = String(ie.inscricao_estadual || ie.numero || ie.ie || '').trim();
    const sit = String(ie.situacao || ie.situacao_inscricao_estadual || ie.status || '').trim();
    return classificarIE(num, sit, String(ie.uf || ie.estado || targetUf || '').toUpperCase());
  }

  // Padrão 2: campos diretos no objeto raiz
  const num = String(data.inscricao_estadual || data.ie || '').trim();
  const sit = String(data.situacao_inscricao_estadual || data.situacao_ie || data.situacao || '').trim();
  const ufRetorno = String(data.uf || data.estado || targetUf || '').toUpperCase().trim();

  return classificarIE(num, sit, ufRetorno);
}

// ── Lógica central de consulta e atualização ──────────────────────────────────

async function executarConsultaCnpj(clientId, cnpjNorm, clientUf) {
  const agora = new Date();
  const proxima15Dias = new Date(agora.getTime() + QUINZE_DIAS_MS);

  // Busca dados atuais para preservar IE em caso de ambiguidade
  const atual = await sql.query`
    SELECT stateRegistrationIndicator, stateRegistration FROM Clients WHERE id = ${clientId}
  `;
  const anterior = atual.recordset[0] || {};

  let focusData;
  let httpStatus;

  try {
    const resp = await chamarFocusCnpj(cnpjNorm);
    focusData = resp.data;
    httpStatus = resp.httpStatus;
  } catch (err) {
    const errMsg = String(err.message || 'Erro desconhecido').slice(0, 490);

    if (err.httpStatus === 401) {
      // Falha de autenticação: interrompe o lote
      throw Object.assign(new Error('Falha de autenticação na Focus NF-e. Verifique o FOCUS_NFE_TOKEN.'), { configError: true });
    }

    if (err.httpStatus === 400) {
      // CNPJ inválido: marca erro, tenta de novo em 15 dias
      await sql.query`
        UPDATE Clients SET
          lastFiscalLookupAt   = ${agora},
          nextFiscalLookupAt   = ${proxima15Dias},
          fiscalLookupSource   = 'FOCUS_NFE',
          lastFiscalLookupError = ${errMsg},
          requiresFiscalReview = 1
        WHERE id = ${clientId}
      `;
      return { success: false, httpStatus: 400, error: errMsg };
    }

    if (err.httpStatus === 404) {
      // CNPJ não encontrado: mantém dados anteriores e marca para revisão
      await sql.query`
        UPDATE Clients SET
          lastFiscalLookupAt    = ${agora},
          nextFiscalLookupAt    = ${proxima15Dias},
          fiscalLookupSource    = 'FOCUS_NFE',
          lastFiscalLookupError = N'CNPJ not found in the Federal Revenue database',
          requiresFiscalReview  = 1
        WHERE id = ${clientId}
      `;
      return { success: false, httpStatus: 404, error: 'CNPJ not found in the Federal Revenue database' };
    }

    // Timeout ou erro temporário: tenta de novo amanhã
    const proximaRetry = new Date(agora.getTime() + UM_DIA_MS);
    await sql.query`
      UPDATE Clients SET
        lastFiscalLookupAt    = ${agora},
        nextFiscalLookupAt    = ${proximaRetry},
        lastFiscalLookupError = ${errMsg}
      WHERE id = ${clientId}
    `;
    return { success: false, error: errMsg, retry: true };
  }

  // Consulta bem-sucedida
  const ieResult = extrairIEDaResposta(focusData, clientUf);

  // Se o cliente tinha IE registrada e a nova consulta não encontrou → preserva e marca revisão
  const perdeuIE = anterior.stateRegistrationIndicator === 1 && anterior.stateRegistration && ieResult.stateRegistrationIndicator !== 1;
  const novoIndicador = perdeuIE ? anterior.stateRegistrationIndicator : ieResult.stateRegistrationIndicator;
  const novaIE = perdeuIE ? anterior.stateRegistration : ieResult.stateRegistration;
  const requerRevisao = perdeuIE ? 1 : 0;

  await sql.query`
    UPDATE Clients SET
      cnpjNormalized                  = ${cnpjNorm},
      stateRegistrationIndicator      = ${novoIndicador},
      stateRegistration               = ${novaIE},
      stateRegistrationUF             = ${ieResult.stateRegistrationUF || null},
      stateRegistrationStatus         = ${ieResult.stateRegistrationStatus || null},
      lastFiscalLookupAt              = ${agora},
      lastFiscalLookupSuccessAt       = ${agora},
      nextFiscalLookupAt              = ${proxima15Dias},
      fiscalLookupSource              = 'FOCUS_NFE',
      lastFiscalLookupError           = NULL,
      requiresFiscalReview            = ${requerRevisao},
      fiscalLookupResponseJson        = ${JSON.stringify(focusData)}
    WHERE id = ${clientId}
  `;

  return {
    success: true,
    httpStatus,
    stateRegistrationIndicator: novoIndicador,
    stateRegistration: novaIE,
    stateRegistrationStatus: ieResult.stateRegistrationStatus,
    stateRegistrationUF: ieResult.stateRegistrationUF,
    requiresFiscalReview: requerRevisao === 1,
    stateRegistrationLostWarning: perdeuIE
      ? 'The previously registered state registration was not found in the latest query. The record has been flagged for fiscal review.'
      : null,
  };
}

// ── HTTP: consulta manual ou lote ─────────────────────────────────────────────

app.http('cnpj-fiscal', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      // GET /api/cnpj-fiscal?clientId=X — consulta individual
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');

        if (!clientId) {
          return { status: 400, jsonBody: { error: 'clientId é obrigatório' } };
        }

        const clientRes = await sql.query`
          SELECT id, establishmentName, cnpj, city,
                 stateRegistrationIndicator, stateRegistration,
                 lastFiscalLookupAt, requiresFiscalReview
          FROM Clients WHERE id = ${clientId}
        `;
        const client = clientRes.recordset[0];
        if (!client) return { status: 404, jsonBody: { error: 'Cliente não encontrado' } };

        const cnpjNorm = normalizarCnpj(client.cnpj);
        if (cnpjNorm.length !== 14) {
          return { status: 422, jsonBody: { error: 'Cliente não possui CNPJ com 14 dígitos válidos' } };
        }

        try {
          getFocusConfig();
        } catch (err) {
          return { status: 503, jsonBody: { error: err.message, configError: true } };
        }

        const clientUf = String(client.city || '').includes(' - ')
          ? client.city.split(' - ').pop().trim()
          : null;

        const result = await executarConsultaCnpj(client.id, cnpjNorm, clientUf);
        return {
          jsonBody: {
            clientId: client.id,
            name: client.establishmentName,
            cnpj: cnpjNorm,
            ...result,
          },
        };
      }

      // POST /api/cnpj-fiscal — processa lote de clientes com consulta vencida
      if (request.method === 'POST') {
        try {
          getFocusConfig();
        } catch (err) {
          return { status: 503, jsonBody: { error: err.message, configError: true } };
        }

        const devidos = await sql.query`
          SELECT TOP 50
            id, establishmentName, cnpj, city
          FROM Clients
          WHERE cnpj IS NOT NULL AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')) = 14
            AND (
              nextFiscalLookupAt IS NULL
              OR nextFiscalLookupAt <= GETUTCDATE()
            )
          ORDER BY COALESCE(lastFiscalLookupAt, '2000-01-01') ASC
        `;

        const resultados = [];
        for (const client of devidos.recordset) {
          const cnpjNorm = normalizarCnpj(client.cnpj);
          if (cnpjNorm.length !== 14) {
            resultados.push({ clientId: client.id, name: client.establishmentName, skipped: true, reason: 'CNPJ inválido' });
            continue;
          }
          const clientUf = String(client.city || '').includes(' - ')
            ? client.city.split(' - ').pop().trim()
            : null;

          try {
            const result = await executarConsultaCnpj(client.id, cnpjNorm, clientUf);
            resultados.push({ clientId: client.id, name: client.establishmentName, cnpj: cnpjNorm, ...result });
          } catch (err) {
            if (err.configError) throw err; // Interrompe lote em caso de erro de autenticação
            resultados.push({ clientId: client.id, name: client.establishmentName, error: err.message });
          }
        }

        return { jsonBody: { processados: resultados.length, resultados } };
      }

      return { status: 405, jsonBody: { error: 'Método não permitido' } };
    } catch (err) {
      if (err.configError) return { status: 503, jsonBody: { error: err.message, configError: true } };
      context.error('Erro em cnpj-fiscal:', err);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    } finally {
      try { await sql.close(); } catch (_) {}
    }
  },
});

// ── Timer: sincronização diária às 3h UTC ─────────────────────────────────────

app.timer('cnpjFiscalSync', {
  schedule: '0 0 3 * * *',
  handler: async (_myTimer, context) => {
    context.log('Iniciando sincronização fiscal periódica de CNPJs...');
    try {
      await sql.connect(sqlConfig);
      getFocusConfig(); // Valida antes de iniciar

      const devidos = await sql.query`
        SELECT TOP 100
          id, establishmentName, cnpj, city
        FROM Clients
        WHERE cnpj IS NOT NULL AND LEN(REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')) = 14
          AND (
            nextFiscalLookupAt IS NULL
            OR nextFiscalLookupAt <= GETUTCDATE()
          )
        ORDER BY COALESCE(lastFiscalLookupAt, '2000-01-01') ASC
      `;

      let ok = 0;
      let erros = 0;
      for (const client of devidos.recordset) {
        const cnpjNorm = normalizarCnpj(client.cnpj);
        if (cnpjNorm.length !== 14) continue;
        const clientUf = String(client.city || '').includes(' - ')
          ? client.city.split(' - ').pop().trim()
          : null;

        try {
          const result = await executarConsultaCnpj(client.id, cnpjNorm, clientUf);
          if (result.success) ok++; else erros++;
        } catch (err) {
          erros++;
          if (err.configError) {
            context.error('Erro de autenticação — sincronização interrompida');
            break;
          }
        }
      }

      context.log(`Sincronização fiscal concluída: ${ok} atualizados, ${erros} com erro.`);
    } catch (err) {
      context.error('Erro na sincronização fiscal:', err);
    } finally {
      try { await sql.close(); } catch (_) {}
    }
  },
});
