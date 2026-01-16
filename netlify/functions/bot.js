const axios = require('axios');
const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore();
  try {
    // Base64-өөр орж ирсэн текстийг буцааж JSON болгох
    const base64Data = process.env.FIREBASE_SERVICE_ACCOUNT;
    const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedData);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase холбогдлоо");
    return admin.firestore();
  } catch (e) {
    console.error("Firebase Error:", e.message);
    return null;
  }
}

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = process.env.ADMIN_ID; // Таны ID Netlify-д орсон байх ёстой

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };
  
  const db = initFirebase();
  const body = JSON.parse(event.body);

  // Товчлуур дарах үед (Төлбөр төлсөн)
  if (body.callback_query) {
    const cid = body.callback_query.message.chat.id;
    if (body.callback_query.data === "paid") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: cid, text: "⌛ Шалгаж байна... Түр хүлээнэ үү." });
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: `⚠️ Хэрэглэгч ${cid} төлбөр төлсөн товч дарлаа.` });
    }
    return { statusCode: 200, body: "OK" };
  }

  const msg = body.message;
  if (!msg || !msg.text) return { statusCode: 200, body: "OK" };
  const chatId = msg.chat.id.toString();
  const text = msg.text.trim();

  // /start команд
  if (text.startsWith('/start')) {
    if (db) {
      await db.collection('users').doc(chatId).set({ chatId, lastActive: new Date() }, { merge: true });
    }
    return await sendMenu(chatId, "Сайн байна уу? Melbet цэнэглэлтийн ботод тавтай морил.");
  }

  // Melbet ID (7-15 оронтой тоо)
  if (/^\d{7,15}$/.test(text)) {
    const code = Math.random().toString(36).substring(7).toUpperCase();
    return await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `💰 Цэнэглэх хүсэлт:\n\n🏦 Банк: Хаан Банк\n🔢 Данс: 5000000000\n📝 Утга: ${code}\n\nТөлбөрөө шилжүүлээд доорх товчийг дарна уу.`,
      reply_markup: { inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]] }
    });
  }

  // Найзаа урих
  if (text === "🎁 Найзаа урих / Бонус") {
    const link = `https://t.me/Demobo8okbot?start=${chatId}`;
    return await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `🎁 Таны урилгын линк:\n${link}\n\nТаны линкээр орж цэнэглэлт хийсэн хүн бүрээс 3% бонус таны дансанд орно.`
    });
  }

  return { statusCode: 200, body: "OK" };
};

async function sendMenu(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId, text,
    reply_markup: {
      keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]],
      resize_keyboard: true
    }
  });
}
