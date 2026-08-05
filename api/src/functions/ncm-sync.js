'use strict';
const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

const SISCOMEX_URL =
  'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json';

function parseDate(str) {
  if (!str) return null;
  const bySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (bySlash) return `${bySlash[3]}-${bySlash[2]}-${bySlash[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

function normalizeCode(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 10);
}

async function ensureTables() {
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'NcmCodes')
    BEGIN
      CREATE TABLE NcmCodes (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        code           NVARCHAR(10)   NOT NULL,
        description    NVARCHAR(1000) NOT NULL,
        validityStart  DATE           NULL,
        validityEnd    DATE           NULL,
        lastChangedAt  DATE           NULL,
        legalActType   NVARCHAR(100)  NULL,
        legalActNumber NVARCHAR(50)   NULL,
        legalActYear   NVARCHAR(10)   NULL,
        legalActUrl    NVARCHAR(500)  NULL,
        active         BIT            NOT NULL DEFAULT 1,
        syncedAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        createdAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        updatedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_NcmCodes_Code UNIQUE (code)
      );
      CREATE INDEX IX_NcmCodes_Active ON NcmCodes (active);
    END
  `;

  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'NcmClassificationLog')
    BEGIN
      CREATE TABLE NcmClassificationLog (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        productId       NVARCHAR(100)  NOT NULL,
        productName     NVARCHAR(255)  NOT NULL,
        ncmCode         NVARCHAR(10)   NULL,
        ncmDescription  NVARCHAR(1000) NULL,
        confidence      DECIMAL(5,2)   NULL,
        justification   NVARCHAR(2000) NULL,
        status          NVARCHAR(20)   NOT NULL DEFAULT 'pending',
        ncmTableVersion NVARCHAR(50)   NULL,
        analyzedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        createdAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
      );
      CREATE INDEX IX_NcmClassificationLog_ProductId ON NcmClassificationLog (productId);
    END
  `;

  // Columns tracking AI classification origin on ProductFiscalConfig
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'ncmSource')
    ALTER TABLE ProductFiscalConfig ADD ncmSource NVARCHAR(20) NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'ncmClassifiedAt')
    ALTER TABLE ProductFiscalConfig ADD ncmClassifiedAt DATETIME2 NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'ncmTableVersion')
    ALTER TABLE ProductFiscalConfig ADD ncmTableVersion NVARCHAR(50) NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'ncmConfidence')
    ALTER TABLE ProductFiscalConfig ADD ncmConfidence DECIMAL(5,2) NULL
  `;
}

