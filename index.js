const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.generateCoins = functions.https.onCall(
  async (data, context) => {

    // CHECK LOGIN
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const adminUid = context.auth.uid;

    // CHECK ADMIN ROLE
    const adminDoc = await admin
      .firestore()
      .collection("users")
      .doc(adminUid)
      .get();

    if (!adminDoc.exists) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin not found"
      );
    }

    const adminData = adminDoc.data();

    if (adminData.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins allowed"
      );
    }

    // GET DATA
    const targetUid = data.targetUid;
    const amount = Number(data.amount);
    const reason = data.reason || "Coin generation";

    // VALIDATION
    if (!targetUid || !amount) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing fields"
      );
    }

    if (amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid amount"
      );
    }

    if (amount > 1000000) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Too many coins"
      );
    }

    // USER REFERENCE
    const userRef = admin
      .firestore()
      .collection("users")
      .doc(targetUid);

    // UPDATE USER COINS
    await userRef.update({
      coins: admin.firestore.FieldValue.increment(amount)
    });

    // SAVE LOG
    await admin.firestore()
      .collection("coin_logs")
      .add({
        adminUid: adminUid,
        targetUid: targetUid,
        amount: amount,
        reason: reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return {
      success: true,
      message: "Coins generated successfully"
    };
  }
);