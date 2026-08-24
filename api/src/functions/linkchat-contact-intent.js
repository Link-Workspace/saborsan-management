'use strict';
const { app } = require('@azure/functions');
const crypto  = require('crypto');

const LINKCHAT_INTEGRATION_KEY = process.env.LINKCHAT_INTEGRATION_KEY || '';
const LINKCHAT_ACCOUNT_ID      = process.env.LINKCHAT_ACCOUNT_ID      || '';
const LINKCHAT_FRONTEND_URL    = process.env.LINKCHAT_FRONTEND_URL    || '';

// Token valid for 5 minutes
const TOKEN_TTL_MS = 5 * 60 * 1000;

function buildToken(phone, name, accountId, exp) {
  const payload = `${phone}|${name}|${accountId}|${exp}`;
  return crypto
    .createHmac('sha256', LINKCHAT_INTEGRATION_KEY)
    .update(payload)
    .digest('hex');
}

/**
 * POST /api/linkchat-contact-intent
 *
 * Generates a signed, short-lived URL that opens the LinkChat frontend
 * pre-scoped to the Saborsan account and pre-filled with the client's
 * phone number and name.
 *
 * Body: { clientPhone: string, clientName: string }
 *
 * Response: { url: string }
 *
 * The signature (lc_token) is an HMAC-SHA256 over
 * "{phone}|{name}|{accountId}|{exp}" using LINKCHAT_INTEGRATION_KEY.
 * LinkChat must verify this signature server-side before trusting the params.
 */
app.http('linkchatContactIntent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'linkchat-contact-intent',
  handler: async (request, context) => {
    if (!LINKCHAT_INTEGRATION_KEY || !LINKCHAT_ACCOUNT_ID || !LINKCHAT_FRONTEND_URL) {
      context.warn('[linkchat-contact-intent] Integration env vars not configured.');
      return { status: 503, jsonBody: { error: 'LinkChat integration not configured.' } };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
    }

    const clientPhone = String(body?.clientPhone || '').trim();
    const clientName  = String(body?.clientName  || '').trim();

    if (!clientPhone || !clientName) {
      return { status: 400, jsonBody: { error: 'clientPhone and clientName are required.' } };
    }

    const phone = clientPhone.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      return { status: 422, jsonBody: { error: 'Número de telefone inválido.' } };
    }

    const exp   = Date.now() + TOKEN_TTL_MS;
    const token = buildToken(phone, clientName, LINKCHAT_ACCOUNT_ID, exp);

    const url = new URL(LINKCHAT_FRONTEND_URL);
    url.searchParams.set('lc_action',  'saborsan_contact');
    url.searchParams.set('lc_account', LINKCHAT_ACCOUNT_ID);
    url.searchParams.set('lc_phone',   phone);
    url.searchParams.set('lc_name',    clientName);
    url.searchParams.set('lc_exp',     String(exp));
    url.searchParams.set('lc_token',   token);

    return { jsonBody: { url: url.toString() } };
  },
});
