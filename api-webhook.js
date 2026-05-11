import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId:1:705808831621:android:0309186cd162bfbee845ec process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.var admin = require("firebase-admin");

var serviceAccount = require("path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
replacevar admin = require("firebase-admin");

var serviceAccount = require("path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://application-creation-71a9e-default-rtdb.firebaseio.com"
});
(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const event = req.body;

    // Chapa sends event when payout completes
    if (event.event === 'payout.success') {
        const { reference, status } = event;
        // Update the payout status to 'completed'
        await admin.database().ref(`payouts/${reference}`).update({
            status: 'completed',
            completedAt: Date.now(),
            txHash: event.transaction_id || null,
        });
        // Optionally, send a Telegram notification to the user (implement if you have bot token)
    }
    res.status(200).send('OK');
}