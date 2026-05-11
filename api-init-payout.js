import axios from 'axios';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK using environment variables
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { userId, amount, method, accountNumber, accountName } = req.body;
    
    // Validate required fields
    if (!userId || !amount || !method || !accountNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Verify user exists and has sufficient balance
        const userSnap = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnap.exists()) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userSnap.val();
        if ((user.coins || 0) < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Create withdrawal request in database
        const withdrawalRef = admin.database().ref('withdrawals').push();
        await withdrawalRef.set({
            userId: userId,
            amount: amount,
            usdAmount: (amount / 1000).toFixed(2),
            method: method,
            accountNumber: accountNumber,
            accountName: accountName || '',
            status: 'pending',
            requestedAt: Date.now()
        });
        
        // Deduct coins from user balance
        await admin.database().ref(`users/${userId}/coins`).transaction(current => {
            return (current || 0) - amount;
        });
        
        res.status(200).json({ 
            success: true, 
            message: 'Withdrawal request submitted',
            withdrawalId: withdrawalRef.key
        });
        
    } catch (error) {
        console.error('Payout error:', error);
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
}.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

const CHAPA_SECRET = process.env.CHAPA_SECRET_KEY;
const EXCHANGE_RATE = 1000;   // 1000 coins = $1 USD
const USD_TO_ETB = 55;        // 1 USD = 55 ETB (adjust as needed)

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { userId, amount, method, accountNumber, accountName } = req.body;

    // 1. Validate user exists and has enough balance
    const userSnap = await admin.database().ref(`users/${userId}`).once('value');
    if (!userSnap.exists() || userSnap.val().coins < amount) {
        return res.status(400).json({ error: 'Insufficient balance or user not found' });
    }

    // 2. Convert coins to local currency
    const usdAmount = amount / EXCHANGE_RATE;
    if (usdAmount < 10) return res.status(400).json({ error: 'Minimum payout is $10 (10,000 coins)' });
    const etbAmount = usdAmount * USD_TO_ETB;

    // 3. Prepare payout data for Chapa (or TON Pay – extend as needed)
    let payoutReference = `pay_${userId}_${Date.now()}`;
    try {
        const chapaRes = await axios.post('https://api.chapa.co/v1/transfers', {
            amount: etbAmount,
            currency: 'ETB',
            account_number: accountNumber,
            account_name: accountName,
            bank_code: method === 'telebirr' ? 'telebirr' : 'cbe',
            narration: `Earnings payout for user ${userId}`,
            reference: payoutReference,
        }, {
            headers: { 'Authorization': `Bearer ${CHAPA_SECRET}` }
        });

        // 4. Store pending payout in Firebase
        await admin.database().ref(`payouts/${userId}/${payoutReference}`).set({
            amount: etbAmount,
            usdAmount: usdAmount.toFixed(2),
            method,
            accountNumber,
            accountName,
            status: 'processing',
            requestedAt: Date.now(),
            reference: payoutReference,
        });

        // 5. Deduct coins from user balance (atomic)
        await admin.database().ref(`users/${userId}/coins`).transaction(current => {
            return (current || 0) - amount;
        });

        res.status(200).json({ success: true, reference: payoutReference });
    } catch (err) {
        console.error('Chapa error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Payout initiation failed. Please try later.' });
    }
}