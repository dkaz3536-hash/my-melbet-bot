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
    if (body.callback_query) {
      const cid = body.callback_query.message.chat.id.toString();
      const data = body.callback_query.data;

      if (data === "paid") {
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: cid, text: "⌛ Төлбөрийг шалгаж байна..." });
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: `💰 Төлбөр!\nID: ${cid}\nБаталгаажуулах: /pay ${cid} [дүн]` });
      }

      if (data.startsWith("withdraw_ok_")) {
        const [_, __, targetId, amount] = data.split("_");
        const userRef = db.collection('users').doc(targetId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists && userDoc.data().bonusEarned >= parseInt(amount)) {
          await userRef.update({ 
            bonusEarned: admin.firestore.FieldValue.increment(-parseInt(amount)) 
          });
          // Гүйлгээний түүх хадгалах
          await db.collection('transactions').add({
            userId: targetId,
            amount: parseInt(amount),
            type: 'withdrawal',
            status: 'completed',
            date: new Date()
          });
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: targetId, text: `✅ Таны ${amount}₮ таталт амжилттай.` });
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: ADMIN_ID, text: `✅ ${targetId}-ийн таталт хасагдлаа.` });
        }
      }
      return response;
    }

    const msg = body.message;
    if (!msg || !msg.text) return response;
    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    // 📢 BROADCAST
    if (chatId === ADMIN_ID && text.startsWith('/send')) {
      const broadcastMsg = text.replace('/send', '').trim();
      const usersSnapshot = await db.collection('users').get();
      for (const doc of usersSnapshot.docs) {
        try { await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: doc.id, text: `📢 ЗАР:\n\n${broadcastMsg}` }); } catch (e) {}
      }
      return response;
    }

    // /PAY - Бонус болон түүх хадгалах
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
            // Бонусын түүх хадгалах
            await db.collection('transactions').add({
              userId: userData.invitedBy.toString(),
              amount: bonus,
              type: 'bonus',
              from: targetId,
              date: new Date()
            });
          }
          await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: targetId, text: `✅ Цэнэглэлт орлоо: ${amount.toLocaleString()}₮` });
        }
      }
      return response;
    }

    if (text.startsWith('/start')) {
      const inviterId = text.split(' ')[1];
      const userRef = db.collection('users').doc(chatId);
      const doc = await userRef.get();
      if (!doc.exists) await userRef.set({ chatId, invitedBy: inviterId || null, bonusEarned: 0 });
      await sendMenu(chatId, "Сонголтоо хийнэ үү.");
      return response;
    }

    // 👥 УРЬСАН ХҮМҮҮС
    if (text === "👥 Миний урьсан хүмүүс") {
      const invitedSnapshot = await db.collection('users').where('invitedBy', '==', chatId).get();
      const count = invitedSnapshot.size;
      let infoText = `👥 Та нийт **${count}** хүн урьсан байна.\n\n`;
      if (count > 0) {
        infoText += "Сүүлийн бүртгэлүүд:\n";
        invitedSnapshot.docs.slice(0, 10).forEach(doc => {
          infoText += `▫️ ID: ${doc.id.substring(0, 5)}***\n`;
        });
      }
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: infoText, parse_mode: "Markdown" });
      return response;
    }

    // 📜 ГҮЙЛГЭЭНИЙ ТҮҮХ
    if (text === "📜 Түүх") {
      const transSnapshot = await db.collection('transactions').where('userId', '==', chatId).orderBy('date', 'desc').limit(5).get();
      if (transSnapshot.empty) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "📜 Танд одоогоор гүйлгээний түүх байхгүй байна." });
      } else {
        let history = "📜 Сүүлийн 5 гүйлгээ:\n\n";
        transSnapshot.forEach(doc => {
          const data = doc.data();
          const type = data.type === 'bonus' ? "🎁 Бонус" : "💳 Таталт";
          history += `${type}: ${data.amount}₮\n📅 ${data.date.toDate().toLocaleDateString()}\n---\n`;
        });
        await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: history });
      }
      return response;
    }

    if (text === "🎁 Найзаа урих / Бонус") {
      const userDoc = await db.collection('users').doc(chatId).get();
      const userData = userDoc.data() || { bonusEarned: 0 };
      const link = `https://t.me/Demobo8okbot?start=${chatId}`;
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `🎁 Линк: ${link}\n💰 Бонус: ${(userData.bonusEarned || 0).toLocaleString()}₮`,
        reply_markup: { keyboard: [[{ text: "👥 Миний урьсан хүмүүс" }, { text: "📜 Түүх" }], [{ text: "⬅️ Буцах" }]], resize_keyboard: true }
      });
      return response;
    }

    if (text === "⬅️ Буцах") return await sendMenu(chatId, "Үндсэн цэс");
    if (text === "💰 Цэнэглэх") await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "Melbet ID-гаа бичнэ үү:" });
    if (text === "💳 Татах") await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "Татах мэдээллээ бичнэ үү (Банк, Данс, Дүн):" });
    
    // ID БҮРТГЭХ
    if (/^\d{7,15}$/.test(text)) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId, text: `🏦 Данс: 5000...\n📝 Утга: ${Math.random().toString(36).substring(7).toUpperCase()}`,
        reply_markup: { inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]] }
      });
    }

  } catch (err) { console.error("Error:", err.message); }
  return response;
};

async function sendMenu(chatId, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId, text: text,
    reply_markup: { keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }], [{ text: "🎁 Найзаа урих / Бонус" }]], resize_keyboard: true }
  });
}
