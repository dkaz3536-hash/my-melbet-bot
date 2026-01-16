const axios = require('axios');
const admin = require('firebase-admin');

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = '984210857'; // Өөрийн ID-гаа энд шалгаарай

function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore();
  try {
    let rawData = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawData.startsWith('{')) rawData = Buffer.from(rawData, 'base64').toString('utf-8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawData.trim())) });
    return admin.firestore();
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };
  const db = initFirebase();
  const body = JSON.parse(event.body);

  if (body.callback_query) {
    const cid = body.callback_query.message.chat.id;
    if (body.callback_query.data === "paid") {
      await sendMessage(cid, "⌛ Шалгаж байна... Төлбөр баталгаажтал түр хүлээнэ үү.");
      await sendMessage(ADMIN_ID, `💰 Төлбөрийн хүсэлт!\nID: ${cid}\n\nБаталгаажуулах заавар:\n/pay ${cid} [дүн]`);
    }
    return { statusCode: 200, body: "OK" };
  }

  const msg = body.message;
  if (!msg || !msg.text) return { statusCode: 200, body: "OK" };
  const chatId = msg.chat.id.toString();
  const text = msg.text.trim();

  try {
    // --- АДМИН КОМАНД: /pay [UserID] [Amount] ---
    if (chatId === ADMIN_ID && text.startsWith('/pay')) {
      const parts = text.split(' ');
      if (parts.length === 3) {
        const targetId = parts[1];
        const amount = parseInt(parts[2]);
        
        const userRef = db.collection('users').doc(targetId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          // 1. Хэрэглэгчийн баланс нэмэх
          await userRef.update({ balance: admin.firestore.FieldValue.increment(amount) });
          await sendMessage(targetId, `✅ Таны ${amount}₮ цэнэглэлт амжилттай орлоо!`);

          // 2. Урьсан хүнд бонус өгөх (3%)
          if (userData.invitedBy) {
            const bonus = amount * 0.03;
            const inviterRef = db.collection('users').doc(userData.invitedBy);
            await inviterRef.update({ 
                balance: admin.firestore.FieldValue.increment(bonus),
                bonusEarned: admin.firestore.FieldValue.increment(bonus)
            });
            await sendMessage(userData.invitedBy, `🎁 Таны урьсан хэрэглэгч цэнэглэлт хийлээ! Танд ${bonus}₮ бонус орлоо.`);
          }
          return await sendMessage(ADMIN_ID, "✅ Гүйлгээг амжилттай бүртгэлээ.");
        }
      }
    }

    // --- ХЭРЭГЛЭГЧИЙН ХЭСЭГ ---
    if (text.startsWith('/start')) {
      const inviterId = text.split(' ')[1];
      const userRef = db.collection('users').doc(chatId);
      const doc = await userRef.get();
      if (!doc.exists) {
        await userRef.set({ chatId, invitedBy: inviterId || null, balance: 0, bonusEarned: 0 });
      }
      return await sendMenu(chatId, "Тавтай морил!");
    }

    if (text === "🎁 Найзаа урих / Бонус") {
        const userDoc = await db.collection('users').doc(chatId).get();
        const userData = userDoc.data();
        const link = `https://t.me/Demobo8okbot?start=${chatId}`;
        return await sendMessage(chatId, `🎁 Таны линк: ${link}\n\n💰 Таны баланс: ${userData.balance || 0}₮\n🎈 Урилгын бонус: ${userData.bonusEarned || 0}₮`);
    }

    if (text === "💰 Цэнэглэх") return await sendMessage(chatId, "Melbet ID-гаа бичнэ үү:");
    if (/^\d{7,15}$/.test(text)) {
      return await sendMessage(chatId, `Данс: 5000... (Болд)\nУтга: ${Math.random().toString(36).substring(7).toUpperCase()}`, {
        inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]]
      });
    }

  } catch (err) { console.error(err); }
  return { statusCode: 200, body: "OK" };
};

async function sendMessage(chatId, text, markup = null) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text, reply_markup: markup });
}

async function sendMenu(chatId, text) {
  await sendMessage(chatId, text, {
    keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]],
    resize_keyboard: true
  });
}
