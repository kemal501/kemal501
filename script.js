// ============================================
// BARCA LIVE – FIREBASE CONFIGURATION
// From your android google-services.json
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyASrRnI-ga17EFZDqhDFJKgWI6t7BCwa1E",
    authDomain: "website-a889d.firebaseapp.com",
    projectId: "website-a889d",
    storageBucket: "website-a889d.firebasestorage.app",
    messagingSenderId: "953289869545",
    appId: "1:953289869545:web:fe68911dd58967e44b4878"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

// Global variables
let currentUser = null;

// Auth state listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('user-name').innerText = user.displayName || user.email;
        loadUserData(user.uid);
        loadRooms();
        loadGifts();
        checkResellerStatus();      // Show reseller UI if applicable
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        currentUser = null;
    }
});

// ========== AUTH FUNCTIONS ==========
async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            email: email,
            username: email.split('@')[0],
            coins: 0,
            diamonds: 0,
            totalEarnings: 0,
            kycStatus: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            role: 'user'          // default role
        });
        await cred.user.updateProfile({ displayName: email.split('@')[0] });
        alert('Account created!');
    } catch (err) {
        document.getElementById('auth-error').innerText = err.message;
    }
}

async function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        document.getElementById('auth-error').innerText = err.message;
    }
}

async function googleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const userDoc = await db.collection('users').doc(result.user.uid).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(result.user.uid).set({
                uid: result.user.uid,
                email: result.user.email,
                username: result.user.displayName || result.user.email.split('@')[0],
                coins: 0,
                diamonds: 0,
                totalEarnings: 0,
                kycStatus: 'pending',
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (err) {
        alert(err.message);
    }
}

function logout() {
    auth.signOut();
}

// ========== USER DATA ==========
async function loadUserData(uid) {
    const doc = await db.collection('users').doc(uid).get();
    const data = doc.data();
    document.getElementById('coins').innerText = data.coins || 0;
    document.getElementById('diamonds').innerText = data.diamonds || 0;
}

// ========== ROOMS ==========
async function loadRooms() {
    const snapshot = await db.collection('rooms').where('status', '==', 'active').get();
    const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const container = document.getElementById('rooms-list');
    if (rooms.length === 0) {
        container.innerHTML = '<p>No active rooms. Create one!</p>';
        return;
    }
    container.innerHTML = rooms.map(room => `
        <div class="room-card" onclick="joinRoom('${room.id}')">
            <strong>${room.title}</strong><br>
            ${room.type === 'voice' ? '🎙️' : '📹'} ${room.type}<br>
            Host: ${room.hostId?.substring(0,8)}<br>
            <button class="btn small">Join</button>
        </div>
    `).join('');
}

function showCreateRoom() {
    document.getElementById('create-room-modal').style.display = 'flex';
}

async function createRoom() {
    const title = document.getElementById('room-title').value;
    const type = document.getElementById('room-type').value;
    if (!title) return alert('Title required');
    const uid = currentUser.uid;
    const roomRef = await db.collection('rooms').add({
        title, type, hostId: uid, status: 'active',
        seats: Array(24).fill().map((_, i) => ({ seatNumber: i+1, userId: null, muted: true })),
        audience: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert(`Room created: ${roomRef.id}`);
    closeModal('create-room-modal');
    loadRooms();
}

async function joinRoom(roomId) {
    const uid = currentUser.uid;
    const roomRef = db.collection('rooms').doc(roomId);
    const room = (await roomRef.get()).data();
    const emptySeat = room.seats.find(s => !s.userId);
    if (!emptySeat) {
        alert('Room is full');
        return;
    }
    emptySeat.userId = uid;
    emptySeat.joinedAt = firebase.firestore.FieldValue.serverTimestamp();
    await roomRef.update({ seats: room.seats });
    alert(`You joined as seat ${emptySeat.seatNumber}`);
    // Here you would integrate Agora/ZEGOCLOUD
}

// ========== GIFTS ==========
async function loadGifts() {
    const snapshot = await db.collection('gifts').get();
    let gifts = snapshot.docs.map(doc => doc.data());
    if (gifts.length === 0) {
        const defaultGifts = [
            { id: 'rose', name: '🌹 Rose', price: 10 },
            { id: 'lion', name: '🦁 Lion', price: 1000 },
            { id: 'castle', name: '🏰 Castle', price: 5000 },
            { id: 'rocket', name: '🚀 Rocket', price: 10000 }
        ];
        for (const g of defaultGifts) {
            await db.collection('gifts').doc(g.id).set(g);
        }
        gifts = defaultGifts;
    }
    const container = document.getElementById('gifts-list');
    container.innerHTML = gifts.map(gift => `
        <div class="gift-card" onclick="sendGift('${gift.id}', ${gift.price})">
            ${gift.name}<br>💰 ${gift.price} coins
        </div>
    `).join('');
}

async function sendGift(giftId, price) {
    const receiverId = prompt('Enter Receiver UID');
    if (!receiverId) return;
    const sendGiftCallable = functions.httpsCallable('sendGift');
    try {
        const result = await sendGiftCallable({ receiverId, giftId });
        alert(`Gift sent! Host earned ${result.data.diamondsEarned} diamonds`);
        loadUserData(currentUser.uid);
    } catch (err) {
        alert(err.message);
    }
}

// ========== COINS & WITHDRAWAL (Personal) ==========
function showBuyCoins() {
    document.getElementById('buy-coins-modal').style.display = 'flex';
}

async function buyCoins(amountUSD) {
    const addCoinsFn = functions.httpsCallable('addCoinsManually');
    try {
        await addCoinsFn({ amountUSD });
        loadUserData(currentUser.uid);
        alert(`Added ${amountUSD * 100} coins!`);
    } catch (err) {
        alert(err.message);
    }
    closeModal('buy-coins-modal');
}

function showWithdraw() {
    document.getElementById('withdraw-modal').style.display = 'flex';
}

async function requestWithdrawal() {
    const amountUSD = parseFloat(document.getElementById('withdraw-amount').value);
    const method = document.getElementById('withdraw-method').value;
    const accountDetails = { details: document.getElementById('withdraw-details').value };
    if (amountUSD < 10) {
        alert('Minimum withdrawal is $10');
        return;
    }
    const withdrawFn = functions.httpsCallable('requestWithdrawal');
    try {
        const result = await withdrawFn({ amountUSD, method, accountDetails });
        alert(`Withdrawal requested! Net: $${result.data.net}`);
        closeModal('withdraw-modal');
        loadUserData(currentUser.uid);
    } catch (err) {
        alert(err.message);
    }
}

// ========== RESELLER SYSTEM ==========
async function checkResellerStatus() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();
    if (userData.role === 'reseller' || (userData.resellerCoins !== undefined && userData.resellerCoins > 0)) {
        document.getElementById('reseller-section').style.display = 'block';
        loadResellerCoins();
        loadPackages();
    }
}

async function loadResellerCoins() {
    const getBalance = functions.httpsCallable('getResellerBalance');
    const res = await getBalance();
    document.getElementById('reseller-coins').innerText = res.data.resellerCoins;
}

async function loadPackages() {
    const listPackages = functions.httpsCallable('listCoinPackages');
    const res = await listPackages();
    const packages = res.data;
    const container = document.getElementById('packages-list');
    if (packages.length === 0) {
        container.innerHTML = '<p>No packages available. Contact admin.</p>';
        return;
    }
    container.innerHTML = packages.map(pkg => `
        <div class="package-card">
            <strong>${pkg.name}</strong><br>
            ${pkg.coins} coins – $${pkg.priceUSD}<br>
            <button onclick="buyPackage('${pkg.id}')">Buy Package</button>
        </div>
    `).join('');
}

function showBuyPackage() {
    document.getElementById('buy-package-modal').style.display = 'flex';
    // Reuse the same packages list inside modal
    const listPackages = functions.httpsCallable('listCoinPackages');
    listPackages().then(res => {
        const packages = res.data;
        const container = document.getElementById('packages-modal-list');
        container.innerHTML = packages.map(pkg => `
            <div class="package-card">
                <strong>${pkg.name}</strong><br>
                ${pkg.coins} coins – $${pkg.priceUSD}<br>
                <button onclick="confirmBuyPackage('${pkg.id}')">Select</button>
            </div>
        `).join('');
    });
}

async function confirmBuyPackage(packageId) {
    const method = prompt('Payment method: telebirr, chapa, bank');
    const details = prompt('Enter payment details (phone/email)');
    const buyFn = functions.httpsCallable('buyCoinPackage');
    try {
        await buyFn({ packageId, paymentMethod: method, paymentDetails: { details } });
        alert('Purchase successful! Reseller coins added.');
        closeModal('buy-package-modal');
        loadResellerCoins();
    } catch (err) {
        alert(err.message);
    }
}

function showTransferCoins() {
    const buyerId = prompt('Enter user UID to sell coins to');
    const amount = parseInt(prompt('Amount of coins to sell'));
    const price = parseFloat(prompt('Price in USD that user will pay you (outside platform)'));
    if (!buyerId || !amount || !price) return;
    const transferFn = functions.httpsCallable('transferCoinsToUser');
    transferFn({ buyerUserId: buyerId, amountCoins: amount, priceUSD: price })
        .then(() => {
            alert(`Transferred ${amount} coins to user. You should collect $${price} separately.`);
            loadResellerCoins();
        })
        .catch(err => alert(err.message));
}

// ========== HELPERS ==========
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}// ==================== ADMIN COIN GENERATION ====================
async function checkAdminStatus() {
    const user = currentUser;
    if (!user) return;
    const idTokenResult = await user.getIdTokenResult();
    if (idTokenResult.claims.admin === true) {
        document.getElementById('admin-section').style.display = 'block';
    }
}

async function adminMintCoins() {
    const targetUserId = document.getElementById('admin-target-uid').value;
    const amountCoins = parseInt(document.getElementById('admin-coin-amount').value);
    const reason = document.getElementById('admin-reason').value;
    if (!targetUserId || !amountCoins) {
        alert('User UID and amount are required');
        return;
    }
    const mintFn = functions.httpsCallable('adminMintCoins');
    try {
        const result = await mintFn({ targetUserId, amountCoins, reason });
        alert(`Successfully generated ${amountCoins} coins for user ${targetUserId}. New balance: ${result.data.newBalance}`);
        document.getElementById('admin-target-uid').value = '';
        document.getElementById('admin-coin-amount').value = '';
        document.getElementById('admin-reason').value = '';
    } catch (err) {
        alert(err.message);
    }
}

// ========== DAILY BONUS CLAIM BUTTON (Add to dashboard) ==========
async function claimDailyBonus() {
    const claimFn = functions.httpsCallable('claimDailyBonus');
    try {
        const result = await claimFn();
        alert(`You received ${result.data.amount} coins for daily login!`);
        loadUserData(currentUser.uid);
    } catch (err) {
        alert(err.message);
    }
}