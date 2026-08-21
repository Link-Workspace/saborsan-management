const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

async function ensureTables() {
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationConfig')
    CREATE TABLE AutomationConfig (
      id INT PRIMARY KEY IDENTITY,
      automation_key NVARCHAR(100) NOT NULL UNIQUE,
      is_active BIT NOT NULL DEFAULT 0,
      min_orders INT NOT NULL DEFAULT 1,
      max_orders INT NOT NULL DEFAULT 10,
      max_cities INT NOT NULL DEFAULT 5,
      include_route_cities BIT NOT NULL DEFAULT 0,
      time_interval_minutes INT NOT NULL DEFAULT 30,
      time_start NVARCHAR(5) NULL,
      time_end NVARCHAR(5) NULL,
      nfe_notify_on_error BIT NOT NULL DEFAULT 0,
      nfe_notify_seller_id INT NULL,
      nfe_print_danfe_auto BIT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT GETUTCDATE(),
      updated_at DATETIME DEFAULT GETUTCDATE()
    )
  `;
  // Migrate existing table: add NF-e columns if missing
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'nfe_notify_on_error')
      ALTER TABLE AutomationConfig ADD nfe_notify_on_error BIT NOT NULL DEFAULT 0
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'nfe_notify_seller_id')
      ALTER TABLE AutomationConfig ADD nfe_notify_seller_id INT NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'nfe_print_danfe_auto')
      ALTER TABLE AutomationConfig ADD nfe_print_danfe_auto BIT NOT NULL DEFAULT 0
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationSellerBindings')
    CREATE TABLE AutomationSellerBindings (
      id INT PRIMARY KEY IDENTITY,
      automation_key NVARCHAR(100) NOT NULL,
      seller_id INT NOT NULL,
      binding_type NVARCHAR(10) NOT NULL,
      binding_value NVARCHAR(200) NOT NULL,
      created_at DATETIME DEFAULT GETUTCDATE()
    )
  `;
  // Stock Replenishment columns
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'sr_min_stock_qty')
      ALTER TABLE AutomationConfig ADD sr_min_stock_qty INT NOT NULL DEFAULT 5
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'sr_max_purchase_qty')
      ALTER TABLE AutomationConfig ADD sr_max_purchase_qty INT NOT NULL DEFAULT 50
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'sr_notify_times')
      ALTER TABLE AutomationConfig ADD sr_notify_times NVARCHAR(MAX) NULL
  `;
  // Client Reactivation columns
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_inactive_days')
      ALTER TABLE AutomationConfig ADD cr_inactive_days INT NOT NULL DEFAULT 30
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_message_type')
      ALTER TABLE AutomationConfig ADD cr_message_type NVARCHAR(20) NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_waba_template_promo_id')
      ALTER TABLE AutomationConfig ADD cr_waba_template_promo_id NVARCHAR(200) NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'cr_waba_template_catalog_id')
      ALTER TABLE AutomationConfig ADD cr_waba_template_catalog_id NVARCHAR(200) NULL
  `;
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StockReplenishmentCategoryBindings')
    CREATE TABLE StockReplenishmentCategoryBindings (
      id          INT           IDENTITY(1,1) NOT NULL,
      supplier_id INT           NOT NULL,
      category    NVARCHAR(100) NOT NULL,
      created_at  DATETIME      NOT NULL DEFAULT GETUTCDATE(),
      CONSTRAINT PK_StockReplenishmentCategoryBindings PRIMARY KEY CLUSTERED (id ASC)
    )
  `;
}

app.http('automation-config', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTables();

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const key = url.searchParams.get('key') || 'receive_orders';

        const cfgResult = await sql.query`
          SELECT is_active, min_orders, max_orders, max_cities, include_route_cities,
                 time_interval_minutes, time_start, time_end,
                 nfe_notify_on_error, nfe_notify_seller_id, nfe_print_danfe_auto,
                 sr_min_stock_qty, sr_max_purchase_qty, sr_notify_times,
                 cr_inactive_days, cr_message_type,
                 cr_waba_template_promo_id, cr_waba_template_catalog_id
          FROM AutomationConfig
          WHERE automation_key = ${key}
        `;

        const bindingsResult = await sql.query`
          SELECT b.id, b.seller_id, u.name AS seller_name, b.binding_type, b.binding_value
          FROM AutomationSellerBindings b
          INNER JOIN Sellers s ON b.seller_id = s.id
          INNER JOIN Users u ON s.userId = u.id
          WHERE b.automation_key = ${key}
          ORDER BY b.id ASC
        `;

        let categoryBindings = [];
        if (key === 'stock_replenishment') {
          const cbResult = await sql.query`
            SELECT b.id, b.supplier_id, s.name AS supplier_name, b.category
            FROM StockReplenishmentCategoryBindings b
            INNER JOIN Suppliers s ON b.supplier_id = s.id
            ORDER BY b.category ASC, b.id ASC
          `.catch(() => ({ recordset: [] }));
          categoryBindings = cbResult.recordset.map((b) => ({
            id: b.id,
            supplierId: b.supplier_id,
            supplierName: b.supplier_name,
            category: b.category,
          }));
        }

        if (!cfgResult.recordset.length) {
          return { jsonBody: { config: null, bindings: [], categoryBindings } };
        }

        const row = cfgResult.recordset[0];
        let srNotifyTimes = [];
        try { srNotifyTimes = JSON.parse(row.sr_notify_times || '[]'); } catch { srNotifyTimes = []; }

        return {
          jsonBody: {
            config: {
              isActive: !!row.is_active,
              minOrders: row.min_orders,
              maxOrders: row.max_orders,
              maxCities: row.max_cities,
              includeRouteCities: !!row.include_route_cities,
              timeIntervalMinutes: row.time_interval_minutes,
              timeStart: row.time_start,
              timeEnd: row.time_end,
              nfeNotifyOnError: !!row.nfe_notify_on_error,
              nfeNotifySellerId: row.nfe_notify_seller_id ?? null,
              nfePrintDanfeAuto: !!row.nfe_print_danfe_auto,
              srMinStockQty: row.sr_min_stock_qty ?? 5,
              srMaxPurchaseQty: row.sr_max_purchase_qty ?? 50,
              srNotifyTimes,
              crInactiveDays: row.cr_inactive_days ?? 30,
              crMessageType: row.cr_message_type ?? 'promotion',
              crWabaTemplatePromoId: row.cr_waba_template_promo_id ?? process.env.CR_WABA_TEMPLATE_PROMO_ID ?? null,
              crWabaTemplateCatalogId: row.cr_waba_template_catalog_id ?? process.env.CR_WABA_TEMPLATE_CATALOG_ID ?? null,
            },
            bindings: bindingsResult.recordset.map((b) => ({
              id: b.id,
              sellerId: b.seller_id,
              sellerName: b.seller_name,
              bindingType: b.binding_type,
              bindingValue: b.binding_value,
            })),
            categoryBindings,
          },
        };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { key = 'receive_orders', config = {}, bindings, categoryBindings } = body;

        const existing = await sql.query`SELECT id FROM AutomationConfig WHERE automation_key = ${key}`;

        const isActive = config.isActive !== undefined ? (config.isActive ? 1 : 0) : null;
        const minOrders = config.minOrders ?? null;
        const maxOrders = config.maxOrders ?? null;
        const maxCities = config.maxCities ?? null;
        const includeRouteCities = config.includeRouteCities !== undefined ? (config.includeRouteCities ? 1 : 0) : null;
        const timeIntervalMinutes = config.timeIntervalMinutes ?? null;
        const timeStart = config.timeStart ?? null;
        const timeEnd = config.timeEnd ?? null;
        const nfeNotifyOnError = config.nfeNotifyOnError !== undefined ? (config.nfeNotifyOnError ? 1 : 0) : null;
        const nfeNotifySellerId = config.nfeNotifySellerId !== undefined ? (config.nfeNotifySellerId ?? null) : null;
        const nfePrintDanfeAuto = config.nfePrintDanfeAuto !== undefined ? (config.nfePrintDanfeAuto ? 1 : 0) : null;
        const srMinStockQty = config.srMinStockQty ?? null;
        const srMaxPurchaseQty = config.srMaxPurchaseQty ?? null;
        const srNotifyTimes = config.srNotifyTimes !== undefined ? JSON.stringify(config.srNotifyTimes) : null;
        const crInactiveDays = config.crInactiveDays ?? null;
        const crMessageType = config.crMessageType ?? null;
        const crWabaTemplatePromoId = config.crWabaTemplatePromoId !== undefined ? (config.crWabaTemplatePromoId ?? null) : null;
        const crWabaTemplateCatalogId = config.crWabaTemplateCatalogId !== undefined ? (config.crWabaTemplateCatalogId ?? null) : null;

        if (!existing.recordset.length) {
          await sql.query`
            INSERT INTO AutomationConfig
              (automation_key, is_active, min_orders, max_orders, max_cities, include_route_cities, time_interval_minutes, time_start, time_end, nfe_notify_on_error, nfe_notify_seller_id, nfe_print_danfe_auto, sr_min_stock_qty, sr_max_purchase_qty, sr_notify_times, cr_inactive_days, cr_message_type, cr_waba_template_promo_id, cr_waba_template_catalog_id, updated_at)
            VALUES
              (${key},
               ${isActive ?? 0},
               ${minOrders ?? 1},
               ${maxOrders ?? 10},
               ${maxCities ?? 5},
               ${includeRouteCities ?? 0},
               ${timeIntervalMinutes ?? 30},
               ${timeStart ?? '07:00'},
               ${timeEnd ?? '18:00'},
               ${nfeNotifyOnError ?? 0},
               ${nfeNotifySellerId ?? null},
               ${nfePrintDanfeAuto ?? 0},
               ${srMinStockQty ?? 5},
               ${srMaxPurchaseQty ?? 50},
               ${srNotifyTimes ?? '[]'},
               ${crInactiveDays ?? 30},
               ${crMessageType ?? 'promotion'},
               ${crWabaTemplatePromoId ?? null},
               ${crWabaTemplateCatalogId ?? null},
               GETUTCDATE())
          `;
        } else {
          // Only update provided fields
          const currentRow = (await sql.query`SELECT * FROM AutomationConfig WHERE automation_key = ${key}`).recordset[0];
          await sql.query`
            UPDATE AutomationConfig SET
              is_active                    = ${isActive !== null ? isActive : currentRow.is_active},
              min_orders                   = ${minOrders !== null ? minOrders : currentRow.min_orders},
              max_orders                   = ${maxOrders !== null ? maxOrders : currentRow.max_orders},
              max_cities                   = ${maxCities !== null ? maxCities : currentRow.max_cities},
              include_route_cities         = ${includeRouteCities !== null ? includeRouteCities : currentRow.include_route_cities},
              time_interval_minutes        = ${timeIntervalMinutes !== null ? timeIntervalMinutes : currentRow.time_interval_minutes},
              time_start                   = ${timeStart !== null ? timeStart : currentRow.time_start},
              time_end                     = ${timeEnd !== null ? timeEnd : currentRow.time_end},
              nfe_notify_on_error          = ${nfeNotifyOnError !== null ? nfeNotifyOnError : currentRow.nfe_notify_on_error},
              nfe_notify_seller_id         = ${nfeNotifySellerId !== undefined && config.nfeNotifySellerId !== undefined ? nfeNotifySellerId : currentRow.nfe_notify_seller_id},
              nfe_print_danfe_auto         = ${nfePrintDanfeAuto !== null ? nfePrintDanfeAuto : currentRow.nfe_print_danfe_auto},
              sr_min_stock_qty             = ${srMinStockQty !== null ? srMinStockQty : currentRow.sr_min_stock_qty},
              sr_max_purchase_qty          = ${srMaxPurchaseQty !== null ? srMaxPurchaseQty : currentRow.sr_max_purchase_qty},
              sr_notify_times              = ${srNotifyTimes !== null ? srNotifyTimes : currentRow.sr_notify_times},
              cr_inactive_days             = ${crInactiveDays !== null ? crInactiveDays : currentRow.cr_inactive_days},
              cr_message_type              = ${crMessageType !== null ? crMessageType : currentRow.cr_message_type},
              cr_waba_template_promo_id    = ${crWabaTemplatePromoId !== null ? crWabaTemplatePromoId : currentRow.cr_waba_template_promo_id},
              cr_waba_template_catalog_id  = ${crWabaTemplateCatalogId !== null ? crWabaTemplateCatalogId : currentRow.cr_waba_template_catalog_id},
              updated_at                   = GETUTCDATE()
            WHERE automation_key = ${key}
          `;
        }

        // Replace seller bindings only if provided
        if (Array.isArray(bindings)) {
          await sql.query`DELETE FROM AutomationSellerBindings WHERE automation_key = ${key}`;
          for (const b of bindings) {
            if (!b.sellerId || !b.bindingType || !b.bindingValue) continue;
            await sql.query`
              INSERT INTO AutomationSellerBindings (automation_key, seller_id, binding_type, binding_value)
              VALUES (${key}, ${Number(b.sellerId)}, ${b.bindingType}, ${b.bindingValue})
            `;
          }
        }

        // Replace category bindings only if provided (stock_replenishment)
        if (Array.isArray(categoryBindings)) {
          await sql.query`DELETE FROM StockReplenishmentCategoryBindings`.catch(() => {});
          for (const b of categoryBindings) {
            if (!b.supplierId || !b.category) continue;
            await sql.query`
              INSERT INTO StockReplenishmentCategoryBindings (supplier_id, category)
              VALUES (${Number(b.supplierId)}, ${b.category})
            `;
          }
        }

        return { jsonBody: { success: true } };
      }
    } catch (error) {
      context.error('Erro na função automation-config:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    }
  },
});
