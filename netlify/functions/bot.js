const axios = require('axios');
const admin = require('firebase-admin');

// Firebase-ийг ачаалж чадахгүй бол алдааг мэдээлэх хэсэг
try {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccount) {
      console.error("АЛДАА: FIREBASE_SERVICE_ACCOUNT олдсонгүй!");
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount))
      });
      console.log("Firebase амжилттай холбогдлоо.");
    }
  }
} catch (e) {
  console.error("Firebase ачаалахад алдаа гарлаа:", e.message);
}

const db = admin.firestore();
const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };

  try {
    const body = JSON.parse(event.body);
    const msg = body.message;
    if (!msg || !msg.text) return { statusCode: 200, body: "OK" };

    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    if (text === '/start') {
      // Firebase-д хэрэглэгч бүртгэх
      await db.collection('users').doc(chatId).set({
        chatId: chatId,
        lastActive: new Date()
      }, { merge: true });

      // Цэс илгээх
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Сайн байна уу? Бот ажиллахад бэлэн боллоо.",
        reply_markup: {
          keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }]],
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
