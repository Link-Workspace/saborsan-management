'use strict';
const { app } = require('@azure/functions');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.http('extract-purchase-price', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { messages, productName, productType, quantity, unit } = body;

      if (!messages || !Array.isArray(messages) || !productName) {
        return { status: 400, jsonBody: { error: 'messages (array) e productName são obrigatórios.' } };
      }

      const conversationText = messages
        .map((m) => `[${m.from === 'ia' ? 'IA' : 'Fornecedor'}] ${m.time}: ${m.text}`)
        .join('\n');

      const productInfo = [
        productName,
        productType ? `(tipo: ${productType})` : '',
        quantity ? `— quantidade solicitada: ${quantity} ${unit || ''}` : '',
      ].filter(Boolean).join(' ');

      const prompt = `Analise a conversa abaixo entre uma IA de compras e um fornecedor. Extraia o valor cobrado pelo produto "${productInfo}".

CONVERSA:
${conversationText}

Retorne APENAS um JSON válido com a estrutura:
{
  "unitPrice": <número do valor unitário ou null>,
  "totalPrice": <número do valor total ou null>,
  "context": "<trecho exato da mensagem onde o preço foi mencionado, ou string vazia>"
}

Regras:
- Extraia preços mencionados pelo fornecedor que se refiram ao produto "${productName}" ou a produtos similares do mesmo tipo.
- Se houver desconto ou forma de pagamento que altere o valor, prefira o valor com desconto quando aplicável.
- Se nenhum preço for encontrado, retorne null nos campos numéricos.
- Retorne APENAS o JSON, sem nenhum texto adicional.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      });

      const raw = completion.choices[0].message.content.trim();
      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        return { status: 500, jsonBody: { error: 'Resposta da IA inválida.' } };
      }

      return { status: 200, jsonBody: result };
    } catch (err) {
      context.error('Erro na função extract-purchase-price:', err);
      return { status: 500, jsonBody: { error: 'Erro interno ao extrair preço.' } };
    }
  },
});
