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

const SR_CATEGORIES = ['Assados', 'Frutas', 'Salgados', 'Condimentos', 'Legumes', 'Polpa de fruta', 'Doces', 'Pizza', 'Bebidas'];

async function ensureTables() {
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'sr_min_stock_qty')
      ALTER TABLE AutomationConfig ADD sr_min_stock_qty INT NOT NULL DEFAULT 5
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'sr_max_purchase_qty')
      ALTER TABLE AutomationConfig ADD sr_max_purchase_qty INT NOT NULL DEFAULT 50
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationConfig') AND name = 'sr_notify_times')
      ALTER TABLE AutomationConfig ADD sr_notify_times NVARCHAR(MAX) NULL
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StockReplenishmentCategoryBindings')
    CREATE TABLE StockReplenishmentCategoryBindings (
      id          INT           IDENTITY(1,1) NOT NULL,
      supplier_id INT           NOT NULL,
      category    NVARCHAR(100) NOT NULL,
      created_at  DATETIME      NOT NULL DEFAULT GETUTCDATE(),
      CONSTRAINT PK_StockReplenishmentCategoryBindings PRIMARY KEY CLUSTERED (id ASC)
    )
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationRunLog')
    CREATE TABLE AutomationRunLog (
      id INT PRIMARY KEY IDENTITY,
      automation_key NVARCHAR(100) NOT NULL,
      result_message NVARCHAR(500),
      created_at DATETIME DEFAULT GETUTCDATE()
    )
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PurchasePlanningItems')
    CREATE TABLE PurchasePlanningItems (
      id            INT           IDENTITY(1,1) NOT NULL,
      title         NVARCHAR(255) NOT NULL,
      scheduledDate DATE          NOT NULL,
      completed     BIT           NOT NULL DEFAULT 0,
      completedAt   DATETIME2     NULL,
      notes         NVARCHAR(500) NULL,
      supplier_purchase_id INT   NULL,
      createdAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
      updatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
      CONSTRAINT PK_PurchasePlanningItems PRIMARY KEY CLUSTERED (id ASC)
    )
  `.catch(() => {});
  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PurchasePlanningItems') AND name = 'supplier_purchase_id')
      ALTER TABLE PurchasePlanningItems ADD supplier_purchase_id INT NULL
  `.catch(() => {});
}

// Returns true if currentTime (HH:MM) is within toleranceMinutes of any time in notifyTimes
function isNotifyWindow(currentTime, notifyTimes, toleranceMinutes = 5) {
  if (!notifyTimes || notifyTimes.length === 0) return true;
  const [ch, cm] = currentTime.split(':').map(Number);
  const currentMins = ch * 60 + cm;
  return notifyTimes.some((t) => {
    const [th, tm] = t.split(':').map(Number);
    const notifyMins = th * 60 + tm;
    return Math.abs(currentMins - notifyMins) <= toleranceMinutes;
  });
}

