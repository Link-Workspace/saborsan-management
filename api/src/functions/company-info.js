'use strict';
const { app } = require('@azure/functions');

app.http('company-info', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (_request, _context) => {
    return {
      jsonBody: {
        email: process.env.COMPANY_EMAIL || '',
      },
    };
  },
});
