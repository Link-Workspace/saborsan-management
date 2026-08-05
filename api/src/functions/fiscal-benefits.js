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

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

async function ensureTable() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FiscalBenefits'
    )
    BEGIN
      CREATE TABLE FiscalBenefits (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        codigo           NVARCHAR(20)   NOT NULL,
        uf               NVARCHAR(2)    NOT NULL DEFAULT 'SC',
        descricao        NVARCHAR(500)  NOT NULL,
        tipoBeneficio    NVARCHAR(50)   NOT NULL,
        cstsPermitidos   NVARCHAR(100)  NOT NULL,
        aplicavelSimples BIT            NOT NULL DEFAULT 0,
        fundamentoLegal  NVARCHAR(500)  NULL,
        inicioVigencia   DATE           NULL,
        fimVigencia      DATE           NULL,
        ativo            BIT            NOT NULL DEFAULT 1,
        createdAt        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        updatedAt        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_FiscalBenefits_Codigo_UF UNIQUE (codigo, uf)
      );
      CREATE INDEX IX_FiscalBenefits_UF_Ativo ON FiscalBenefits (uf, ativo);
    END
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

app.http('fiscal-benefits', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'fiscal-benefits/{action?}',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTable();

      const action = request.params?.action || '';
      const url = new URL(request.url);

      // ── GET: listar benefícios ────────────────────────────────────────────
      if (request.method === 'GET') {
        const uf        = url.searchParams.get('uf')?.toUpperCase() || null;
        const cst       = url.searchParams.get('cst') || null;
        const apenasAtivos = url.searchParams.get('ativo') !== '0';

        let query = `
          SELECT id, codigo, uf, descricao, tipoBeneficio, cstsPermitidos,
                 aplicavelSimples, fundamentoLegal, inicioVigencia, fimVigencia,
                 ativo, updatedAt
          FROM FiscalBenefits
          WHERE 1=1
        `;
        const params = [];

        if (uf) { query += ' AND uf = @uf'; params.push({ name: 'uf', value: uf }); }
        if (apenasAtivos) query += ' AND ativo = 1';
        if (cst) { query += " AND ',' + cstsPermitidos + ',' LIKE '%,' + @cst + ',%'"; params.push({ name: 'cst', value: cst }); }
        query += ' ORDER BY uf, codigo';

        const req = new sql.Request();
        for (const p of params) req.input(p.name, p.value);
        const result = await req.query(query);

        const hoje = new Date();
        const registros = result.recordset.map((r) => ({
          ...r,
          vigente:
            (!r.inicioVigencia || new Date(r.inicioVigencia) <= hoje) &&
            (!r.fimVigencia    || new Date(r.fimVigencia)    >= hoje),
        }));

        return { jsonBody: { benefits: registros } };
      }

      // ── PUT /sync: substituição em lote por UF ───────────────────────────
      if (request.method === 'PUT' && action === 'sync') {
        const body = await request.json().catch(() => ({}));
        const { uf, benefits } = body;

        if (!uf || !Array.isArray(benefits)) {
          return { status: 400, jsonBody: { error: '"uf" e "benefits" (array) são obrigatórios' } };
        }
        const ufNorm = String(uf).toUpperCase().trim();

        // Desativa todos os benefícios anteriores da UF antes do upsert
        await new sql.Request().input('uf', ufNorm).query(
          'UPDATE FiscalBenefits SET ativo = 0, updatedAt = GETUTCDATE() WHERE uf = @uf',
        );

        let inseridos = 0;
        let atualizados = 0;

        for (const b of benefits) {
          const codigo        = String(b.codigo || '').trim();
          const descricao     = String(b.descricao || '').trim();
          const tipoBeneficio = String(b.tipoBeneficio || '').trim();
          const cstsPermitidos = String(b.cstsPermitidos || '').trim();
          if (!codigo || !descricao || !cstsPermitidos) continue;

          const exists = await new sql.Request()
            .input('codigo', codigo)
            .input('uf', ufNorm)
            .query('SELECT id FROM FiscalBenefits WHERE codigo = @codigo AND uf = @uf');

          const r = new sql.Request();
          r.input('codigo',          codigo);
          r.input('uf',              ufNorm);
          r.input('descricao',       descricao);
          r.input('tipoBeneficio',   tipoBeneficio);
          r.input('cstsPermitidos',  cstsPermitidos);
          r.input('aplicavelSimples', b.aplicavelSimples ? 1 : 0);
          r.input('fundamentoLegal', b.fundamentoLegal || null);
          r.input('inicioVigencia',  parseDateOrNull(b.inicioVigencia));
          r.input('fimVigencia',     parseDateOrNull(b.fimVigencia));

          if (exists.recordset.length > 0) {
            await r.query(`
              UPDATE FiscalBenefits SET
                descricao        = @descricao,
                tipoBeneficio    = @tipoBeneficio,
                cstsPermitidos   = @cstsPermitidos,
                aplicavelSimples = @aplicavelSimples,
                fundamentoLegal  = @fundamentoLegal,
                inicioVigencia   = @inicioVigencia,
                fimVigencia      = @fimVigencia,
                ativo            = 1,
                updatedAt        = GETUTCDATE()
              WHERE codigo = @codigo AND uf = @uf
            `);
            atualizados++;
          } else {
            await r.query(`
              INSERT INTO FiscalBenefits
                (codigo, uf, descricao, tipoBeneficio, cstsPermitidos,
                 aplicavelSimples, fundamentoLegal, inicioVigencia, fimVigencia, ativo)
              VALUES
                (@codigo, @uf, @descricao, @tipoBeneficio, @cstsPermitidos,
                 @aplicavelSimples, @fundamentoLegal, @inicioVigencia, @fimVigencia, 1)
            `);
            inseridos++;
          }
        }

        return { jsonBody: { synced: true, inseridos, atualizados, uf: ufNorm } };
      }

      // ── POST: criar ou atualizar um benefício ────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const {
          codigo, uf: ufBody = 'SC', descricao, tipoBeneficio, cstsPermitidos,
          aplicavelSimples, fundamentoLegal, inicioVigencia, fimVigencia, ativo = true,
        } = body;

        if (!codigo || !descricao || !cstsPermitidos) {
          return { status: 400, jsonBody: { error: '"codigo", "descricao" e "cstsPermitidos" são obrigatórios' } };
        }
        const ufNorm = String(ufBody).toUpperCase().trim();

        const exists = await new sql.Request()
          .input('codigo', String(codigo).trim())
          .input('uf', ufNorm)
          .query('SELECT id FROM FiscalBenefits WHERE codigo = @codigo AND uf = @uf');

        const r = new sql.Request();
        r.input('codigo',          String(codigo).trim());
        r.input('uf',              ufNorm);
        r.input('descricao',       String(descricao).trim());
        r.input('tipoBeneficio',   String(tipoBeneficio || '').trim());
        r.input('cstsPermitidos',  String(cstsPermitidos).trim());
        r.input('aplicavelSimples', aplicavelSimples ? 1 : 0);
        r.input('fundamentoLegal', fundamentoLegal || null);
        r.input('inicioVigencia',  parseDateOrNull(inicioVigencia));
        r.input('fimVigencia',     parseDateOrNull(fimVigencia));
        r.input('ativo',           ativo ? 1 : 0);

        if (exists.recordset.length > 0) {
          await r.query(`
            UPDATE FiscalBenefits SET
              descricao        = @descricao,
              tipoBeneficio    = @tipoBeneficio,
              cstsPermitidos   = @cstsPermitidos,
              aplicavelSimples = @aplicavelSimples,
              fundamentoLegal  = @fundamentoLegal,
              inicioVigencia   = @inicioVigencia,
              fimVigencia      = @fimVigencia,
              ativo            = @ativo,
              updatedAt        = GETUTCDATE()
            WHERE codigo = @codigo AND uf = @uf
          `);
          return { jsonBody: { saved: true, action: 'updated' } };
        }

        await r.query(`
          INSERT INTO FiscalBenefits
            (codigo, uf, descricao, tipoBeneficio, cstsPermitidos,
             aplicavelSimples, fundamentoLegal, inicioVigencia, fimVigencia, ativo)
          VALUES
            (@codigo, @uf, @descricao, @tipoBeneficio, @cstsPermitidos,
             @aplicavelSimples, @fundamentoLegal, @inicioVigencia, @fimVigencia, @ativo)
        `);
        return { status: 201, jsonBody: { saved: true, action: 'created' } };
      }

      // ── DELETE: desativar um benefício ────────────────────────────────────
      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return { status: 400, jsonBody: { error: '"id" é obrigatório' } };
        await new sql.Request()
          .input('id', Number(id))
          .query('UPDATE FiscalBenefits SET ativo = 0, updatedAt = GETUTCDATE() WHERE id = @id');
        return { jsonBody: { deleted: true } };
      }

      return { status: 405, jsonBody: { error: 'Método não permitido' } };
    } catch (err) {
      context.error('fiscal-benefits error:', err);
      return { status: 500, jsonBody: { error: 'Erro ao processar benefícios fiscais.' } };
    } finally {
      try { await sql.close(); } catch (_) {}
    }
  },
});
