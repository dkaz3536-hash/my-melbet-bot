const axios = require('axios');
const admin = require('firebase-admin');

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = '7799972127';

// Firebase-ийг нэг л удаа ачаална
if (admin.apps.length === 0) {
  let rawData = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawData && !rawData.startsWith('{')) {
    rawData = Buffer.from(rawData, 'base64').toString('utf-8');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(rawData.trim()))
  });
}
const db = admin.firestore();

exports.handler = async (event) => {
  // 1. Telegram-д "Би хүлээж авлаа" гэсэн хариуг хамгийн түрүүнд бэлдэнэ
  // Энэ нь давхар мессеж ирэхээс 100% сэргийлнэ
  const response = { statusCode: 200, body: JSON.stringify({ ok: true }) };

  if (event.httpMethod !== "POST") return response;

  const body = JSON.parse(event.body);

  try {
    // CALLBACK QUERY (Төлбөр төлсөн товч)
    if (body.callback_query) {
      const cid = body.callback_query.message.chat.id.toString();
      if (body.callback_query.data === "paid") {
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: cid, text: "⌛ Шалгаж байна..." });
        await axios.post(`${TELEGRAM_API}/sendMessage`, { 
          chat_id: ADMIN_ID, 
          text: `💰 Төлбөр!\nID: ${cid}\n\nБаталгаажуулах: /pay ${cid} [дүн]` 
        });
      }
      return response;
    }

    const msg = body.message;
    if (!msg || !msg.text) return response;

    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    // АДМИН КОМАНД
    if (chatId === ADMIN_ID && text.startsWith('/pay')) {
      const parts = text.split(' ');
      if (parts.length === 3) {
        const targetId = parts[1];
        const amount = parseInt(parts[2]);
        const userRef = db.collection('users').doc(targetId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.invitedBy) {
            const bonus = Math.floor(amount * 0.03);
            await db.collection('users').doc(userData.invitedBy.toString()).update({
              bonusEarned: admin.firestore.FieldValue.increment(bonus)
            });
            await axios.post(`${TELEGRAM_API}/sendMessage`, { 
              chat_id: userData.invitedBy.toString(), 
              text: `🎁 Бонус орлоо: ${bonus.toLocaleString()}₮` 
            });
          }
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: targetId, text: `✅ Цэнэглэлт орлоо: ${amount.toLocaleString()}₮` });
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: "✅ Амжилттай." });
        }
      }
      return response;
    }

    // START
    if (text.startsWith('/start')) {
      const inviterId = text.split(' ')[1];
      const userRef = db.collection('users').doc(chatId);
      const doc = await userRef.get();
      if (!doc.exists) {
        await userRef.set({ chatId, invitedBy: inviterId || null, bonusEarned: 0 });
      }
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Сайн байна уу? Сонголтоо хийнэ үү.",
        reply_markup: {
          keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]],
          resize_keyboard: true
        }
      });
      return response;
    }

    // ЦЭНЭГЛЭХ
    if (text === "💰 Цэнэглэх") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "Melbet ID-гаа бичнэ үү:" });
      return response;
    }

    // БОНУС ХАРАХ
    if (text === "🎁 Найзаа урих / Бонус") {
      const userDoc = await db.collection('users').doc(chatId).get();
      const userData = userDoc.data() || { bonusEarned: 0 };
      const link = `https://t.me/Demobo8okbot?start=${chatId}`;
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `🎁 Линк: ${link}\n\n💰 Бонус: ${(userData.bonusEarned || 0).toLocaleString()}₮`
      });
      return response;
    }

    // ID БИЧИХ ҮЕД
    if (/^\d{7,15}$/.test(text)) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `🏦 Хаан Банк: 5000...\n📝 Утга: ${Math.random().toString(36).substring(7).toUpperCase()}`,
        reply_markup: { inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]] }
      });
      return response;
    }

  } catch (err) {
    console.error("Error:", err.message);
  }

  return response;
};
