const axios = require('axios');
const admin = require('firebase-admin');

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = '7799972127'; // Таны ID зөв байна

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

  // 1. Товчлуур дарах үед (Callback Query)
  if (body.callback_query) {
    const cid = body.callback_query.message.chat.id.toString();
    if (body.callback_query.data === "paid") {
      try {
        await sendMessage(cid, "⌛ Шалгаж байна... Төлбөр баталгаажтал түр хүлээнэ үү.");
        // АДМИН руу мэдэгдэл илгээх (Энд ADMIN_ID-г шууд ашиглав)
        await sendMessage(ADMIN_ID, `💰 Төлбөрийн хүсэлт ирлээ!\nХэрэглэгчийн ID: ${cid}\n\nБаталгаажуулах: /pay ${cid} 5000`);
      } catch (e) {
        console.error("Admin notify error:", e.message);
      }
    }
    return { statusCode: 200, body: "OK" };
  }

  const msg = body.message;
  if (!msg || !msg.text) return { statusCode: 200, body: "OK" };
  const chatId = msg.chat.id.toString();
  const text = msg.text.trim();

  try {
    // 2. АДМИН КОМАНД ШАЛГАХ
    if (chatId === ADMIN_ID && text.startsWith('/pay')) {
      const parts = text.split(' ');
      if (parts.length === 3) {
        const targetId = parts[1];
        const amount = parseInt(parts[2]);
        const userRef = db.collection('users').doc(targetId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          await userRef.update({ balance: admin.firestore.FieldValue.increment(amount) });
          await sendMessage(targetId, `✅ Таны ${amount}₮ цэнэглэлт орлоо!`);
          
          const userData = userDoc.data();
          if (userData.invitedBy) {
            const bonus = amount * 0.03;
            await db.collection('users').doc(userData.invitedBy.toString()).update({
              balance: admin.firestore.FieldValue.increment(bonus),
              bonusEarned: admin.firestore.FieldValue.increment(bonus)
            });
            await sendMessage(userData.invitedBy.toString(), `🎁 Бонус орлоо: ${bonus}₮`);
          }
          await sendMessage(ADMIN_ID, "✅ Гүйлгээ амжилттай бүртгэгдлээ.");
        } else {
          await sendMessage(ADMIN_ID, "❌ Хэрэглэгч олдсонгүй.");
        }
      }
      return { statusCode: 200, body: "OK" };
    }

    // 3. START КОМАНД
    if (text.startsWith('/start')) {
      const inviterId = text.split(' ')[1];
      if (db) {
        const userRef = db.collection('users').doc(chatId);
        const doc = await userRef.get();
        if (!doc.exists) {
          await userRef.set({ chatId, invitedBy: inviterId || null, balance: 0, bonusEarned: 0 });
        }
      }
      await sendMenu(chatId, "Тавтай морил!");
      return { statusCode: 200, body: "OK" };
    }

    // Бусад товчлуурууд...
    if (text === "💰 Цэнэглэх") {
      await sendMessage(chatId, "Melbet ID-гаа бичнэ үү:");
      return { statusCode: 200, body: "OK" };
    }
    
    if (text === "🎁 Найзаа урих / Бонус") {
      const userDoc = await db.collection('users').doc(chatId).get();
      const userData = userDoc.data() || { balance: 0, bonusEarned: 0 };
      const link = `https://t.me/Demobo8okbot?start=${chatId}`;
      await sendMessage(chatId, `🎁 Урилгын линк: ${link}\n\n💰 Баланс: ${userData.balance || 0}₮\n🎈 Бонус: ${userData.bonusEarned || 0}₮`);
      return { statusCode: 200, body: "OK" };
    }

    if (/^\d{7,15}$/.test(text)) {
      await sendMessage(chatId, `🏦 Хаан Банк: 5000...\n📝 Утга: ${Math.random().toString(36).substring(7).toUpperCase()}`, {
        inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]]
      });
      return { statusCode: 200, body: "OK" };
    }

  } catch (err) { console.error("Error:", err.message); }
  return { statusCode: 200, body: "OK" };
};

async function sendMessage(chatId, text, markup = null) {
  const payload = { chat_id: chatId.toString(), text: text };
  if (markup) payload.reply_markup = markup;
  return axios.post(`${TELEGRAM_API}/sendMessage`, payload);
}

async function sendMenu(chatId, text) {
  return sendMessage(chatId, text, {
    keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]],
    resize_keyboard: true
  });
}
