const { app } = require('@azure/functions');
const { OpenAI } = require('openai');
const sql = require('mssql');

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
- group: Grupo ou família do produto conforme campo "Grupo" do documento. Null se não informado.
- subGroup: Subgrupo do produto conforme campo "Subgrupo" ou "Sub grupo" do documento. Null se não informado.
- badge: Destaque, variação ou característica especial detectada no nome — ex: "TRADICIONAL", "NATURAL", "SUPER CONGELADO", "SABOR NATURAL". Null se não houver.
- description: Descrição adicional relevante que não se encaixe em nenhum campo acima. Null se não houver.

REGRAS CRÍTICAS:
1. Retorne APENAS um JSON válido — sem markdown, sem texto adicional, sem blocos de código.
2. Extraia TODOS os produtos do documento sem exceção.
3. Campos do documento que não correspondem a nenhum campo válido acima (ex: código interno, CFOP, CST, NCM, número de página, código de barras) devem ser completamente IGNORADOS.
4. O campo "name" deve conter apenas o nome do produto, sem informações que pertencem a outros campos.
5. availableQuantity é SEMPRE 0 quando o documento não informa quantidade em estoque.
6. Se o documento tiver coluna "Un" ou "Unidade": use PC/PCT → "Pacote", CX → "Caixa", PO/POTE → "Pote".
7. Se não encontrar nenhum produto, retorne [].

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

      let userContent;

      if (ext === 'pdf') {
        userContent = [
          {
            type: 'file',
            file: {
              filename: fileName,
              file_data: fileContent,
            },
          },
          {
            type: 'text',
            text: 'Extraia todos os produtos deste documento e retorne APENAS o JSON conforme as instruções.',
          },
        ];
      } else {
        userContent = `Extraia todos os produtos do seguinte documento e retorne APENAS o JSON conforme as instruções:\n\n${fileContent}`;
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: activePrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        max_tokens: 4096,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '[]';

      // Remove markdown code block wrappers if present
      let jsonStr = raw;
      const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) jsonStr = mdMatch[1].trim();

      let products;
      try {
        products = JSON.parse(jsonStr);
      } catch {
        context.warn('analyze-document: JSON parse failed. Raw response:', raw);
        return { status: 422, jsonBody: { error: 'Não foi possível extrair produtos do documento. Verifique se o arquivo contém dados de produtos.' } };
      }

      if (!Array.isArray(products)) {
        return { status: 422, jsonBody: { error: 'Formato inválido retornado pela IA.' } };
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
