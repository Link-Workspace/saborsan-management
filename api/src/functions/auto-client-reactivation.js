'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');
const { getLinkChatAccountInfo, sendWabaTemplateMessage } = require('../linkchat-integration');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

async function ensureTables() {
  // New columns on the shared AutomationConfig table
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_inactive_days')
      ALTER TABLE AutomationConfig ADD cr_inactive_days INT NOT NULL DEFAULT 30
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_message_type')
      ALTER TABLE AutomationConfig ADD cr_message_type NVARCHAR(20) NULL
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_waba_template_promo_id')
      ALTER TABLE AutomationConfig ADD cr_waba_template_promo_id NVARCHAR(200) NULL
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_waba_template_catalog_id')
      ALTER TABLE AutomationConfig ADD cr_waba_template_catalog_id NVARCHAR(200) NULL
  `.catch(() => {});

  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_resend_days')
      ALTER TABLE AutomationConfig ADD cr_resend_days INT NOT NULL DEFAULT 30
  `.catch(() => {});

  // Tracks every template message sent so we don't spam the same client
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ClientReactivationLog')
    CREATE TABLE ClientReactivationLog (
      id             INT           IDENTITY(1,1) NOT NULL,
      client_id      INT           NOT NULL,
      client_phone   NVARCHAR(30)  NOT NULL,
      message_type   NVARCHAR(20)  NOT NULL,
      template_id    NVARCHAR(200) NULL,
      status         NVARCHAR(50)  NOT NULL DEFAULT 'SENT',
      error_message  NVARCHAR(500) NULL,
      sent_at        DATETIME      NOT NULL DEFAULT GETUTCDATE(),
      CONSTRAINT PK_ClientReactivationLog PRIMARY KEY CLUSTERED (id ASC)
    )
  `.catch(() => {});

  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationRunLog')
    CREATE TABLE AutomationRunLog (
      id              INT           IDENTITY(1,1) NOT NULL,
      automation_key  NVARCHAR(100) NOT NULL,
      result_message  NVARCHAR(500) NULL,
      created_at      DATETIME      NOT NULL DEFAULT GETUTCDATE(),
      CONSTRAINT PK_AutomationRunLog PRIMARY KEY CLUSTERED (id ASC)
    )
  `.catch(() => {});
}

/**
 * Normalises a raw phone string to E.164 digit-only format (Brazilian default).
 * Returns null when the number is clearly invalid.
 */
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Prefix with Brazil country code if missing
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return null;
}

async function setCrProgress(step, isRunning = true) {
  try {
    await sql.query`UPDATE AutomationConfig SET cr_is_running=${isRunning?1:0}, cr_current_step=${step}, updated_at=GETUTCDATE() WHERE automation_key='client_reactivation'`;
  } catch (_) {}
}

