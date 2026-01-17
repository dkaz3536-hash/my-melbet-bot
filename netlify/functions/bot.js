const axios = require('axios');
const admin = require('firebase-admin');

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = '7799972127';

if (admin.apps.length === 0) {
  let rawData = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawData && !rawData.startsWith('{')) rawData = Buffer.from(rawData, 'base64').toString('utf-8');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawData.trim())) });
}
const db = admin.firestore();

exports.handler = async (event) => {
  const response = { statusCode: 200, body: JSON.stringify({ ok: true }) };
  if (event.httpMethod !== "POST") return response;
  const body = JSON.parse(event.body);

  try {
    // CALLBACK QUERY (Товчлуур дарах үед)
    if (body.callback_query) {
      const cid = body.callback_query.message.chat.id.toString();
      const data = body.callback_query.data;

      if (data === "paid") {
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: cid, text: "⌛ Шалгаж байна..." });
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: `💰 Төлбөр!\nID: ${cid}\n\nБаталгаажуулах: /pay ${cid} [дүн]` });
      }

      // ТАТАХ ХҮСЭЛТ БАТАЛГААЖУУЛАХ (Админ талаас)
      if (data.startsWith("withdraw_ok_")) {
        const [_, __, targetId, amount] = data.split("_");
        const userRef = db.collection('users').doc(targetId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists && userDoc.data().bonusEarned >= parseInt(amount)) {
          await userRef.update({ bonusEarned: admin.firestore.FieldValue.increment(-parseInt(amount)) });
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: targetId, text: `✅ Таны ${amount}₮ таталт амжилттай хийгдлээ.` });
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: `✅ ${targetId}-ийн таталтыг хасаж, баталгаажууллаа.` });
        } else {
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: "❌ Алдаа: Бонус хүрэлцэхгүй эсвэл хэрэглэгч олдсонгүй." });
        }
      }
      return response;
    }

    const msg = body.message;
    if (!msg || !msg.text) return response;
    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    // 📢 BROADCAST: /send [текст]
    if (chatId === ADMIN_ID && text.startsWith('/send')) {
      const broadcastMsg = text.replace('/send', '').trim();
      if (!broadcastMsg) return response;
      
      const usersSnapshot = await db.collection('users').get();
      let count = 0;
      for (const doc of usersSnapshot.docs) {
        try {
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: doc.id, text: `📢 ЗАР:\n\n${broadcastMsg}` });
          count++;
        } catch (e) { console.error(`Failed to send to ${doc.id}`); }
      }
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: `✅ Нийт ${count} хэрэглэгчид зар хүргэлээ.` });
      return response;
    }

    // /PAY КОМАНД (Цэнэглэлт + Бонус)
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
            await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: userData.invitedBy.toString(), text: `🎁 Бонус орлоо: ${bonus.toLocaleString()}₮` });
          }
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: targetId, text: `✅ Цэнэглэлт орлоо: ${amount.toLocaleString()}₮` });
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: "✅ Цэнэглэлт бүртгэгдлээ." });
        }
      }
      return response;
    }

    // START
    if (text.startsWith('/start')) {
      const inviterId = text.split(' ')[1];
      const userRef = db.collection('users').doc(chatId);
      const doc = await userRef.get();
      if (!doc.exists) await userRef.set({ chatId, invitedBy: inviterId || null, bonusEarned: 0 });
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId, text: "Сонголтоо хийнэ үү.",
        reply_markup: { keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]], resize_keyboard: true }
      });
      return response;
    }

    // ТАТАХ ХҮСЭЛТ (Хэрэглэгчээс админ руу)
    if (text === "💳 Татах") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "Татах мэдээллээ бичнэ үү (Банк, Данс, Дүн):" });
      return response;
    }
    
    // Хэрэглэгч татах мэдээллээ бичих үед (Жишээ нь: Хаан 5012... 20000)
    if (text.includes("банк") || text.includes("данс") || (text.split(' ').length >= 3 && !isNaN(text.split(' ').pop()))) {
        const amount = text.split(' ').pop();
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: ADMIN_ID,
            text: `💳 ТАТАХ ХҮСЭЛТ:\nID: ${chatId}\nМэдээлэл: ${text}`,
            reply_markup: { inline_keyboard: [[{ text: `✅ Батлах (${amount}₮ хасах)`, callback_data: `withdraw_ok_${chatId}_${amount}` }]] }
        });
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "⌛ Таны татах хүсэлтийг админ руу илгээлээ." });
        return response;
    }

    // ЦЭНЭГЛЭХ БОЛОН ID ШАЛГАХ
    if (text === "💰 Цэнэглэх") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "Melbet ID-гаа бичнэ үү:" });
    } else if (/^\d{7,15}$/.test(text)) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId, text: `🏦 Данс: 5000...\n📝 Утга: ${Math.random().toString(36).substring(7).toUpperCase()}`,
        reply_markup: { inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]] }
      });
    } else if (text === "🎁 Найзаа урих / Бонус") {
      const userDoc = await db.collection('users').doc(chatId).get();
      const userData = userDoc.data() || { bonusEarned: 0 };
      const link = `https://t.me/Demobo8okbot?start=${chatId}`;
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: `🎁 Линк: ${link}\n\n💰 Бонус: ${(userData.bonusEarned || 0).toLocaleString()}₮` });
    }

  } catch (err) { console.error("Error:", err.message); }
  return response;
};