async function runAutoStockReplenishment(context) {
  await sql.connect(sqlConfig);
  await ensureTables();

  const cfgResult = await sql.query`
    SELECT is_active, sr_min_stock_qty, sr_max_purchase_qty, sr_notify_times,
           time_interval_minutes, time_start, time_end
    FROM AutomationConfig WHERE automation_key = 'stock_replenishment'
  `.catch(() => ({ recordset: [] }));

  if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) {
    return { skipped: true, reason: 'Automação não está ativa.' };
  }

  const cfg = cfgResult.recordset[0];
  const minStockQty = cfg.sr_min_stock_qty ?? 5;
  const maxPurchaseQty = cfg.sr_max_purchase_qty ?? 50;
  let notifyTimes = [];
  try { notifyTimes = JSON.parse(cfg.sr_notify_times || '[]'); } catch { notifyTimes = []; }

  // Check time window
  const now = new Date();
  const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const currentTime = `${String(nowBRT.getHours()).padStart(2, '0')}:${String(nowBRT.getMinutes()).padStart(2, '0')}`;

  if (cfg.time_start && cfg.time_end) {
    const overnight = cfg.time_end < cfg.time_start;
    const inWindow = overnight
      ? (currentTime >= cfg.time_start || currentTime <= cfg.time_end)
      : (currentTime >= cfg.time_start && currentTime <= cfg.time_end);
    if (!inWindow) return { skipped: true, reason: 'Fora do horário configurado.' };
  }

  // Check if current time matches a configured notify window
  const intervalMinutes = cfg.time_interval_minutes || 30;
  const tolerance = Math.max(Math.floor(intervalMinutes / 2), 2);
  if (!isNotifyWindow(currentTime, notifyTimes, tolerance)) {
    return { skipped: true, reason: 'Nenhum horário de comunicação programado para agora.' };
  }

  // Load supplier-category bindings
  const bindingsResult = await sql.query`
    SELECT b.supplier_id, s.name AS supplier_name, b.category
    FROM StockReplenishmentCategoryBindings b
    INNER JOIN Suppliers s ON b.supplier_id = s.id
  `.catch(() => ({ recordset: [] }));

  const categoryBindingMap = {};
  for (const row of bindingsResult.recordset) {
    if (!categoryBindingMap[row.category]) categoryBindingMap[row.category] = [];
    categoryBindingMap[row.category].push(row.supplier_id);
  }

  // Find low-stock products
  const lowStockResult = await sql.query`
    SELECT id, name, category, availableQuantity
    FROM Products
    WHERE active = 1 AND availableQuantity <= ${minStockQty}
    ORDER BY availableQuantity ASC
  `;

  const lowStockProducts = lowStockResult.recordset;
  if (!lowStockProducts.length) {
    return { skipped: true, reason: 'Nenhum produto com estoque baixo.' };
  }

  const createdPurchases = [];
  const skippedProducts = [];

  for (const product of lowStockProducts) {
    // Skip if a recent pending purchase already exists for this product
    const existingPurchase = await sql.query`
      SELECT TOP 1 id FROM SupplierPurchases
      WHERE purchaseName = ${product.name}
        AND status IN ('pending', 'in_progress')
        AND createdAt > DATEADD(HOUR, -24, GETUTCDATE())
    `.catch(() => ({ recordset: [] }));

    if (existingPurchase.recordset.length) {
      skippedProducts.push({ product: product.name, reason: 'Compra já existe nas últimas 24h' });
      continue;
    }

    // Find the last supplier used for this product (AI logic: look at purchase history)
    const lastPurchaseResult = await sql.query`
      SELECT TOP 1 supplierId FROM SupplierPurchases
      WHERE purchaseName = ${product.name}
      ORDER BY createdAt DESC
    `.catch(() => ({ recordset: [] }));

    let supplierId = null;

    if (lastPurchaseResult.recordset.length) {
      // Use last supplier from purchase history
      supplierId = lastPurchaseResult.recordset[0].supplierId;
      context?.log(`[auto-stock-replenishment] Produto "${product.name}": usando último fornecedor (id=${supplierId}) do histórico de compras`);
    } else {
      // Fall back to category binding
      const category = product.category || '';
      const categorySuppliers = categoryBindingMap[category];
      if (categorySuppliers && categorySuppliers.length > 0) {
        supplierId = categorySuppliers[0];
        context?.log(`[auto-stock-replenishment] Produto "${product.name}": sem histórico, usando fornecedor da categoria "${category}" (id=${supplierId})`);
      }
    }

    if (!supplierId) {
      context?.log(`[auto-stock-replenishment] Produto "${product.name}": nenhum fornecedor encontrado (categoria: "${product.category}")`);
      skippedProducts.push({ product: product.name, reason: `Nenhum fornecedor encontrado para a categoria "${product.category || 'sem categoria'}"` });
      continue;
    }

    const purchaseNotes = `Criado automaticamente pela automação de Reposição de Estoque. Estoque atual: ${product.availableQuantity} unidade(s).`;

    const spInsert = await sql.query`
      INSERT INTO SupplierPurchases (supplierId, purchaseName, description, quantity, status, notes)
      OUTPUT INSERTED.id
      VALUES (${supplierId}, ${product.name}, N'Reposição automática de estoque', ${maxPurchaseQty}, 'pending', ${purchaseNotes})
    `;
    const newPurchaseId = spInsert.recordset[0]?.id ?? null;

    // Mirror to PurchasePlanningItems so it appears in "Próximas compras"
    const todayBRT = new Date(nowBRT.getFullYear(), nowBRT.getMonth(), nowBRT.getDate());
    await sql.query`
      INSERT INTO PurchasePlanningItems (title, scheduledDate, notes, supplier_purchase_id)
      VALUES (${product.name}, ${todayBRT}, ${purchaseNotes}, ${newPurchaseId})
    `.catch(() => {});

    createdPurchases.push(product.name);
    context?.log(`[auto-stock-replenishment] Compra criada: "${product.name}", fornecedor id=${supplierId}, quantidade=${maxPurchaseQty}`);
  }

  const resultMessage = `${createdPurchases.length} compra(s) criada(s) automaticamente. ${skippedProducts.length} produto(s) ignorado(s).`;
  context?.log(`[auto-stock-replenishment] ${resultMessage}`);

  await sql.query`
    INSERT INTO AutomationRunLog (automation_key, result_message)
    VALUES ('stock_replenishment', ${resultMessage})
  `.catch(() => {});

  return {
    success: true,
    created: createdPurchases.length,
    createdProducts: createdPurchases,
    skipped: skippedProducts.length,
    skippedProducts,
    message: resultMessage,
  };
}