async function runAutoClientReactivation(context) {
  await sql.connect(sqlConfig);
  await ensureTables();

  // ── Load automation config ────────────────────────────────────────────────
  const cfgResult = await sql.query`
    SELECT is_active, cr_inactive_days, cr_message_type,
           cr_waba_template_promo_id, cr_waba_template_catalog_id, cr_resend_days,
           time_interval_minutes, time_start, time_end
    FROM AutomationConfig WHERE automation_key = 'client_reactivation'
  `.catch(() => ({ recordset: [] }));

  if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) {
    return { skipped: true, reason: 'Automação não está ativa.' };
  }

  const cfg = cfgResult.recordset[0];
  const inactiveDays   = cfg.cr_inactive_days ?? 30;
  const resendDays     = cfg.cr_resend_days ?? 30;
  const messageType    = cfg.cr_message_type ?? 'promotion';
  // DB value takes priority; env var is the project-level default
  const templateId     = messageType === 'catalog'
    ? (cfg.cr_waba_template_catalog_id || process.env.CR_WABA_TEMPLATE_CATALOG_ID || null)
    : (cfg.cr_waba_template_promo_id   || process.env.CR_WABA_TEMPLATE_PROMO_ID   || null);
  const templateName   = templateId ?? (messageType === 'catalog' ? 'saborsan_catalogo' : 'saborsan_promocao');

  // ── Check configured time window ─────────────────────────────────────────
  const nowUtc  = new Date();
  const nowBRT  = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const currentTime = `${String(nowBRT.getHours()).padStart(2, '0')}:${String(nowBRT.getMinutes()).padStart(2, '0')}`;

  if (cfg.time_start && cfg.time_end) {
    const overnight = cfg.time_end < cfg.time_start;
    const inWindow  = overnight
      ? (currentTime >= cfg.time_start || currentTime <= cfg.time_end)
      : (currentTime >= cfg.time_start && currentTime <= cfg.time_end);
    if (!inWindow) return { skipped: true, reason: 'Fora do horário configurado.' };
  }
  await setCrProgress('Buscando clientes inativos...');
  // ── Fetch operating-hours context from LinkChat (future integration) ──────
  // When the LinkChat ↔ Saborsan link is fully wired, this call will return
  // the actual operating hours from the Saborsan AI prompt, allowing the
  // automation to further restrict sends to business hours.
  const linkChatInfo = await getLinkChatAccountInfo().catch(() => null);
  context?.log(`[auto-client-reactivation] LinkChat info: ${linkChatInfo ? 'obtido' : 'não disponível'}`);

  // ── Find inactive clients with a registered phone number ─────────────────
  // A client is "inactive" when they have placed no non-deleted order in the
  // last `inactiveDays` days AND have not already received a reactivation
  // message in that same window (avoiding duplicate sends).
  const inactiveResult = await sql.query`
    SELECT c.id, c.contactNumber, c.establishmentName
    FROM Clients c
    WHERE c.contactNumber IS NOT NULL
      AND LEN(TRIM(c.contactNumber)) >= 10
      AND NOT EXISTS (
        SELECT 1 FROM GestaoOrders o
        WHERE o.clientId = c.id
          AND o.deletedAt IS NULL
          AND o.createdAt >= DATEADD(day, -${inactiveDays}, GETUTCDATE())
      )
      AND NOT EXISTS (
        SELECT 1 FROM ClientReactivationLog l
        WHERE l.client_id = c.id
          AND l.status = 'SENT'
          AND l.sent_at >= DATEADD(day, -${resendDays}, GETUTCDATE())
          AND NOT EXISTS (
            SELECT 1 FROM GestaoOrders o2
            WHERE o2.clientId = c.id
              AND o2.deletedAt IS NULL
              AND o2.createdAt > l.sent_at
          )
      )
  `.catch(() => ({ recordset: [] }));

  const candidates = inactiveResult.recordset;
  context?.log(`[auto-client-reactivation] ${candidates.length} cliente(s) inativo(s) encontrado(s).`);

  if (!candidates.length) {
    const msg = 'Nenhum cliente inativo encontrado para envio.';
    await sql.query`INSERT INTO AutomationRunLog (automation_key, result_message) VALUES ('client_reactivation', ${msg})`.catch(() => {});
    await setCrProgress(msg, false);
    return { success: true, sent: 0, failed: 0, message: msg };
  }

  await setCrProgress(`Encontrado(s) ${candidates.length} cliente(s) inativo(s). Enviando mensagens...`);

  // Image URL for the promotion template header (set PROMO_HEADER_IMAGE_URL in env)
  const promoImageUrl = messageType === 'promotion' ? (process.env.PROMO_HEADER_IMAGE_URL || null) : null;
  const templateComponents = promoImageUrl
    ? [{ type: 'header', parameters: [{ type: 'image', image: { link: promoImageUrl } }] }]
    : [];

  // ── Send WABA template to each inactive client ────────────────────────────
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const [idx, client] of candidates.entries()) {
    await setCrProgress(`Enviando mensagem para cliente ${client.establishmentName || client.id} (${idx + 1}/${candidates.length})...`);
    const phone = normalisePhone(client.contactNumber);
    if (!phone) {
      context?.log(`[auto-client-reactivation] Telefone inválido para cliente ${client.id}: "${client.contactNumber}"`);
      continue;
    }

    const result = await sendWabaTemplateMessage(phone, templateName, 'pt_BR', templateComponents);

    if (result.success) {
      await sql.query`
        INSERT INTO ClientReactivationLog (client_id, client_phone, message_type, template_id, status)
        VALUES (${client.id}, ${phone}, ${messageType}, ${templateId}, 'SENT')
      `.catch(() => {});
      sent++;
      context?.log(`[auto-client-reactivation] Mensagem enviada para cliente ${client.id} (${phone})`);
    } else {
      await sql.query`
        INSERT INTO ClientReactivationLog (client_id, client_phone, message_type, template_id, status, error_message)
        VALUES (${client.id}, ${phone}, ${messageType}, ${templateId}, 'FAILED', ${result.error ?? ''})
      `.catch(() => {});
      failed++;
      errors.push(`cliente ${client.id}: ${result.error}`);
      context?.log(`[auto-client-reactivation] Falha ao enviar para cliente ${client.id}: ${result.error}`);
    }
  }

  const resultMessage = `${sent} mensagem(ns) enviada(s), ${failed} falha(s).`;
  await sql.query`
    INSERT INTO AutomationRunLog (automation_key, result_message)
    VALUES ('client_reactivation', ${resultMessage})
  `.catch(() => {});
  await setCrProgress(resultMessage, false);

  return { success: true, sent, failed, errors, message: resultMessage };
}