async function runSync(context) {
  await sql.connect(sqlConfig);
  try {
    await ensureTables();

    context.log?.('Fetching NCM table from Siscomex...');
    const res = await fetch(SISCOMEX_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'SaborsanGestao/1.0' },
    });
    if (!res.ok) throw new Error(`Siscomex API error: HTTP ${res.status}`);

    const raw = await res.json();
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.Nomenclaturas)
        ? raw.Nomenclaturas
        : Array.isArray(raw?.nomenclaturas)
          ? raw.nomenclaturas
          : [];

    if (!items.length) throw new Error('Siscomex returned no NCM records');
    context.log?.(`Processing ${items.length} NCM codes...`);

    const parsed = [];
    for (const item of items) {
      const code = normalizeCode(item.Codigo ?? item.codigo ?? item.code);
      const description = String(item.Descricao ?? item.descricao ?? item.description ?? '').trim();
      if (!code || !description) continue;

      const ve = parseDate(item.DataFim ?? item.dataFim ?? item.validityEnd ?? null);
      parsed.push({
        code,
        description,
        validityStart: parseDate(item.DataInicio ?? item.dataInicio ?? item.validityStart ?? null),
        validityEnd: ve,
        lastChangedAt: parseDate(item.DataAlteracao ?? item.dataAlteracao ?? null),
        legalActType: String(item.TipoAto ?? item.tipoAto ?? '').trim() || null,
        legalActNumber: String(item.NumeroAto ?? item.numeroAto ?? '').trim() || null,
        legalActYear: String(item.AnoAto ?? item.anoAto ?? '').trim() || null,
        legalActUrl: String(item.UrlAto ?? item.urlAto ?? '').trim() || null,
        // Active if no expiry date or expiry is in the future
        active: !ve || new Date(ve) >= new Date() ? 1 : 0,
      });
    }

    const syncStart = new Date().toISOString();

    // Upsert via single-row MERGE, 30 at a time in parallel
    const CHUNK = 30;
    for (let i = 0; i < parsed.length; i += CHUNK) {
      await Promise.all(
        parsed.slice(i, i + CHUNK).map((item) => {
          const r = new sql.Request();
          r.input('code', sql.NVarChar(10), item.code);
          r.input('desc', sql.NVarChar(1000), item.description);
          r.input('vs', sql.Date, item.validityStart);
          r.input('ve', sql.Date, item.validityEnd);
          r.input('lc', sql.Date, item.lastChangedAt);
          r.input('lat', sql.NVarChar(100), item.legalActType);
          r.input('lan', sql.NVarChar(50), item.legalActNumber);
          r.input('lay', sql.NVarChar(10), item.legalActYear);
          r.input('lau', sql.NVarChar(500), item.legalActUrl);
          r.input('active', sql.Bit, item.active);
          return r.query(`
            MERGE NcmCodes AS t
            USING (VALUES (@code,@desc,@vs,@ve,@lc,@lat,@lan,@lay,@lau,@active))
              AS s(code,description,validityStart,validityEnd,lastChangedAt,
                   legalActType,legalActNumber,legalActYear,legalActUrl,active)
            ON t.code = s.code
            WHEN MATCHED THEN UPDATE SET
              t.description    = s.description,
              t.validityStart  = s.validityStart,
              t.validityEnd    = s.validityEnd,
              t.lastChangedAt  = s.lastChangedAt,
              t.legalActType   = s.legalActType,
              t.legalActNumber = s.legalActNumber,
              t.legalActYear   = s.legalActYear,
              t.legalActUrl    = s.legalActUrl,
              t.active         = s.active,
              t.syncedAt       = GETUTCDATE(),
              t.updatedAt      = GETUTCDATE()
            WHEN NOT MATCHED THEN INSERT
              (code,description,validityStart,validityEnd,lastChangedAt,
               legalActType,legalActNumber,legalActYear,legalActUrl,active)
            VALUES
              (s.code,s.description,s.validityStart,s.validityEnd,s.lastChangedAt,
               s.legalActType,s.legalActNumber,s.legalActYear,s.legalActUrl,s.active);
          `);
        })
      );
    }

    // Mark codes not touched in this sync as inactive
    const deactivateReq = new sql.Request();
    deactivateReq.input('syncStart', sql.DateTime2, syncStart);
    const deactivated = await deactivateReq.query(`
      UPDATE NcmCodes SET active = 0, updatedAt = GETUTCDATE()
      WHERE active = 1 AND syncedAt < @syncStart
    `);

    const stats = await sql.query`
      SELECT
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END)               AS activeCount,
        CONVERT(NVARCHAR(50), MAX(syncedAt), 127)                  AS lastSyncedAt
      FROM NcmCodes
    `;

    return {
      success: true,
      processedCount: parsed.length,
      deactivatedCount: deactivated.rowsAffected?.[0] ?? 0,
      ...stats.recordset[0],
    };
  } finally {
    try { await sql.close(); } catch (_) {}
  }
}

// HTTP trigger — manual sync (POST) and status check (GET)
app.http('ncm-sync', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'ncm/sync',
  handler: async (request, context) => {
    try {
      if (request.method === 'GET') {
        await sql.connect(sqlConfig);
        try {
          await ensureTables();
          const stats = await sql.query`
            SELECT
              COUNT(*)                                             AS total,
              SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END)         AS activeCount,
              CONVERT(NVARCHAR(50), MAX(syncedAt), 127)            AS lastSyncedAt
            FROM NcmCodes
          `;
          return { jsonBody: { ...stats.recordset[0] } };
        } finally {
          try { await sql.close(); } catch (_) {}
        }
      }

      const result = await runSync(context);
      return { jsonBody: result };
    } catch (err) {
      context.error('ncm-sync error:', err);
      return { status: 500, jsonBody: { error: err.message || 'Erro na sincronização NCM' } };
    }
  },
});

// Timer trigger — every Monday at 03:00 UTC
app.timer('ncm-sync-timer', {
  schedule: '0 0 3 * * 1',
  handler: async (myTimer, context) => {
    try {
      const result = await runSync(context);
      context.log('NCM weekly sync completed:', result);
    } catch (err) {
      context.error('NCM sync timer error:', err);
    }
  },
});
