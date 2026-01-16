const axios = require('axios');

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

    // Зөвхөн хариу илгээх (Firebase-гүй)
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "✅ Бот амжилттай холбогдлоо! Одоо Firebase-ээ засах хэрэгтэй байна.",
      reply_markup: {
        keyboard: [[{ text: "💰 Цэнэглэх" }, { text: "💳 Татах" }]],
        resize_keyboard: true
      }
    });

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    return { statusCode: 200, body: "OK" };
  }
};
