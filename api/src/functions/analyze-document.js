const { app } = require('@azure/functions');
const { OpenAI } = require('openai');
const sql = require('mssql');
const { PDFParse } = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

const SYSTEM_PROMPT = `Você é um especialista em extração de dados de produtos de distribuidoras alimentícias.
Analise o documento fornecido e extraia TODOS os produtos encontrados.

CAMPOS VÁLIDOS DO BANCO DE DADOS — mapeie cada informação exatamente para um desses campos:
- name: Nome limpo do produto. Remova do nome: abreviações de embalagem (CX, PC, PCT, PO, POTE), pesos/quantidades (10Kg, 1,02kg, 600g, c/10, c/20), variações descritivas (TRADICIONAL, NATURAL, SUPER CONGELADO). Essas informações pertencem aos seus campos específicos abaixo.
- category: Categoria do produto. Infira pelo nome, grupo ou subgrupo quando não estiver explícita.
- price: Preço numérico (use 0 se não disponível).
- availableQuantity: Quantidade em estoque — use SEMPRE 0 quando o documento não informar explicitamente quantidade de estoque.
- packaging: Tipo de embalagem — use EXATAMENTE um desses valores quando detectado: "Caixa" (para CX), "Pacote" (para PC, PCT, PKT), "Pote" (para PO, POTE), "Fardo", "Saco", "Bandeja", "Unidade". Null se não informado.
- unitQuantity: Número inteiro de unidades por embalagem — ex: "c/10" → 10, "c/20" → 20, "Pct/10" → 10. Null se não informado.
- packagingWeight: Peso em kg da embalagem como número decimal — ex: "10Kg" → 10, "1,02kg" → 1.02, "2Kg" → 2, "600g" → 0.6. Null se não informado.
- conservation: Condição de conservação — ex: "-18°C", "Refrigerado", "Temperatura ambiente". Infira pelo tipo de produto (congelados → "-18°C", frios → "Refrigerado") se não estiver explícito. Null se não for possível inferir.
- group: Nome EXATO do grupo ou seção conforme aparece no documento — pode ser um cabeçalho de seção (ex: "POLPA NORTE", "CORDEIRO", "EASYCHEF"), uma coluna "Grupo" ou similar. Se o produto está numa seção com esse cabeçalho, use-o como group. Null apenas se não houver nenhuma indicação de grupo no documento.
- subGroup: Nome EXATO do subgrupo conforme campo "Subgrupo", "Sub grupo" ou subdivisão do documento. Frequentemente igual ao group quando não há subdivisão explícita. Null se não informado.
- badge: Destaque, variação ou característica especial detectada no nome — ex: "TRADICIONAL", "NATURAL", "SUPER CONGELADO", "SABOR NATURAL". Null se não houver.
- description: Use SOMENTE para informações de preparo ou estado do produto que não cabem em nenhum outro campo — ex: "(CRU)", "(FRITO)", "(ASSADO)". NÃO use description para grupo, subgrupo, fabricante, fornecedor, conservação, embalagem ou qualquer informação que tenha campo próprio acima.

REGRAS CRÍTICAS:
1. Retorne APENAS um JSON válido — sem markdown, sem texto adicional, sem blocos de código.
2. Extraia TODOS os produtos do documento sem exceção.
3. Campos do documento que não correspondem a nenhum campo válido acima (ex: código interno, CFOP, CST, NCM, número de página, código de barras) devem ser completamente IGNORADOS.
4. O campo "name" deve conter apenas o nome do produto, sem informações que pertencem a outros campos.
5. availableQuantity é SEMPRE 0 quando o documento não informa quantidade em estoque.
6. Se o documento tiver coluna "Un" ou "Unidade": use PC/PCT → "Pacote", CX → "Caixa", PO/POTE → "Pote".
7. Se não encontrar nenhum produto, retorne [].
8. group e subGroup são campos DEDICADOS — NUNCA coloque nome de grupo, seção ou fabricante no campo description.
9. Se um trecho do documento começa com produtos sem cabeçalho de grupo visível, mas o contexto anterior indicava um grupo, mantenha esse grupo para esses produtos.

Estrutura do JSON:
[
  {
    "name": "Nome limpo do produto",
    "category": "Categoria",
    "price": 0.00,
    "availableQuantity": 0,
    "packaging": null,
    "unitQuantity": null,
    "packagingWeight": null,
    "conservation": null,
    "group": null,
    "subGroup": null,
    "badge": null,
    "description": null
  }
]`;

