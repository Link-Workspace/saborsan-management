const { app } = require('@azure/functions');
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

app.http('employee-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const { email, password } = await request.json();

      if (!email || !password) {
        return { status: 400, jsonBody: { error: 'E-mail e senha são obrigatórios.' } };
      }

      await sql.connect(sqlConfig);

      const result = await sql.query`
        SELECT id, email, passwordHash, role
        FROM Employees
        WHERE email = ${email.toLowerCase()}
      `;

      if (result.recordset.length === 0) {
        return { status: 401, jsonBody: { error: 'E-mail ou senha incorretos.' } };
      }

      const dbEmployee = result.recordset[0];
      const passwordMatch = await bcrypt.compare(password, dbEmployee.passwordHash);

      if (!passwordMatch) {
        return { status: 401, jsonBody: { error: 'E-mail ou senha incorretos.' } };
      }

      const { passwordHash: _, ...employee } = dbEmployee;
      return { jsonBody: { employee } };
    } catch (error) {
      context.error('Erro na função employee-login:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
    } finally {
      await sql.close();
    }
  },
});
