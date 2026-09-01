'use strict';

const { app }               = require('@azure/functions');
const sql                   = require('mssql');
const PDFDocument           = require('pdfkit');
const nodemailer            = require('nodemailer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { sendWabaTemplateMessage } = require('../linkchat-integration');

// ─── Brand colours ────────────────────────────────────────────────────────────
const C = {
  orange:     '#ff7a00',
  orangeDark: '#f25c00',
  navy:       '#06366f',
  navyDark:   '#052858',
  text:       '#23324a',
  muted:      '#758096',
  green:      '#20b26b',
  red:        '#ef4444',
  line:       '#e8ecf2',
  cream:      '#f7f0e5',
  white:      '#ffffff',
};

const sqlConfig = {
  server:   process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user:     process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options:  { encrypt: true, trustServerCertificate: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDateBR(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Derives [startDate, endDate] UTC based on frequency (dates are inclusive start, exclusive end). */
function getPeriodDates(frequency) {
  const nowUtc  = new Date();
  // Work in BRT (UTC-3) for calendar maths
  const nowBRT  = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);

  let start, end;

  if (frequency === 'diario') {
    // Yesterday full day
    const yesterday = new Date(nowBRT);
    yesterday.setDate(yesterday.getDate() - 1);
    start = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()) + 3 * 3600000);
    end   = new Date(Date.UTC(nowBRT.getFullYear(),    nowBRT.getMonth(),    nowBRT.getDate())    + 3 * 3600000);
  } else if (frequency === 'semanal') {
    // Last 7 days
    const sevenDaysAgo = new Date(nowBRT);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    start = new Date(Date.UTC(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate()) + 3 * 3600000);
    end   = new Date(Date.UTC(nowBRT.getFullYear(), nowBRT.getMonth(), nowBRT.getDate()) + 3 * 3600000);
  } else {
    // Last calendar month
    const firstOfThisMonth = new Date(nowBRT.getFullYear(), nowBRT.getMonth(), 1);
    const firstOfLastMonth = new Date(firstOfThisMonth);
    firstOfLastMonth.setMonth(firstOfLastMonth.getMonth() - 1);
    start = new Date(Date.UTC(firstOfLastMonth.getFullYear(), firstOfLastMonth.getMonth(), 1) + 3 * 3600000);
    end   = new Date(Date.UTC(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth(), 1) + 3 * 3600000);
  }

  return { start, end };
}

/** Human-readable period string e.g. "01/08 - 31/08/2026" */
function buildPeriodLabel(frequency) {
  const { start, end } = getPeriodDates(frequency);
  // end is exclusive, display end - 1 day
  const displayEnd = new Date(end.getTime() - 86400000);

  if (frequency === 'diario') {
    return formatDateBR(start);
  }
  const s = `${String(start.getDate()).padStart(2,'0')}/${String(start.getMonth()+1).padStart(2,'0')}`;
  const e = `${String(displayEnd.getDate()).padStart(2,'0')}/${String(displayEnd.getMonth()+1).padStart(2,'0')}/${displayEnd.getFullYear()}`;
  return `${s} - ${e}`;
}

const FREQ_LABELS = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };

function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

// ─── SQL queries ──────────────────────────────────────────────────────────────

