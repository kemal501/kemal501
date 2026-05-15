// server.js – BARCA LIVE Backend
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 100, message: 'Too many requests' }));

// ========== FIREBASE INIT (from .env) ==========
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: "auto",
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: "auto",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();
const auth = admin.auth();

console.log(`✅ Firebase connected: ${process.env.FIREBASE_PROJECT_ID}`);

// ========== CONFIG ==========
const CONFIG = {
  COIN_RATE: parseInt(process.env.COIN_TO_USD_RATE) || 100,
  BIRR_RATE: parseInt(process.env.COIN_TO_BIRR_RATE) || 10,
  MIN_WITHDRAWAL_USD: parseInt(process.env.MIN_WITHDRAWAL_USD) || 10,
  PLATFORM_FEE: (parseInt(process.env.PLATFORM_FEE_PERCENT) || 40)/100,
  WITHDRAWAL_FEE: (parseInt(process.env.WITHDRAWAL_FEE_PERCENT) || 5)/100,
  ROOM_EARNINGS: {
    REGULAR_MIC_ON: parseInt(process.env.REGULAR_MIC_ON) || 20000,
    REGULAR_MIC_OFF: parseInt(process.env.REGULAR_MIC_OFF) || 10000,
    VIP_MIC_ON: parseInt(process.env.VIP_MIC_ON) || 5000,
    VIP_MIC_OFF: parseInt(process.env.VIP_MIC_OFF) || 1000,
  },
  AGENCY: {
    COMMISSION: parseInt(process.env.AGENCY_COMMISSION) || 20,
    MONTHLY_SALARY: parseInt(process.env.AGENT_MONTHLY_SALARY) || 100,
    HOSTS_REQUIRED: parseInt(process.env.AGENT_HOSTS_REQUIRED) || 10,
  },
  DAILY_BONUS: {
    AMOUNT_USD: parseInt(process.env.DAILY_BONUS_AMOUNT) || 3,
    REQUIRED_MINUTES: parseInt(process.env.DAILY_BONUS_MINUTES) || 60,
    INVITE_BONUS_USD: parseInt(process.env.INVITE_BONUS) || 14,
  },
  JWT_SECRET: process.env.JWT_SECRET || 'barca_secret',
};

// Helper functions
function generateToken(userId, role) {
  return jwt.sign({ userId, role }, CONFIG.JWT_SECRET, { expiresIn: '30d' });
}
function generateReferralCode(username) {
  const rand = Math.random().toString(36).substring(2,8).toUpperCase();
  return `BARCA_${username.substring(0,3)}${rand}`;
}
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, CONFIG.JWT_SECRET);
    next();
  } catch { res.status(403).json({ error: 'Invalid token' }); }
}

// ---------- HEALTH ----------
app.get('/', (req, res) => {
  res.json({ name: 'BARCA LIVE API', status: 'online', message: '🔵🔴 Visca el Barça!' });
});

// ---------- AUTH ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password, gender, referralCode } = req.body;
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' });
    let existing;
    if (email) existing = await db.collection('users').where('email','==',email).get();
    else existing = await db.collection('users').where('phone','==',phone).get();
    if (!existing.empty) return res.status(400).json({ error: 'User exists' });

    const hashed = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const userData = {
      uid: userId, username: username || `user_${userId.slice(0,8)}`,
      email: email || null, phone: phone || null, password: hashed,
      gender: gender || 'prefer_not_to_say', role: 'user',
      createdAt: new Date(), walletBalance: 0, totalEarnings: 0,
      referralCode: generateReferralCode(username || `user_${userId.slice(0,8)}`),
      referredBy: referralCode || null, kycStatus: 'pending', isVerified: false,
      currentRoom: null, currentSeat: null, micEnabled: false,
    };
    await db.collection('users').doc(userId).set(userData);

    if (referralCode) {
      const refQuery = await db.collection('users').where('referralCode','==',referralCode).get();
      if (!refQuery.empty) {
        const bonus = CONFIG.DAILY_BONUS.INVITE_BONUS_USD * CONFIG.COIN_RATE;
        await db.collection('users').doc(refQuery.docs[0].id).update({
          walletBalance: admin.firestore.FieldValue.increment(bonus),
          totalEarnings: admin.firestore.FieldValue.increment(bonus),
        });
      }
    }
    const token = generateToken(userId, 'user');
    res.json({ success: true, user: { ...userData, password: undefined }, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    let q = await db.collection('users').where('email','==',identifier).get();
    if (q.empty) q = await db.collection('users').where('phone','==',identifier).get();
    if (q.empty) q = await db.collection('users').where('username','==',identifier).get();
    if (q.empty) return res.status(401).json({ error: 'User not found' });
    const user = q.docs[0].data();
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    const token = generateToken(q.docs[0].id, user.role);
    res.json({ success: true, user: { ...user, password: undefined }, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const user = doc.data();
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password incorrect' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 chars' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('users').doc(userId).update({ password: hashed });
    // Also update Firebase Auth if email exists
    if (user.email) {
      try { await admin.auth().updateUser(userId, { password: newPassword }); } catch(e) {}
    }
    res.json({ success: true, message: 'Password changed. Please login again.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- ROOMS, GAMES, COINS, WITHDRAWALS, AGENCY, KYC ----------
// (Insert all the other routes from the previous server.js here.
//  They are identical – just copy from the earlier full server.js.
//  For brevity, I include only essential ones, but you can paste the whole
//  routes section from the previous answer – they all use db, CONFIG, etc.)

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔵🔴 BARCA LIVE backend running on port ${PORT}`);
});