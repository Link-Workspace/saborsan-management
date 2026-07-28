const { app } = require('@azure/functions');
const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

app.http('vehicles', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      await sql.connect(sqlConfig);

      if (request.method === 'GET') {
        const result = await sql.query`
          SELECT id, name, brand, year, plate
          FROM Vehicles
          ORDER BY name ASC
        `;

        const vehicles = result.recordset.map((v) => ({
          id: v.id,
          name: v.name,
          brand: v.brand || '',
          year: v.year ? String(v.year) : '',
          plate: v.plate || '',
        }));

        return { jsonBody: { vehicles } };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { name, brand, year, plate } = body;

        if (!name || !name.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do veículo é obrigatório' } };
        }

        const insertResult = await sql.query`
          INSERT INTO Vehicles (name, brand, year, plate, created_at, updated_at)
          OUTPUT INSERTED.id
          VALUES (
            ${name.trim()},
            ${brand || null},
            ${year ? parseInt(year) : null},
            ${plate ? plate.trim() : null},
            GETUTCDATE(),
            GETUTCDATE()
          )
        `;

        const newId = insertResult.recordset[0].id;
        return {
          status: 201,
          jsonBody: {
            vehicle: {
              id: newId,
              name: name.trim(),
              brand: brand || '',
              year: year ? String(year) : '',
              plate: plate ? plate.trim() : '',
            },
          },
        };
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const { id, name, brand, year, plate } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'id é obrigatório' } };
        }
        if (!name || !name.trim()) {
          return { status: 400, jsonBody: { error: 'Nome do veículo é obrigatório' } };
        }

        await sql.query`
          UPDATE Vehicles
          SET name       = ${name.trim()},
              brand      = ${brand || null},
              year       = ${year ? parseInt(year) : null},
              plate      = ${plate ? plate.trim() : null},
              updated_at = GETUTCDATE()
          WHERE id = ${id}
        `;

        return { jsonBody: { success: true } };
      }

      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'id é obrigatório' } };
        }

        await sql.query`DELETE FROM Vehicles WHERE id = ${id}`;

        return { jsonBody: { success: true } };
      }
    } catch (error) {
      context.error('Erro na função vehicles:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    } finally {
      await sql.close();
    }
  },
});
