'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const OpenAI = require('openai');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

const CONFIDENCE_THRESHOLD = 80;

// Portuguese stop-words filtered from keyword extraction
const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'com',
  'para', 'por', 'que', 'e', 'ou', 'a', 'o', 'os', 'as', 'um', 'uma',
  'uns', 'umas', 'ao', 'aos', 'seu', 'sua', 'seus', 'suas', 'este',
  'esta', 'esse', 'essa', 'pelo', 'pela', 'pelos', 'pelas', 'mais',
  'mas', 'sem', 'entre', 'sobre', 'como', 'cada', 'todo', 'toda',
]);

function extractKeywords(product) {
  const text = [
    product.name,
    product.category,
    product.description,
    product.details,
    product.packaging,
    product.conservation,
    product.preparation,
    product.idealFor,
  ]
    .filter(Boolean)
    .join(' ');

  return [...new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  )].slice(0, 12);
}

async function findCandidateNcms(keywords) {
  if (!keywords.length) return [];

  const conditions = keywords.map((_, i) => `description LIKE @kw${i}`).join(' OR ');
  const req = new sql.Request();
  keywords.forEach((kw, i) => req.input(`kw${i}`, sql.NVarChar(200), `%${kw}%`));

  const result = await req.query(`
    SELECT TOP 40 code, description
    FROM NcmCodes
    WHERE active = 1 AND (${conditions})
    ORDER BY code
  `);

  return result.recordset;
}

