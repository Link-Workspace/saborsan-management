'use strict';
const { app } = require('@azure/functions');
const { getLinkChatWabaTemplates } = require('../linkchat-integration');

app.http('waba-templates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (_request, _context) => {
    const templates = await getLinkChatWabaTemplates();
    if (!templates) {
      return { status: 503, jsonBody: { error: 'WABA templates unavailable' } };
    }
    return { jsonBody: templates };
  },
});
