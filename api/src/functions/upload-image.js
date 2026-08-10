const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER_NAME = 'product-images';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_SIZE_MB = 5;

app.http('upload-image', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
      if (!connStr) {
        return { status: 500, jsonBody: { error: 'Storage não configurado.' } };
      }

      let formData;
      try {
        formData = await request.formData();
      } catch {
        return { status: 400, jsonBody: { error: 'Requisição inválida. Envie um multipart/form-data.' } };
      }

      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return { status: 400, jsonBody: { error: 'Nenhum arquivo enviado.' } };
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return { status: 400, jsonBody: { error: 'Formato não suportado. Use JPG, PNG, WEBP, AVIF ou GIF.' } };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_SIZE_MB * 1024 * 1024) {
        return { status: 400, jsonBody: { error: `Imagem muito grande. Máximo ${MAX_SIZE_MB}MB.` } };
      }

      const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
      const blobName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
      await containerClient.createIfNotExists({ access: 'blob' });

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: file.type },
      });

      return { jsonBody: { url: blockBlobClient.url } };
    } catch (err) {
      context.error('upload-image error:', err);
      return { status: 500, jsonBody: { error: 'Erro ao fazer upload da imagem.' } };
    }
  },
});
