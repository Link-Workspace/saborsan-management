'use strict';
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let _pool = null;

// Returns (and caches) a shared ConnectionPool — never call pool.close() in request handlers
async function getPool() {
  if (!_pool || !_pool.connected) {
    _pool = await new sql.ConnectionPool(sqlConfig).connect();
  }
  return _pool;
}

module.exports = { getPool };