async function classifyWithAI(product, candidates) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const openai = new OpenAI({ apiKey });

  const candidateList = candidates.map((c) => `${c.code} — ${c.description}`).join('\n');

  const productInfo = [
    `Nome: ${product.name}`,
    product.category    ? `Categoria: ${product.category}`              : null,
    product.description ? `Descrição: ${product.description}`           : null,
    product.details     ? `Detalhes: ${product.details}`                : null,
    product.packaging   ? `Embalagem/Apresentação: ${product.packaging}` : null,
    product.conservation? `Conservação: ${product.conservation}`        : null,
    product.preparation ? `Preparação: ${product.preparation}`          : null,
    product.idealFor    ? `Finalidade: ${product.idealFor}`             : null,
  ].filter(Boolean).join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Você é um especialista em classificação fiscal NCM (Nomenclatura Comum do Mercosul). ' +
          'Classifique o produto usando EXCLUSIVAMENTE os códigos da lista fornecida. ' +
          'NUNCA invente ou sugira códigos fora da lista. ' +
          'Responda somente com JSON válido no formato solicitado.',
      },
      {
        role: 'user',
        content:
          `Produto:\n${productInfo}\n\n` +
          `Códigos NCM candidatos (escolha apenas um desta lista):\n${candidateList}\n\n` +
          `Responda em JSON exatamente neste formato:\n` +
          `{\n` +
          `  "ncm_code": "código de 8 dígitos da lista",\n` +
          `  "ncm_description": "descrição oficial exata da lista",\n` +
          `  "confidence": <número 0-100>,\n` +
          `  "justification": "justificativa resumida em até 200 caracteres",\n` +
          `  "status": "classified" ou "pending"\n` +
          `}\n` +
          `Use "pending" se confiança < ${CONFIDENCE_THRESHOLD} ou se dois códigos forem igualmente adequados.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);

  // Ensure the returned code actually exists in the candidate list
  const validCodes = new Set(candidates.map((c) => c.code));
  if (parsed.ncm_code && !validCodes.has(String(parsed.ncm_code).replace(/\D/g, ''))) {
    return {
      status: 'pending',
      confidence: 0,
      justification: 'Código retornado pela IA não encontrado na tabela NCM oficial',
    };
  }

  return parsed;
}

async function classifyProducts(productIds, context) {
  await sql.connect(sqlConfig);
  try {
    const versionResult = await sql.query`
      SELECT CONVERT(NVARCHAR(50), MAX(syncedAt), 127) AS ver FROM NcmCodes WHERE active = 1
    `;
    const ncmTableVersion = versionResult.recordset[0]?.ver ?? null;

    const ncmTotal = await sql.query`SELECT COUNT(*) AS cnt FROM NcmCodes WHERE active = 1`;
    if (!ncmTotal.recordset[0]?.cnt) {
      return { error: 'A tabela NCM está vazia. Execute a sincronização antes de classificar.' };
    }

    let productRows;
    if (productIds?.length) {
      const idList = productIds.map((_, i) => `@pid${i}`).join(',');
      const req = new sql.Request();
      productIds.forEach((id, i) => req.input(`pid${i}`, sql.NVarChar(100), String(id)));
      productRows = await req.query(`
        SELECT id, name, category, description, details, packaging, conservation, preparation, idealFor
        FROM Products
        WHERE id IN (${idList}) AND active = 1
      `);
    } else {
      // Products without a manually-set or AI-classified NCM
      productRows = await sql.query`
        SELECT p.id, p.name, p.category, p.description, p.details,
               p.packaging, p.conservation, p.preparation, p.idealFor
        FROM Products p
        LEFT JOIN ProductFiscalConfig pfc ON pfc.productId = CAST(p.id AS NVARCHAR(100))
        WHERE p.active = 1
          AND (pfc.id IS NULL OR pfc.ncmSource IS NULL OR pfc.ncmSource NOT IN ('manual', 'ai'))
      `;
    }

    const products = productRows.recordset;
    if (!products.length) {
      return { classified: 0, pending: 0, failed: 0, results: [], message: 'Nenhum produto para classificar' };
    }

    const results = [];

    for (const product of products) {
      try {
        const keywords = extractKeywords(product);
        const candidates = await findCandidateNcms(keywords);

        if (!candidates.length) {
          await sql.query`
            INSERT INTO NcmClassificationLog
              (productId, productName, status, ncmTableVersion)
            VALUES
              (${String(product.id)}, ${product.name}, 'failed', ${ncmTableVersion})
          `;
          results.push({ productId: product.id, productName: product.name, status: 'failed', reason: 'Nenhum NCM candidato encontrado' });
          continue;
        }

        const aiResult = await classifyWithAI(product, candidates);
        const confidence = Number(aiResult.confidence ?? 0);
        const status = aiResult.status === 'classified' && confidence >= CONFIDENCE_THRESHOLD
          ? 'classified'
          : 'pending';

        await sql.query`
          INSERT INTO NcmClassificationLog
            (productId, productName, ncmCode, ncmDescription, confidence, justification, status, ncmTableVersion)
          VALUES (
            ${String(product.id)}, ${product.name},
            ${aiResult.ncm_code ?? null}, ${aiResult.ncm_description ?? null},
            ${confidence}, ${aiResult.justification ?? null},
            ${status}, ${ncmTableVersion}
          )
        `;

        if (status === 'classified') {
          const productIdStr = String(product.id);
          const exists = await sql.query`
            SELECT id FROM ProductFiscalConfig WHERE productId = ${productIdStr}
          `;
          if (exists.recordset.length > 0) {
            await sql.query`
              UPDATE ProductFiscalConfig SET
                ncm              = ${aiResult.ncm_code},
                ncmSource        = 'ai',
                ncmClassifiedAt  = GETUTCDATE(),
                ncmTableVersion  = ${ncmTableVersion},
                ncmConfidence    = ${confidence},
                updatedAt        = GETUTCDATE()
              WHERE productId = ${productIdStr}
            `;
          } else {
            await sql.query`
              INSERT INTO ProductFiscalConfig
                (productId, productName, ncm, ncmSource, ncmClassifiedAt, ncmTableVersion, ncmConfidence)
              VALUES
                (${productIdStr}, ${product.name}, ${aiResult.ncm_code},
                 'ai', GETUTCDATE(), ${ncmTableVersion}, ${confidence})
            `;
          }
        }

        results.push({
          productId: product.id,
          productName: product.name,
          status,
          ncmCode: aiResult.ncm_code ?? null,
          ncmDescription: aiResult.ncm_description ?? null,
          confidence,
          justification: aiResult.justification ?? null,
        });
      } catch (err) {
        context.error?.(`Error classifying product ${product.id}:`, err);
        results.push({ productId: product.id, productName: product.name, status: 'failed', reason: err.message });
      }
    }

    return {
      classified: results.filter((r) => r.status === 'classified').length,
      pending:    results.filter((r) => r.status === 'pending').length,
      failed:     results.filter((r) => r.status === 'failed').length,
      results,
    };
  } finally {
    try { await sql.close(); } catch (_) {}
  }
}

app.http('ncm-classify', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'ncm/classify',
  handler: async (request, context) => {
    try {
      if (request.method === 'GET') {
        await sql.connect(sqlConfig);
        try {
          const result = await sql.query`
            SELECT
              p.id, p.name, p.category,
              pfc.ncm, pfc.ncmSource, pfc.ncmClassifiedAt, pfc.ncmConfidence
            FROM Products p
            LEFT JOIN ProductFiscalConfig pfc ON pfc.productId = CAST(p.id AS NVARCHAR(100))
            WHERE p.active = 1
            ORDER BY
              CASE WHEN pfc.ncmSource IN ('manual','ai') THEN 1 ELSE 0 END ASC,
              p.name ASC
          `;
          return { jsonBody: { products: result.recordset } };
        } finally {
          try { await sql.close(); } catch (_) {}
        }
      }

      const body = await request.json().catch(() => ({}));
      const { productIds } = body;
      const result = await classifyProducts(productIds?.length ? productIds : null, context);
      return { jsonBody: result };
    } catch (err) {
      context.error('ncm-classify error:', err);
      return { status: 500, jsonBody: { error: err.message || 'Erro na classificação NCM' } };
    }
  },
});
