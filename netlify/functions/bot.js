const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin-ийг тохируулах (Server-side-д зориулсан)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = process.env.ADMIN_ID; // Таны Telegram ID

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 200, body: "OK" };

  const body = JSON.parse(event.body);
  const msg = body.message;

  if (!msg || !msg.text) return { statusCode: 200, body: "OK" };

  const chatId = msg.chat.id.toString();
  const text = msg.text.trim();

  try {
    // 1. /start command & Referral Logic
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const inviterId = parts.length > 1 ? parts[1] : null;

      const userRef = db.collection('users').doc(chatId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await userRef.set({
          chatId: chatId,
          invitedBy: inviterId,
          bonusBalance: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return await sendMenu(chatId, "Сайн байна уу? Melbet цэнэглэлтийн ботод тавтай морил.");
    }

    // 2. Цэнэглэх (ID таних) - 7-15 оронтой тоо
    if (/^\d{7,15}$/.test(text)) {
      const randomCode = Math.random().toString(36).substring(7).toUpperCase();
      await db.collection('requests').add({
        chatId: chatId,
        gameId: text,
        code: randomCode,
        status: 'pending',
        type: 'deposit'
      });

      const bankInfo = `💰 Цэнэглэх хүсэлт:\n\n🏦 Банк: Хаан Банк\n🔢 Данс: 5000000000 (Жишээ)\n👤 Хүлээн авагч: БОТ\n📝 Утга: ${randomCode}\n\nТөлбөр төлсний дараа доорх товчийг дарна уу.`;
      return await sendMessage(chatId, bankInfo, {
        inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]]
      });
    }

    // 3. Татах хүсэлт (ID болон Код)
    if (/\d{7,15} [A-Z0-9]+/.test(text)) {
      await db.collection('users').doc(chatId).update({ lastWithdrawRequest: text });
      return await sendMessage(chatId, "Мөнгө хүлээн авах дансны дугаараа (Жишээ нь: MN3700...) оруулна уу:");
    }

    // 4. MN агуулсан текст (Данс)
    if (text.includes("MN")) {
      const userDoc = await db.collection('users').doc(chatId).get();
      const withdrawInfo = userDoc.data().lastWithdrawRequest;
      
      await sendMessage(ADMIN_ID, `💳 ТАТАХ ХҮСЭЛТ:\nID: ${chatId}\nМэдээлэл: ${withdrawInfo}\nДанс: ${text}`);
      return await sendMessage(chatId, "Таны татах хүсэлтийг админ руу илгээлээ. Түр хүлээнэ үү.");
    }

    // 5. Админы баталгаажуулалт (Зөвхөн Админ): [GameID] [Дүн]
    if (chatId === ADMIN_ID && /^\d+ \d+$/.test(text)) {
      const [gameId, amount] = text.split(' ');
      const depositAmount = parseInt(amount);

      // Уг хүсэлтийг гаргасан хэрэглэгчийг олох
      const userSnap = await db.collection('users').where('chatId', '!=', null).get(); // Хялбарчилсан хайлт
      let targetUser = null;
      userSnap.forEach(doc => { if(doc.id === gameId) targetUser = doc.data(); }); 
      
      // Илүү оновчтой нь: тухайн gameId-тай хамгийн сүүлийн хүсэлт
      const reqSnap = await db.collection('requests').where('gameId', '==', gameId).orderBy('createdAt', 'desc').limit(1).get();
      
      if (!reqSnap.empty) {
        const reqData = reqSnap.docs[0].data();
        const userId = reqData.chatId;

        await sendMessage(userId, `✅ Амжилттай! Таны ${gameId} ID-д ${depositAmount}₮ орлоо.`);

        // Бонус бонус тооцох
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const inviterId = userDoc.data().invitedBy;

        if (inviterId) {
          const bonus = Math.floor(depositAmount * 0.03);
          await db.collection('users').doc(inviterId).update({
            bonusBalance: admin.firestore.FieldValue.increment(bonus)
          });
          await sendMessage(inviterId, `🎁 Бонус орлоо! Таны урьсан хүн ${depositAmount}₮ цэнэглэлт хийсэн тул танд ${bonus}₮ нэмэгдлээ.`);
        }
      }
      return await sendMessage(ADMIN_ID, "Баталгаажуулалт амжилттай.");
    }

  } catch (error) {
    console.error(error);
  }

  return { statusCode: 200, body: "OK" };
};

// Туслах функцууд
async function sendMessage(chatId, text, replyMarkup = {}) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup
  });
  return { statusCode: 200, body: "OK" };
}

async function sendMenu(chatId, text) {
  return await sendMessage(chatId, text, {
    keyboard: [
      [{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }],
      [{ text: "🎁 Найзаа урих / Бонус" }]
    ],
    resize_keyboard: true
  });
}
