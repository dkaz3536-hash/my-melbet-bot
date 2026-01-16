const axios = require('axios');
const admin = require('firebase-admin');

// Firebase-ийг илүү найдвартай ачаалах функц
function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore();

  try {
    let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccount) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT олдохгүй байна");
    }

    // Хэрэв текст дотор шинэ мөр (\n) байгаа бол засах
    const formattedAccount = serviceAccount.replace(/\\n/g, '\n');
    const parsedAccount = JSON.parse(formattedAccount);

    admin.initializeApp({
      credential: admin.credential.cert(parsedAccount)
    });
    
    console.log("Firebase холбогдлоо");
    return admin.firestore();
  } catch (error) {
    console.error("Firebase алдаа:", error.message);
    return null;
  }
}

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };

  const db = initFirebase();
  if (!db) return { statusCode: 200, body: "Firebase Error" };

  try {
    const body = JSON.parse(event.body);
    const msg = body.message;
    if (!msg || !msg.text) return { statusCode: 200, body: "OK" };

    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    if (text === '/start') {
      await db.collection('users').doc(chatId).set({
        chatId: chatId,
        lastActive: new Date()
      }, { merge: true });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "✅ Систем ажиллаж байна. Үйлдэл сонгоно уу:",
        reply_markup: {
          keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих" }]],
          resize_keyboard: true
        }
      });
    }

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Handler Error:", err.message);
    return { statusCode: 200, body: "OK" };
  }
};
