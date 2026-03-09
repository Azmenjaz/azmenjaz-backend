const axios = require('axios');

async function sendPriceAlert(data) {
  const {
    userName,
    userPhone,
    fromCity,
    toCity,
    travelDate,
    price,
    recommendation
  } = data;

  try {
    const formattedDate = new Date(travelDate).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const cityNames = {
      'RUH': 'الرياض',
      'JED': 'جدة',
      'DMM': 'الدمام',
      'AHB': 'أبها',
      'TIF': 'الطائف',
      'MED': 'المدينة المنورة',
      'TUU': 'تبوك',
      'AJF': 'الجوف',
      'YNB': 'ينبع',
      'GIZ': 'جازان',
      'ELQ': 'القصيم',
      'HAS': 'حائل',
    };

    const fromCityName = cityNames[fromCity] || fromCity;
    const toCityName = cityNames[toCity] || toCity;

    const message = `
🛫 سفر سمارت - تنبيه سعر*

مرحباً ${userName} 👋

*${fromCityName} ← ${toCityName}*
📅 ${formattedDate}

💰 *السعر: ${price} ريال*

${recommendation.message}

🔗 احجز الآن: https://safarsmart.com
`.trim();

    // إذا Ultramsg مفعّل
    if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
      const response = await axios.post(
        `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
        {
          token: process.env.ULTRAMSG_TOKEN,
          to: userPhone,
          body: message
        }
      );

      console.log(`✅ تم إرسال تنبيه واتساب لـ ${userName}`);
      return { success: true, response: response.data };
    } else {
      // وضع الاختبار
      console.log('📱 [TEST MODE] رسالة واتساب:');
      console.log(`إلى: ${userPhone}`);
      console.log(message);
      return { success: true, test: true };
    }

  } catch (error) {
    console.error('❌ خطأ في إرسال التنبيه:', error.message);
    throw error;
  }
}

module.exports = { sendPriceAlert };
