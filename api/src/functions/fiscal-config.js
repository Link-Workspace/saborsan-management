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

async function ensureTable() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProductFiscalConfig'
    )
    BEGIN
      CREATE TABLE ProductFiscalConfig (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        productId         NVARCHAR(100)   NOT NULL,
        productName       NVARCHAR(255)   NOT NULL,
        ncm               NVARCHAR(10)    NOT NULL DEFAULT '21069090',
        cfop              NVARCHAR(5)     NOT NULL DEFAULT '5102',
        icmsOrigin        INT             NOT NULL DEFAULT 0,
        icmsCst           NVARCHAR(5)     NOT NULL DEFAULT '400',
        icmsAliq          DECIMAL(10,4)   NOT NULL DEFAULT 0,
        pisCST            NVARCHAR(3)     NOT NULL DEFAULT '07',
        pisAliq           DECIMAL(10,4)   NOT NULL DEFAULT 0,
        cofinsCST         NVARCHAR(3)     NOT NULL DEFAULT '07',
        cofinsAliq        DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsCst         NVARCHAR(5)     NULL,
        ibsCbsClassTrib   NVARCHAR(10)    NULL,
        ibsCbsAliqUF      DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsAliqMun     DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsAliqCbs     DECIMAL(10,4)   NOT NULL DEFAULT 0,
        ibsCbsReducaoAliq DECIMAL(10,4)   NOT NULL DEFAULT 0,
        codigoBeneficioFiscal NVARCHAR(20) NULL,
        fiscalApproved    BIT             NOT NULL DEFAULT 0,
        approvedBy        NVARCHAR(100)   NULL,
        notes             NVARCHAR(500)   NULL,
        createdAt         DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updatedAt         DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_ProductFiscalConfig_ProductId UNIQUE (productId)
      );
      CREATE INDEX IX_ProductFiscalConfig_Name ON ProductFiscalConfig (productName);
    END
    ELSE
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'codigoBeneficioFiscal'
      )
        ALTER TABLE ProductFiscalConfig ADD codigoBeneficioFiscal NVARCHAR(20) NULL;
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ProductFiscalConfig' AND COLUMN_NAME = 'ibsCbsReducaoAliq'
      )
        ALTER TABLE ProductFiscalConfig ADD ibsCbsReducaoAliq DECIMAL(10,4) NOT NULL DEFAULT 0;
    END
  `;
}

app.http('fiscal-config', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureTable();

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT id, productId, productName, ncm, cfop, icmsOrigin, icmsCst, icmsAliq,
                 pisCST, pisAliq, cofinsCST, cofinsAliq,
                 ibsCbsCst, ibsCbsClassTrib, ibsCbsAliqUF, ibsCbsAliqMun, ibsCbsAliqCbs, ibsCbsReducaoAliq,
                 codigoBeneficioFiscal,
                 fiscalApproved, approvedBy, notes,
                 ncmSource, ncmClassifiedAt, ncmConfidence, ncmTableVersion,
                 updatedAt
          FROM ProductFiscalConfig
          ORDER BY productName ASC
        `;
        return { jsonBody: { configs: result.recordset } };
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const {
          productId, productName, ncm, cfop, icmsOrigin, icmsCst, icmsAliq,
          pisCST, pisAliq, cofinsCST, cofinsAliq,
          ibsCbsCst, ibsCbsClassTrib, ibsCbsAliqUF, ibsCbsAliqMun, ibsCbsAliqCbs, ibsCbsReducaoAliq,
          codigoBeneficioFiscal,
          fiscalApproved, approvedBy, notes,
        } = body;

        if (!productId || !productName) {
          return { status: 400, jsonBody: { error: 'productId e productName são obrigatórios' } };
        }

        const cst = ibsCbsCst ? String(ibsCbsCst).trim() : null;
        const classTrib = ibsCbsClassTrib ? String(ibsCbsClassTrib).trim() : null;

        const exists = await sql.query`SELECT id FROM ProductFiscalConfig WHERE productId = ${productId}`;

        if (exists.recordset.length > 0) {
          await sql.query`
            UPDATE ProductFiscalConfig SET
              productName     = ${productName},
              ncm             = ${ncm || '21069090'},
              cfop            = ${cfop || '5102'},
              icmsOrigin      = ${Number(icmsOrigin ?? 0)},
              icmsCst         = ${icmsCst || '400'},
              icmsAliq        = ${Number(icmsAliq ?? 0)},
              pisCST          = ${pisCST || '07'},
              pisAliq         = ${Number(pisAliq ?? 0)},
              cofinsCST       = ${cofinsCST || '07'},
              cofinsAliq      = ${Number(cofinsAliq ?? 0)},
              ibsCbsCst       = ${cst},
              ibsCbsClassTrib = ${classTrib},
              ibsCbsAliqUF    = ${Number(ibsCbsAliqUF ?? 0)},
              ibsCbsAliqMun   = ${Number(ibsCbsAliqMun ?? 0)},
              ibsCbsAliqCbs   = ${Number(ibsCbsAliqCbs ?? 0)},
              ibsCbsReducaoAliq = ${Number(ibsCbsReducaoAliq ?? 0)},
              codigoBeneficioFiscal = ${codigoBeneficioFiscal || null},
              fiscalApproved  = ${fiscalApproved ? 1 : 0},
              approvedBy      = ${approvedBy || null},
              notes           = ${notes || null},
              ncmSource       = 'manual',
              ncmClassifiedAt = GETUTCDATE(),
              ncmConfidence   = NULL,
              updatedAt       = GETUTCDATE()
            WHERE productId = ${productId}
          `;
        } else {
          await sql.query`
            INSERT INTO ProductFiscalConfig (
              productId, productName, ncm, cfop, icmsOrigin, icmsCst, icmsAliq,
              pisCST, pisAliq, cofinsCST, cofinsAliq,
              ibsCbsCst, ibsCbsClassTrib, ibsCbsAliqUF, ibsCbsAliqMun, ibsCbsAliqCbs, ibsCbsReducaoAliq,
              codigoBeneficioFiscal,
              fiscalApproved, approvedBy, notes, ncmSource, ncmClassifiedAt
            ) VALUES (
              ${productId}, ${productName},
              ${ncm || '21069090'}, ${cfop || '5102'},
              ${Number(icmsOrigin ?? 0)}, ${icmsCst || '400'}, ${Number(icmsAliq ?? 0)},
              ${pisCST || '07'}, ${Number(pisAliq ?? 0)},
              ${cofinsCST || '07'}, ${Number(cofinsAliq ?? 0)},
              ${cst}, ${classTrib},
              ${Number(ibsCbsAliqUF ?? 0)}, ${Number(ibsCbsAliqMun ?? 0)}, ${Number(ibsCbsAliqCbs ?? 0)}, ${Number(ibsCbsReducaoAliq ?? 0)},
              ${codigoBeneficioFiscal || null},
              ${fiscalApproved ? 1 : 0}, ${approvedBy || null}, ${notes || null},
              'manual', GETUTCDATE()
            )
          `;
        }

        return { jsonBody: { saved: true } };
      }

      return { status: 405, jsonBody: { error: 'Método não permitido' } };
    } catch (err) {
      context.error('fiscal-config error:', err);
      return { status: 500, jsonBody: { error: 'Erro ao processar configuração fiscal.' } };
    }
  },
});
