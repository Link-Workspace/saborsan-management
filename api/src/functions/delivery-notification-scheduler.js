const { app } = require('@azure/functions');
const sql = require('mssql');
const { initializeApp: initFirebase, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

if (!getApps().length) {
  initFirebase({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

async function ensureConfirmationSentColumn() {
  await sql.query`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID(N'Deliveries') AND name = N'confirmation_sent'
    )
      ALTER TABLE Deliveries ADD confirmation_sent bit NOT NULL DEFAULT 0
  `;
}

async function notifyDeliveryConfirmation(sellerId, deliveryCode) {
  if (!sellerId) return;
  try {
    const sellerRow = await sql.query`SELECT userId FROM Sellers WHERE id = ${sellerId}`;
    if (!sellerRow.recordset.length) return;
    const { userId } = sellerRow.recordset[0];

    const tokensResult = await sql.query`SELECT token FROM PushTokens WHERE userId = ${userId}`;
    const tokens = tokensResult.recordset.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;

    // const messaging = getMessaging();
    // for (const token of tokens) {
    //   try {
    //     await messaging.send({
    //       token,
    //       notification: {
    //         title: `Entrega ${deliveryCode} planejada`,
    //         body: 'Confirme a data de saída para esta entrega.',
    //       },
    //       data: { type: 'delivery-confirmations', deliveryCode: String(deliveryCode) },
    //       android: { priority: 'high' },
    //       apns: { payload: { aps: { sound: 'default' } } },
    //     });
    //   } catch (err) {
    //     if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
    //       await sql.query`DELETE FROM PushTokens WHERE token = ${token}`;
    //     }
    //   }
    // }
  } catch {
    // Silenciar erros de notificação
  }
}

// Executa a cada 30 minutos para notificar entregadores quando a data/hora de saída agendada chegar
app.timer('deliveryNotificationScheduler', {
  schedule: '0 */30 * * * *',
  handler: async (myTimer, context) => {
    try {
      await sql.connect(sqlConfig);
      await ensureConfirmationSentColumn();

      const result = await sql.query`
        SELECT d.id, d.code, d.seller_id
        FROM Deliveries d
        WHERE d.status = N'Planejada'
          AND d.departure_date IS NOT NULL
          AND d.confirmation_sent = 0
          AND d.departure_date <= GETUTCDATE()
      `;

      for (const delivery of result.recordset) {
        await notifyDeliveryConfirmation(delivery.seller_id, delivery.code);
        await sql.query`UPDATE Deliveries SET confirmation_sent = 1 WHERE id = ${delivery.id}`;
      }

      context.log(`Notificações de entrega enviadas: ${result.recordset.length}`);
    } catch (error) {
      context.error('Erro no scheduler de notificações de entrega:', error);
    } finally {
      await sql.close();
    }
  },
});
