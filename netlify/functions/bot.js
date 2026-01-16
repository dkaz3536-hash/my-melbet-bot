const axios = require('axios');
const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore();
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.replace(/\\n/g, '\n'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.firestore();
  } catch (e) { return null; }
}

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = process.env.ADMIN_ID;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };
  const db = initFirebase();
  const body = JSON.parse(event.body);

  // Callback Buttons Logic
  if (body.callback_query) {
    const cid = body.callback_query.message.chat.id;
    if (body.callback_query.data === "paid") {
      await sendMessage(cid, "⌛ Шалгаж байна... (Төлбөр баталгаажтал түр хүлээнэ үү)");
      await sendMessage(ADMIN_ID, `⚠️ Хэрэглэгч ${cid} төлбөр төлсөн товч дарлаа.`);
    }
    return { statusCode: 200, body: "OK" };
  }

  const msg = body.message;
  if (!msg || !msg.text) return { statusCode: 200, body: "OK" };
  const chatId = msg.chat.id.toString();
  const text = msg.text.trim();

  // 1. Start & Referral
  if (text.startsWith('/start')) {
    const inviter = text.split(' ')[1];
    const userRef = db.collection('users').doc(chatId);
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({ chatId, invitedBy: inviter || null, bonusBalance: 0 });
    }
    return await sendMenu(chatId, "Сайн байна уу? Үйлдэл сонгоно уу:");
  }

  // 2. Deposit (Melbet ID)
  if (/^\d{7,15}$/.test(text)) {
    const code = Math.random().toString(36).substring(7).toUpperCase();
    return await sendMessage(chatId, `💰 Цэнэглэх хүсэлт:\n\nДанс: Хаан Банк 5000xxxx\nУтга: ${code}`, {
      inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]]
    });
  }

  // 3. Invite Link & Bonus
  if (text === "🎁 Найзаа урих / Бонус") {
    const user = (await db.collection('users').doc(chatId).get()).data();
    const link = `https://t.me/Demobo8okbot?start=${chatId}`;
    return await sendMessage(chatId, `🎁 Таны урилгын линк:\n${link}\n\nОдоогийн бонус: ${user.bonusBalance || 0}₮`);
  }

  return { statusCode: 200, body: "OK" };
};

async function sendMessage(chatId, text, markup = {}) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text, reply_markup: markup });
}

async function sendMenu(chatId, text) {
  await sendMessage(chatId, text, {
    keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]],
    resize_keyboard: true
  });
}