// ── HTTP trigger (manual call) ────────────────────────────────────────────────

app.http('auto-stock-replenishment', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const cfgResult = await sql.query`
          SELECT is_active, updated_at FROM AutomationConfig WHERE automation_key = 'stock_replenishment'
        `.catch(() => ({ recordset: [] }));

        const lastRun = await sql.query`
          SELECT TOP 1 created_at, result_message FROM AutomationRunLog
          WHERE automation_key = 'stock_replenishment'
          ORDER BY id DESC
        `.catch(() => ({ recordset: [] }));

        return {
          jsonBody: {
            isActive: cfgResult.recordset[0]?.is_active ?? false,
            lastRun: lastRun.recordset[0] || null,
          },
        };
      }

      const result = await runAutoStockReplenishment(context);
      return { jsonBody: result };
    } catch (err) {
      context.error('[auto-stock-replenishment] Erro:', err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

// ── Timer trigger — fires every minute, runs when interval has elapsed ────────

app.timer('autoStockReplenishmentTimer', {
  schedule: '0 * * * * *',
  handler: async (myTimer, context) => {
    try {
      await sql.connect(sqlConfig);

      const cfgResult = await sql.query`
        SELECT is_active, time_interval_minutes
        FROM AutomationConfig WHERE automation_key = 'stock_replenishment'
      `.catch(() => ({ recordset: [] }));

      if (!cfgResult.recordset.length || !cfgResult.recordset[0].is_active) return;

      const intervalMinutes = cfgResult.recordset[0].time_interval_minutes || 30;

      const lastRunResult = await sql.query`
        SELECT TOP 1 created_at FROM AutomationRunLog
        WHERE automation_key = 'stock_replenishment'
        ORDER BY id DESC
      `.catch(() => ({ recordset: [] }));

      if (lastRunResult.recordset.length) {
        const lastRun = new Date(lastRunResult.recordset[0].created_at);
        const minutesSinceLastRun = (Date.now() - lastRun.getTime()) / 60000;
        if (minutesSinceLastRun < intervalMinutes) return;
      }

      const result = await runAutoStockReplenishment(context);
      context.log('[auto-stock-replenishment] timer:', result.message || result.reason || JSON.stringify(result));
    } catch (err) {
      context.error('[auto-stock-replenishment] Erro no timer:', err);
    }
  },
});
