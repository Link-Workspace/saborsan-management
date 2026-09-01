'use strict';

const { app } = require('@azure/functions');
const sql     = require('mssql');
const { runReport } = require('./generate-send-report');

const sqlConfig = {
  server:   process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user:     process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options:  { encrypt: true, trustServerCertificate: false },
};

// ─── Timer: fires every minute ────────────────────────────────────────────────
app.timer('reportSchedulerTimer', {
  schedule: '0 * * * * *',
  handler: async (myTimer, context) => {
    try {
      await sql.connect(sqlConfig);

      const cfgResult = await sql.query`
        SELECT TOP 1 frequency, sendDay, sendTime, lastSentAt, email, whatsapp
        FROM ReportSettings ORDER BY id ASC
      `.catch(() => ({ recordset: [] }));

      if (!cfgResult.recordset.length) return;

      const cfg = cfgResult.recordset[0];
      if (!cfg.frequency || cfg.frequency === 'desativado') return;
      if (!cfg.email?.trim() && !cfg.whatsapp?.trim()) return;

      // Work in BRT (UTC-3)
      const nowUtc = new Date();
      const nowBRT = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
      const currentTime = `${String(nowBRT.getHours()).padStart(2, '0')}:${String(nowBRT.getMinutes()).padStart(2, '0')}`;

      const sendTime = cfg.sendTime || '08:00';
      if (currentTime !== sendTime) return;

      const lastSent = cfg.lastSentAt ? new Date(cfg.lastSentAt) : null;

      let shouldSend = false;

      if (cfg.frequency === 'diario') {
        // Send once per day: last sent was not today (BRT)
        if (!lastSent) {
          shouldSend = true;
        } else {
          const lastBRT = new Date(lastSent.getTime() - 3 * 3600000);
          shouldSend = lastBRT.toDateString() !== nowBRT.toDateString();
        }
      } else if (cfg.frequency === 'semanal') {
        // Send on Mondays (day 1), or if more than 7 days since last send
        const isMonday = nowBRT.getDay() === 1;
        if (!isMonday) return;
        if (!lastSent) {
          shouldSend = true;
        } else {
          const daysSince = (nowUtc - lastSent) / (1000 * 60 * 60 * 24);
          shouldSend = daysSince >= 6.5;
        }
      } else if (cfg.frequency === 'mensal') {
        // Send on the configured day of the month
        const sendDay = parseInt(cfg.sendDay || '1', 10);
        if (nowBRT.getDate() !== sendDay) return;
        if (!lastSent) {
          shouldSend = true;
        } else {
          const lastBRT = new Date(lastSent.getTime() - 3 * 3600000);
          // Not already sent this month
          shouldSend = lastBRT.getMonth() !== nowBRT.getMonth() || lastBRT.getFullYear() !== nowBRT.getFullYear();
        }
      }

      if (!shouldSend) return;

      context.log('[report-scheduler] Hora de enviar relatório. Disparando...');
      const result = await runReport(context);
      context.log('[report-scheduler] Resultado:', JSON.stringify(result));
    } catch (err) {
      context.error('[report-scheduler] Erro:', err);
    }
  },
});
