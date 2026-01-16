const axios = require('axios');
const admin = require('firebase-admin');

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Firebase-ийг ачаалах функц
function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore();
  try {
    let rawData = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Хэрэв Base64 бол decode хийнэ, үгүй бол шууд уншина
    if (!rawData.startsWith('{')) {
      rawData = Buffer.from(rawData, 'base64').toString('utf-8');
    }
    const serviceAccount = JSON.parse(rawData.trim());
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.firestore();
  } catch (e) {
    console.error("Firebase Init Error:", e.message);
    return null;
  }
}

exports.handler = async (event) => {
  // Telegram-д "би хүлээж авлаа" гэж хурдан хариулах (Давхар мессеж ирэхээс сэргийлнэ)
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };

  const db = initFirebase();
  const body = JSON.parse(event.body);

  try {
    const msg = body.message;
    if (!msg || !msg.text) return { statusCode: 200, body: "OK" };
    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    if (text.startsWith('/start')) {
      if (db) {
        await db.collection('users').doc(chatId).set({ chatId, lastActive: new Date() }, { merge: true });
      }
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "✅ Систем амжилттай холбогдлоо. Сонголтоо хийнэ үү:",
        reply_markup: {
          keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]],
          resize_keyboard: true
        }
      });
    }
    // Бусад логикуудыг түр азнаад эхлээд холболтоо шалгая
  } catch (err) {
    console.error("General Error:", err.message);
  }

  return { statusCode: 200, body: "OK" }; 
};
