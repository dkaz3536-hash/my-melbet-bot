const axios = require('axios');
const admin = require('firebase-admin');

const BOT_TOKEN = '7800075626:AAHq8_vop3-vpqtufnxiFZ97hGpMvxZQdvg';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = '7799972127'; // Таны ID

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
    const cid = body.callback_query.message.chat.id.toString();
    if (body.callback_query.data === "paid") {
      await sendMessage(cid, "⌛ Шалгаж байна... Төлбөр баталгаажтал түр хүлээнэ үү.");
      await sendMessage(ADMIN_ID, `💰 Төлбөрийн хүсэлт!\nID: ${cid}\n\nБаталгаажуулах: /pay ${cid} [дүн]`);
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
          await sendMessage(targetId, `✅ Таны ${amount.toLocaleString()}₮ цэнэглэлт баталгаажлаа.`);

          // Хэрэглэгчийг урьсан хүн байгаа эсэхийг шалгах
          if (userData.invitedBy) {
            const bonus = Math.floor(amount * 0.03); // 3% бонус (бүхэл тоогоор)
            const inviterRef = db.collection('users').doc(userData.invitedBy.toString());
            
            // Firebase-д бонусын дүнг нэмэгдүүлэх
            await inviterRef.update({ 
                bonusEarned: admin.firestore.FieldValue.increment(bonus)
            });
            
            await sendMessage(userData.invitedBy.toString(), `🎁 Таны урьсан найз цэнэглэлт хийлээ! Танд ${bonus.toLocaleString()}₮ бонус орлоо.`);
          }
          await sendMessage(ADMIN_ID, `✅ ${targetId} хэрэглэгчийн цэнэглэлтийг бүртгэж, бонус бодлоо.`);
        } else {
          await sendMessage(ADMIN_ID, "❌ Хэрэглэгч системд бүртгэлгүй байна.");
        }
      }
      return { statusCode: 200, body: "OK" };
    }

    // --- ХЭРЭГЛЭГЧИЙН START ---
    if (text.startsWith('/start')) {
      const inviterId = text.split(' ')[1];
      const userRef = db.collection('users').doc(chatId);
      const doc = await userRef.get();
      if (!doc.exists) {
        await userRef.set({ 
            chatId: chatId, 
            invitedBy: inviterId || null, 
            bonusEarned: 0,
            createdAt: new Date()
        });
      }
      return await sendMenu(chatId, "Сайн байна уу? Melbet цэнэглэлтийн ботод тавтай морил.");
    }

    // --- БОНУС ХАРАХ ---
    if (text === "🎁 Найзаа урих / Бонус") {
        const userDoc = await db.collection('users').doc(chatId).get();
        const userData = userDoc.data() || { bonusEarned: 0 };
        const link = `https://t.me/Demobo8okbot?start=${chatId}`;
        const bonus = userData.bonusEarned || 0;
        
        return await sendMessage(chatId, `🎁 Таны урилгын линк:\n${link}\n\n💰 Таны цуглуулсан бонус: ${bonus.toLocaleString()}₮\n\n(Таны урьсан хүн цэнэглэлт хийх бүрт танд 3% бонус орно)`);
    }

    if (text === "💰 Цэнэглэх") return await sendMessage(chatId, "Melbet ID-гаа бичнэ үү:");
    
    if (/^\d{7,15}$/.test(text)) {
      return await sendMessage(chatId, `🏦 Данс: 5000... (Болд)\n📝 Утга: ${Math.random().toString(36).substring(7).toUpperCase()}\n\nТөлбөрөө шилжүүлээд доорх товчийг дарна уу.`, {
        inline_keyboard: [[{ text: "✅ Төлбөр төлсөн", callback_data: "paid" }]]
      });
    }

    if (text === "💳 Татах") return await sendMessage(chatId, "Татах мэдээллээ бичнэ үү (Банк, Данс, Дүн):");

  } catch (err) { console.error(err); }
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