// ── HTTP trigger (status check + manual execution) ────────────────────────────

app.http('auto-client-reactivation', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const cfgResult = await sql.query`
          SELECT is_active, updated_at FROM AutomationConfig WHERE automation_key = 'client_reactivation'
        `.catch(() => ({ recordset: [] }));

        const lastRun = await sql.query`
          SELECT TOP 1 created_at, result_message FROM AutomationRunLog
          WHERE automation_key = 'client_reactivation'
          ORDER BY id DESC
        `.catch(() => ({ recordset: [] }));

        return {
          jsonBody: {
            isActive: cfgResult.recordset[0]?.is_active ?? false,
            lastRun: lastRun.recordset[0] || null,
          },
        };
      }

      const result = await runAutoClientReactivation(context);
      return { jsonBody: result };
    } catch (err) {
      context.error('[auto-client-reactivation] Erro:', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ── Timer trigger — fires every minute, respects configured interval ──────────

app.timer('autoClientReactivationTimer', {
  schedule: '0 * * * * *',
  handler: async (myTimer, context) => {
    try {
      await sql.connect(sqlConfig);

      const cfgResult = await sql.query`
        SELECT is_active, time_interval_minutes
        FROM AutomationConfig WHERE automation_key = 'client_reactivation'
      `.catch(() => ({ recordset: [] }));

      if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) return;

      const intervalMinutes = cfgResult.recordset[0].time_interval_minutes || 60;

      const lastRunResult = await sql.query`
        SELECT TOP 1 created_at FROM AutomationRunLog
        WHERE automation_key = 'client_reactivation'
        ORDER BY id DESC
      `.catch(() => ({ recordset: [] }));

      if (lastRunResult.recordset.length) {
        const lastRun = new Date(lastRunResult.recordset[0].created_at);
        const minutesSince = (Date.now() - lastRun.getTime()) / 60000;
        if (minutesSince < intervalMinutes) return;
      }

      const result = await runAutoClientReactivation(context);
      context.log('[auto-client-reactivation] timer:', result.message || result.reason || JSON.stringify(result));
    } catch (err) {
      context.error('[auto-client-reactivation] Erro no timer:', err);
    }
  },
});
