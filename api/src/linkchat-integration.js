'use strict';

/**
 * LinkChat Integration Module
 *
 * Provides a clean interface for this project to communicate with the LinkChat
 * backend. All credentials are read exclusively from environment variables —
 * nothing sensitive is hardcoded here.
 *
 * Required env vars (configure in api/local.settings.json for local dev,
 * and in Azure Function App Settings for production):
 *
 *   LINKCHAT_API_URL          – Base URL of the LinkChat backend
 *                               e.g. "https://linkchat-api-bjcffsb2dvebeeah.brazilsouth-01.azurewebsites.net"
 *   LINKCHAT_INTEGRATION_KEY  – Shared secret key that the LinkChat server
 *                               also knows. Prevents unauthorised calls to the
 *                               internal integration endpoints.
 *   LINKCHAT_ACCOUNT_ID       – Numeric account ID of the Saborsan account
 *                               inside the LinkChat platform.
 */

const LINKCHAT_API_URL        = process.env.LINKCHAT_API_URL        || '';
const LINKCHAT_INTEGRATION_KEY = process.env.LINKCHAT_INTEGRATION_KEY || '';
const LINKCHAT_ACCOUNT_ID     = process.env.LINKCHAT_ACCOUNT_ID     || '';

function integrationHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Integration-Key': LINKCHAT_INTEGRATION_KEY,
    'X-Account-Id': LINKCHAT_ACCOUNT_ID,
  };
}

function isConfigured() {
  return !!(LINKCHAT_API_URL && LINKCHAT_INTEGRATION_KEY && LINKCHAT_ACCOUNT_ID);
}

/**
 * Returns the AI base instructions (system prompt) stored in the Saborsan
 * account on LinkChat. This text normally contains operating hours, business
 * description and tone guidelines.
 *
 * When the full LinkChat ↔ Saborsan integration is implemented, this function
 * will be called to extract operating hours / send-window constraints so the
 * automation can respect them automatically.
 *
 * @returns {{ prompt: string, operatingHours: string|null } | null}
 */
async function getLinkChatAccountInfo() {
  if (!isConfigured()) {
    // Integration not yet wired up — return sensible defaults so the
    // automation can run without LinkChat during development.
    return { prompt: '', operatingHours: null };
  }

  try {
    const res = await fetch(
      `${LINKCHAT_API_URL}/api/integration/saborsan/account-info`,
      { headers: integrationHeaders(), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Lists the WABA message templates available on the Saborsan WhatsApp Business
 * account. Returns an array of { id, name, body } objects (no credentials
 * included — those stay inside LinkChat).
 *
 * @returns {Array<{ id: string, name: string, body: string, category: string }> | null}
 */
async function getLinkChatWabaTemplates() {
  if (!isConfigured()) return null;

  try {
    const res = await fetch(
      `${LINKCHAT_API_URL}/api/integration/saborsan/waba-templates`,
      { headers: integrationHeaders(), signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Asks the LinkChat backend to send a WABA template message to a given phone
 * number on behalf of the Saborsan account. The actual WhatsApp credentials
 * never leave the LinkChat server.
 *
 * @param {string} toPhone   – E.164 phone number (digits only, e.g. "5549999990001")
 * @param {string} templateName – Template name as registered in Meta
 * @param {string} languageCode – IETF tag, e.g. "pt_BR"
 * @param {Array}  components  – Optional template component parameters
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendWabaTemplateMessage(toPhone, templateName, languageCode = 'pt_BR', components = []) {
  if (!isConfigured()) {
    // Stub: log and pretend success during development
    console.warn('[linkchat-integration] Integration not configured — template send skipped.');
    return { success: false, error: 'Integration not configured' };
  }

  try {
    const res = await fetch(
      `${LINKCHAT_API_URL}/api/integration/saborsan/send-template`,
      {
        method: 'POST',
        headers: integrationHeaders(),
        body: JSON.stringify({ toPhone, templateName, languageCode, components }),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: text || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { getLinkChatAccountInfo, getLinkChatWabaTemplates, sendWabaTemplateMessage, isConfigured };