async function fetchReportData(cfg, start, end) {
  const pool  = await sql.connect(sqlConfig);
  const data  = {};

  if (cfg.inclVendas) {
    const summary = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT
          COUNT(*)         AS totalPedidos,
          ISNULL(SUM(totalValue), 0)  AS faturamento,
          ISNULL(AVG(totalValue), 0)  AS ticketMedio
        FROM GestaoOrders
        WHERE deletedAt IS NULL AND createdAt >= @s AND createdAt < @e
      `);

    const byStatus = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT status, COUNT(*) AS qtd
        FROM GestaoOrders
        WHERE deletedAt IS NULL AND createdAt >= @s AND createdAt < @e
        GROUP BY status ORDER BY qtd DESC
      `);

    const topProducts = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT TOP 5 oi.productName, SUM(oi.quantity) AS totalVendido
        FROM GestaoOrderItems oi
        JOIN GestaoOrders o ON o.id = oi.orderId
        WHERE o.deletedAt IS NULL AND o.createdAt >= @s AND o.createdAt < @e
        GROUP BY oi.productName ORDER BY totalVendido DESC
      `);

    data.vendas = {
      ...summary.recordset[0],
      byStatus:    byStatus.recordset,
      topProducts: topProducts.recordset,
    };
  }

  if (cfg.inclEstoque) {
    const stock = await pool.request().query(`
      SELECT name, availableQuantity, category
      FROM Products
      WHERE active = 1
      ORDER BY availableQuantity ASC
    `).catch(() => ({ recordset: [] }));

    const consumed = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT TOP 10 oi.productName, SUM(oi.quantity) AS consumed
        FROM GestaoOrderItems oi
        JOIN GestaoOrders o ON o.id = oi.orderId
        WHERE o.deletedAt IS NULL AND o.createdAt >= @s AND o.createdAt < @e
        GROUP BY oi.productName ORDER BY consumed DESC
      `).catch(() => ({ recordset: [] }));

    data.estoque = {
      products: stock.recordset,
      consumed: consumed.recordset,
    };
  }

  if (cfg.inclFinanceiro) {
    const byMethod = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT paymentMethod,
               ISNULL(SUM(paymentValue), 0) AS total,
               COUNT(*) AS qtd
        FROM Payments
        WHERE createdAt >= @s AND createdAt < @e
        GROUP BY paymentMethod ORDER BY total DESC
      `).catch(() => ({ recordset: [] }));

    const totals = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN LOWER(status) IN ('pago','paid','concluído','concluido') THEN paymentValue ELSE 0 END), 0) AS pago,
          ISNULL(SUM(CASE WHEN LOWER(status) NOT IN ('pago','paid','concluído','concluido') THEN paymentValue ELSE 0 END), 0) AS pendente,
          ISNULL(SUM(paymentValue), 0) AS totalGeral
        FROM Payments
        WHERE createdAt >= @s AND createdAt < @e
      `).catch(() => ({ recordset: [{ pago: 0, pendente: 0, totalGeral: 0 }] }));

    data.financeiro = {
      byMethod: byMethod.recordset,
      ...totals.recordset[0],
    };
  }

  if (cfg.inclEntregas) {
    const byStatus = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT status, COUNT(*) AS qtd
        FROM Deliveries
        WHERE updated_at >= @s AND updated_at < @e
        GROUP BY status ORDER BY qtd DESC
      `).catch(() => ({ recordset: [] }));

    const bySeller = await pool.request()
      .input('s', sql.DateTime, start)
      .input('e', sql.DateTime, end)
      .query(`
        SELECT se.name AS sellerName, COUNT(d.id) AS qtd
        FROM Deliveries d
        LEFT JOIN Sellers se ON se.id = d.seller_id
        WHERE d.updated_at >= @s AND d.updated_at < @e
        GROUP BY se.name ORDER BY qtd DESC
      `).catch(() => ({ recordset: [] }));

    data.entregas = {
      byStatus:  byStatus.recordset,
      bySeller:  bySeller.recordset,
    };
  }

  return data;
}

// ─── PDF builder ─────────────────────────────────────────────────────────────

function buildPDF(reportData, periodLabel, freqLabel) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W     = doc.page.width;   // 595.28
    const M     = 40;               // side margin
    const IW    = W - M * 2;       // inner width

    // ── Page header ───────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 72).fill(C.navyDark);
    doc.rect(0, 72, W, 4).fill(C.orange);

    doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white)
       .text('SABORSAN', M, 18, { continued: false });
    doc.font('Helvetica').fontSize(9).fillColor(C.orange)
       .text('DISTRIBUIDORA', M, 41);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
       .text('RELATÓRIO GERENCIAL', M, 18, { align: 'right', width: IW });
    doc.font('Helvetica').fontSize(9).fillColor('#c8d8f0')
       .text(`${periodLabel}  ·  ${freqLabel}`, M, 41, { align: 'right', width: IW });

    let y = 92;

    // ── Helper: section title bar ─────────────────────────────────────────────
    function sectionTitle(title, icon = '●') {
      if (y > doc.page.height - 120) { doc.addPage(); y = 40; }
      doc.rect(M, y, IW, 28).fill(C.navy);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white)
         .text(`${icon}  ${title}`, M + 12, y + 8, { width: IW - 24 });
      y += 36;
    }

    // ── Helper: key-value row ─────────────────────────────────────────────────
    function kvRow(label, value, highlight = false) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
      doc.font('Helvetica').fontSize(9).fillColor(C.muted)
         .text(label, M, y, { width: IW * 0.6 });
      doc.font('Helvetica-Bold').fontSize(9)
         .fillColor(highlight ? C.orange : C.text)
         .text(value, M + IW * 0.6, y, { width: IW * 0.4, align: 'right' });
      y += 16;
      doc.moveTo(M, y - 2).lineTo(M + IW, y - 2).strokeColor(C.line).lineWidth(0.5).stroke();
    }

    // ── Helper: table ─────────────────────────────────────────────────────────
    function table(headers, rows, colWidths) {
      if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
      const rowH  = 20;
      const total = colWidths.reduce((a, b) => a + b, 0);

      // Header row
      doc.rect(M, y, total, rowH).fill(C.cream);
      let x = M;
      headers.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
           .text(h, x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
        x += colWidths[i];
      });
      y += rowH;

      rows.forEach((row, ri) => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        if (ri % 2 === 0) doc.rect(M, y, total, rowH).fill('#f9fbff');
        x = M;
        row.forEach((cell, i) => {
          doc.font('Helvetica').fontSize(8).fillColor(C.text)
             .text(String(cell ?? ''), x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
          x += colWidths[i];
        });
        doc.moveTo(M, y + rowH).lineTo(M + total, y + rowH).strokeColor(C.line).lineWidth(0.3).stroke();
        y += rowH;
      });
      y += 10;
    }

    // ── Resumo de vendas ──────────────────────────────────────────────────────
    if (reportData.vendas) {
      const v = reportData.vendas;
      sectionTitle('Resumo de Vendas', '🛒');
      kvRow('Total de pedidos',  String(v.totalPedidos || 0));
      kvRow('Faturamento total', formatBRL(v.faturamento), true);
      kvRow('Ticket médio',      formatBRL(v.ticketMedio));
      y += 8;

      if (v.byStatus?.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text('Pedidos por status', M, y);
        y += 14;
        table(
          ['Status', 'Quantidade'],
          v.byStatus.map(r => [r.status, r.qtd]),
          [IW * 0.7, IW * 0.3],
        );
      }

      if (v.topProducts?.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text('Top 5 produtos', M, y);
        y += 14;
        table(
          ['Produto', 'Qtd vendida'],
          v.topProducts.map(r => [r.productName, r.totalVendido]),
          [IW * 0.75, IW * 0.25],
        );
      }
    }

    // ── Movimentação de estoque ───────────────────────────────────────────────
    if (reportData.estoque) {
      const e = reportData.estoque;
      sectionTitle('Movimentação de Estoque', '📦');

      const low = e.products.filter(p => (p.availableQuantity || 0) <= 10);
      kvRow('Total de produtos ativos', String(e.products.length));
      kvRow('Produtos com estoque crítico (≤10)', String(low.length), low.length > 0);
      y += 8;

      if (e.consumed?.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text('Mais consumidos no período', M, y);
        y += 14;
        table(
          ['Produto', 'Consumo'],
          e.consumed.map(r => [r.productName, r.consumed]),
          [IW * 0.75, IW * 0.25],
        );
      }

      if (low.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.red).text('⚠ Estoque crítico', M, y);
        y += 14;
        table(
          ['Produto', 'Categoria', 'Qtd atual'],
          low.slice(0, 10).map(p => [p.name, p.category || '—', p.availableQuantity]),
          [IW * 0.5, IW * 0.3, IW * 0.2],
        );
      }
    }

    // ── Visão financeira ──────────────────────────────────────────────────────
    if (reportData.financeiro) {
      const f = reportData.financeiro;
      sectionTitle('Visão Financeira', '💰');
      kvRow('Total geral',    formatBRL(f.totalGeral), true);
      kvRow('Total recebido', formatBRL(f.pago));
      kvRow('Pendente',       formatBRL(f.pendente),   f.pendente > 0);
      y += 8;

      if (f.byMethod?.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text('Por forma de pagamento', M, y);
        y += 14;
        const grandTotal = f.byMethod.reduce((s, r) => s + Number(r.total), 0) || 1;
        table(
          ['Forma de pagamento', 'Total', 'Qtd', '%'],
          f.byMethod.map(r => [
            r.paymentMethod || 'Não informado',
            formatBRL(r.total),
            r.qtd,
            `${((r.total / grandTotal) * 100).toFixed(1)}%`,
          ]),
          [IW * 0.4, IW * 0.25, IW * 0.15, IW * 0.2],
        );
      }
    }

    // ── Desempenho de entregas ────────────────────────────────────────────────
    if (reportData.entregas) {
      const en = reportData.entregas;
      sectionTitle('Desempenho de Entregas', '🚚');

      const total = en.byStatus.reduce((s, r) => s + Number(r.qtd), 0);
      kvRow('Total de entregas', String(total));

      en.byStatus.forEach(r => kvRow(r.status, String(r.qtd)));
      y += 8;

      if (en.bySeller?.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy).text('Entregas por vendedor', M, y);
        y += 14;
        table(
          ['Vendedor', 'Entregas'],
          en.bySeller.map(r => [r.sellerName || 'Não atribuído', r.qtd]),
          [IW * 0.75, IW * 0.25],
        );
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 30;
    const genNow  = new Date();
    const brt     = new Date(genNow.getTime() - 3 * 3600000);
    const genStr  = `${String(brt.getDate()).padStart(2,'0')}/${String(brt.getMonth()+1).padStart(2,'0')}/${brt.getFullYear()} às ${String(brt.getHours()).padStart(2,'0')}:${String(brt.getMinutes()).padStart(2,'0')}`;

    doc.rect(0, footerY - 4, W, 34).fill(C.cream);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text(`Gerado em ${genStr}  ·  Sistema Saborsan`, M, footerY + 2, { align: 'center', width: IW });

    doc.end();
  });
}

// ─── Upload PDF to Azure Blob ─────────────────────────────────────────────────

async function uploadPDF(buffer, filename) {
  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr || connStr === 'UseDevelopmentStorage=true') return null;

  const blobService  = BlobServiceClient.fromConnectionString(connStr);
  const container    = blobService.getContainerClient('reports');
  await container.createIfNotExists({ access: 'blob' });

  const blobClient = container.getBlockBlobClient(filename);
  await blobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: 'application/pdf' },
  });
  return blobClient.url;
}

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendEmail(to, recipientName, periodLabel, freqLabel, pdfBuffer, filename) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[generate-send-report] SMTP not configured — email skipped.');
    return { success: false, error: 'SMTP não configurado.' };
  }

  const transport = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });

  const bodyHtml = `
    <p>Olá, <strong>${recipientName}</strong>!</p>
    <p>O relatório da Saborsan referente ao período <strong>${periodLabel}</strong> está disponível.</p>
    <p>📊 <strong>Relatório:</strong> ${freqLabel}</p>
    <p>O documento completo está anexado a esta mensagem em PDF.</p>
    <p>Caso necessário, acesse o sistema da Saborsan para consultar informações adicionais.</p>
  `;

  const fromAddress = process.env.SMTP_USER || user;

  try {
    await transport.sendMail({
      from:        `"Saborsan Sistema" <${fromAddress}>`,
      to,
      subject:     `Relatório Saborsan – ${freqLabel} – ${periodLabel}`,
      html:        bodyHtml,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── WhatsApp sender ──────────────────────────────────────────────────────────

async function sendWhatsApp(phone, recipientName, periodLabel, freqLabel, pdfUrl) {
  const normalised = normalisePhone(phone);
  if (!normalised) return { success: false, error: 'Telefone inválido.' };
  if (!pdfUrl) return { success: false, error: 'PDF URL indisponível — configure STORAGE_CONNECTION_STRING com um Azure Blob Storage real para envio via WhatsApp.' };

  const components = [
    {
      type: 'header',
      parameters: pdfUrl
        ? [{ type: 'document', document: { link: pdfUrl, filename: 'relatorio_saborsan.pdf' } }]
        : [],
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: recipientName || 'Gestor' },
        { type: 'text', text: periodLabel },
        { type: 'text', text: freqLabel },
      ],
    },
  ].filter(c => c.parameters.length > 0);

  return sendWabaTemplateMessage(normalised, 'relatorio_saborsan', 'pt_BR', components);
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function runReport(context) {
  await sql.connect(sqlConfig);

  const cfgResult = await sql.query`
    SELECT TOP 1 id, email, whatsapp, recipientName, frequency, sendDay, sendTime,
                 inclVendas, inclEstoque, inclFinanceiro, inclEntregas
    FROM ReportSettings ORDER BY id ASC
  `.catch(() => ({ recordset: [] }));

  if (!cfgResult.recordset.length) return { skipped: true, reason: 'Nenhuma configuração encontrada.' };

  const cfg = cfgResult.recordset[0];

  if (!cfg.frequency || cfg.frequency === 'desativado') {
    return { skipped: true, reason: 'Frequência desativada.' };
  }
  if (!cfg.email?.trim() && !cfg.whatsapp?.trim()) {
    return { skipped: true, reason: 'Nenhum destino configurado.' };
  }

  const { start, end }  = getPeriodDates(cfg.frequency);
  const periodLabel     = buildPeriodLabel(cfg.frequency);
  const freqLabel       = FREQ_LABELS[cfg.frequency] || cfg.frequency;
  const recipientName   = cfg.recipientName?.trim() || 'Gestor';

  context?.log(`[generate-send-report] Gerando relatório ${freqLabel}: ${periodLabel}`);

  const reportData = await fetchReportData(cfg, start, end);

  const pdfBuffer = await buildPDF(reportData, periodLabel, freqLabel);
  const filename  = `relatorio_saborsan_${cfg.frequency}_${Date.now()}.pdf`;

  // Upload to blob (null if local dev / storage not configured)
  const pdfUrl = await uploadPDF(pdfBuffer, filename).catch(() => null);
  context?.log(`[generate-send-report] PDF URL: ${pdfUrl || 'sem URL (dev local)'}`);

  const results = {};

  // Send via WhatsApp
  if (cfg.whatsapp?.trim()) {
    results.whatsapp = await sendWhatsApp(cfg.whatsapp, recipientName, periodLabel, freqLabel, pdfUrl);
    context?.log(`[generate-send-report] WhatsApp: ${JSON.stringify(results.whatsapp)}`);
  }

  // Send via email
  if (cfg.email?.trim()) {
    results.email = await sendEmail(cfg.email, recipientName, periodLabel, freqLabel, pdfBuffer, filename);
    context?.log(`[generate-send-report] Email: ${JSON.stringify(results.email)}`);
  }

  // Update lastSentAt
  await sql.query`UPDATE ReportSettings SET lastSentAt = GETUTCDATE() WHERE id = ${cfg.id}`.catch(() => {});

  return { success: true, periodLabel, freqLabel, results };
}

// ─── HTTP trigger (manual execution / status) ─────────────────────────────────

app.http('generate-send-report', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const result = await runReport(context);
      return { jsonBody: result };
    } catch (err) {
      context.error('[generate-send-report]', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

module.exports = { runReport };
