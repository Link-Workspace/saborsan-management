/**
 * Uso: node reset-employee-password.js <email> <nova-senha>
 * Atualiza o passwordHash do funcionário com bcrypt correto.
 */
require('dotenv').config({ path: './local.settings.json', processEnv: false });

const sql = require('mssql');
const bcrypt = require('bcryptjs');

// Lê as variáveis direto do local.settings.json
const settings = require('./local.settings.json');
const env = settings.Values;

const sqlConfig = {
  server: env.SQL_SERVER,
  database: env.SQL_DATABASE,
  user: env.SQL_USER,
  password: env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

async function run() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Uso: node reset-employee-password.js <email> <senha>');
    process.exit(1);
  }

  await sql.connect(sqlConfig);

  const existing = await sql.query`
    SELECT id, email, passwordHash FROM Employees WHERE email = ${email.toLowerCase()}
  `;

  if (existing.recordset.length === 0) {
    console.error(`Funcionário com email "${email}" não encontrado na tabela Employees.`);
    process.exit(1);
  }

  const emp = existing.recordset[0];
  console.log(`Funcionário encontrado: id=${emp.id}, email=${emp.email}`);
  console.log(`passwordHash atual: ${emp.passwordHash}`);

  const isBcrypt = emp.passwordHash && emp.passwordHash.startsWith('$2');
  console.log(`É bcrypt válido: ${isBcrypt}`);

  const newHash = await bcrypt.hash(password, 10);
  await sql.query`
    UPDATE Employees SET passwordHash = ${newHash} WHERE email = ${email.toLowerCase()}
  `;

  console.log(`\nSenha atualizada com sucesso para: ${email}`);
  await sql.close();
}

run().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
