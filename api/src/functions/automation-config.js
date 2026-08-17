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
      created_at DATETIME DEFAULT GETUTCDATE(),
      updated_at DATETIME DEFAULT GETUTCDATE()
    )
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
                 time_interval_minutes, time_start, time_end
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

        if (!cfgResult.recordset.length) {
          return { jsonBody: { config: null, bindings: [] } };
        }

        const row = cfgResult.recordset[0];
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
            },
            bindings: bindingsResult.recordset.map((b) => ({
              id: b.id,
              sellerId: b.seller_id,
              sellerName: b.seller_name,
              bindingType: b.binding_type,
              bindingValue: b.binding_value,
            })),
          },
        };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { key = 'receive_orders', config = {}, bindings } = body;

        const existing = await sql.query`SELECT id FROM AutomationConfig WHERE automation_key = ${key}`;

        const isActive = config.isActive !== undefined ? (config.isActive ? 1 : 0) : null;
        const minOrders = config.minOrders ?? null;
        const maxOrders = config.maxOrders ?? null;
        const maxCities = config.maxCities ?? null;
        const includeRouteCities = config.includeRouteCities !== undefined ? (config.includeRouteCities ? 1 : 0) : null;
        const timeIntervalMinutes = config.timeIntervalMinutes ?? null;
        const timeStart = config.timeStart ?? null;
        const timeEnd = config.timeEnd ?? null;

        if (!existing.recordset.length) {
          await sql.query`
            INSERT INTO AutomationConfig
              (automation_key, is_active, min_orders, max_orders, max_cities, include_route_cities, time_interval_minutes, time_start, time_end, updated_at)
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
               GETUTCDATE())
          `;
        } else {
          // Only update provided fields
          const currentRow = (await sql.query`SELECT * FROM AutomationConfig WHERE automation_key = ${key}`).recordset[0];
          await sql.query`
            UPDATE AutomationConfig SET
              is_active              = ${isActive !== null ? isActive : currentRow.is_active},
              min_orders             = ${minOrders !== null ? minOrders : currentRow.min_orders},
              max_orders             = ${maxOrders !== null ? maxOrders : currentRow.max_orders},
              max_cities             = ${maxCities !== null ? maxCities : currentRow.max_cities},
              include_route_cities   = ${includeRouteCities !== null ? includeRouteCities : currentRow.include_route_cities},
              time_interval_minutes  = ${timeIntervalMinutes !== null ? timeIntervalMinutes : currentRow.time_interval_minutes},
              time_start             = ${timeStart !== null ? timeStart : currentRow.time_start},
              time_end               = ${timeEnd !== null ? timeEnd : currentRow.time_end},
              updated_at             = GETUTCDATE()
            WHERE automation_key = ${key}
          `;
        }

        // Replace bindings only if provided
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

        return { jsonBody: { success: true } };
      }
    } catch (error) {
      context.error('Erro na função automation-config:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    }
  },
});