// Split text into chunks of ~N non-empty lines with overlap to preserve section headers across boundaries
function splitIntoChunks(text, linesPerChunk = 120, overlapLines = 20) {
  const lines = text.split('\n');
  const chunks = [];
  let currentStart = 0;
  let nonEmptyCount = 0;
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim()) nonEmptyCount++;
    if (nonEmptyCount >= linesPerChunk) {
      chunks.push(lines.slice(currentStart, i + 1).join('\n'));
      // Next chunk starts overlapLines back so group headers are visible
      const overlapStart = Math.max(currentStart, i + 1 - overlapLines);
      currentStart = overlapStart;
      nonEmptyCount = lines.slice(overlapStart, i + 1).filter((l) => l.trim()).length;
    }
    i++;
  }

  if (currentStart < lines.length && lines.slice(currentStart).some((l) => l.trim())) {
    chunks.push(lines.slice(currentStart).join('\n'));
  }

  return chunks;
}

// Call AI on one text chunk and return parsed product array
async function extractFromChunk(chunkText, activePrompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: activePrompt },
      { role: 'user', content: `Extraia todos os produtos do seguinte trecho do documento e retorne APENAS o JSON conforme as instruções:\n\n${chunkText}` },
    ],
    temperature: 0,
    max_tokens: 16384,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || '[]';
  let jsonStr = raw;
  const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) jsonStr = mdMatch[1].trim();

  try {
    const result = JSON.parse(jsonStr);
    return Array.isArray(result) ? result : [];
  } catch {
    const lastClose = jsonStr.lastIndexOf('}');
    if (lastClose !== -1) {
      try {
        const result = JSON.parse(jsonStr.substring(0, lastClose + 1) + ']');
        return Array.isArray(result) ? result : [];
      } catch {}
    }
    return [];
  }
}

app.http('analyze-document', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { fileContent, fileName, fileType } = body;

      if (!fileContent || !fileName) {
        return { status: 400, jsonBody: { error: 'fileContent e fileName são obrigatórios.' } };
      }

      // Busca prompt customizado do banco; usa SYSTEM_PROMPT como fallback
      let activePrompt = SYSTEM_PROMPT;
      try {
        await sql.connect(sqlConfig);
        const cfgResult = await sql.query`SELECT TOP 1 iaImportPrompt FROM StockSupplierConfig ORDER BY id ASC`;
        const custom = cfgResult.recordset[0]?.iaImportPrompt?.trim();
        if (custom) activePrompt = custom;
      } catch (dbErr) {
        context.warn('analyze-document: could not load custom prompt from DB, using default.', dbErr?.message);
      }

      const ext = (fileType || fileName.split('.').pop()).toLowerCase();

      let products;

      if (ext === 'pdf') {
        // Extract text from PDF, split into chunks, process all in parallel
        const base64 = fileContent.includes(',') ? fileContent.split(',')[1] : fileContent;
        const pdfBuffer = Buffer.from(base64, 'base64');
        const parser = new PDFParse({ data: pdfBuffer });
        const pdfData = await parser.getText();
        const pdfText = pdfData.text;

        if (!pdfText?.trim()) {
          return { status: 422, jsonBody: { error: 'Não foi possível extrair texto do PDF. O arquivo deve ser um PDF com texto selecionável (não escaneado).' } };
        }

        const chunks = splitIntoChunks(pdfText, 120);
        context.log(`analyze-document: processing PDF in ${chunks.length} chunk(s).`);

        const chunkResults = await Promise.all(chunks.map((chunk) => extractFromChunk(chunk, activePrompt)));
        products = chunkResults.flat();
      } else {
        products = await extractFromChunk(fileContent, activePrompt);
      }

      if (!Array.isArray(products) || !products.length) {
        return { status: 422, jsonBody: { error: 'Não foi possível extrair produtos do documento. Verifique se o arquivo contém dados de produtos.' } };
      }

      const normalized = products.map((p) => ({
        name: String(p.name || '').trim(),
        category: String(p.category || '').trim(),
        price: parseFloat(String(p.price || '0').replace(',', '.')) || 0,
        availableQuantity: parseInt(p.availableQuantity ?? p.quantity ?? 0, 10) || 0,
        packaging: p.packaging ? String(p.packaging).trim() : null,
        unitQuantity: p.unitQuantity != null ? parseInt(p.unitQuantity, 10) || null : null,
        packagingWeight: p.packagingWeight != null ? parseFloat(String(p.packagingWeight).replace(',', '.')) || null : null,
        conservation: p.conservation ? String(p.conservation).trim() : null,
        group: p.group ? String(p.group).trim() : null,
        subGroup: p.subGroup ? String(p.subGroup).trim() : null,
        badge: p.badge ? String(p.badge).trim() : null,
        description: p.description ? String(p.description).trim() : null,
        valid: !!(p.name && String(p.name).trim() && p.category && String(p.category).trim()),
      }));

      return { jsonBody: { products: normalized } };
    } catch (err) {
      context.error('analyze-document error:', err);
      return { status: 500, jsonBody: { error: 'Erro ao analisar documento com IA.' } };
    }
  },
});
