const { app } = require('@azure/functions');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Você é um assistente especializado em extração de dados de produtos alimentícios para distribuidoras.
Analise o documento fornecido e extraia todas as informações de produtos encontradas.
Retorne APENAS um JSON válido (sem markdown, sem explicações adicionais) com a seguinte estrutura:
[
  {
    "name": "Nome completo do produto",
    "category": "Categoria do produto (ex: Pão de queijo, Açaí, Salgados, Assados, Polpas, Croissant, etc.)",
    "price": 0.00,
    "availableQuantity": 0,
    "packaging": "Embalagem ou unidade (ex: cx 5kg, balde 10L, cx 30 un)",
    "conservation": "Temperatura ou condição de conservação (ex: -18°C, Refrigerado, Temperatura ambiente)",
    "description": "Breve descrição do produto"
  }
]
Regras:
- Extraia TODOS os produtos encontrados no documento, podendo ser vários
- Se o preço não estiver disponível, use 0
- Se a quantidade não estiver disponível, use 0
- Infira a categoria com base no nome do produto quando não estiver explícita
- Se não encontrar nenhum produto, retorne []
- Retorne APENAS o JSON, sem nenhum texto adicional`;

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
          { role: 'system', content: SYSTEM_PROMPT },
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
        conservation: p.conservation ? String(p.conservation).trim() : null,
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
