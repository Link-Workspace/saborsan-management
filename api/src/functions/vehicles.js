const { app } = require('@azure/functions');
const { getPool } = require('../db');

app.http('vehicles', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request().query`
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

        const insertResult = await pool.request().query`
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

        await pool.request().query`
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

        await pool.request().query`DELETE FROM Vehicles WHERE id = ${id}`;

        return { jsonBody: { success: true } };
      }
    } catch (error) {
      context.error('Erro na função vehicles:', error);
      return { status: 500, jsonBody: { error: 'Erro interno do servidor' } };
    }
  },
});
