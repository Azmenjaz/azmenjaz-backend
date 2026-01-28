const axios = require('axios');
const pool = require('../config/database');

/**
 * إرسال تنبيه سعر عبر واتساب
 */
async function sendPriceAlert(data) {
  const {
    userId,
    userName,
    userPhone,
    route,
    fromCity,
    toCity,
    travelDate,
    price,
    airline,
    recommendation
  } = data;

  try {
    // تنسيق التاريخ
    const formattedDate = new Date(travelDate).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // تنسيق أسماء المدن
    const cityNames = {
      'RUH': 'الرياض',
      'JED': 'جدة',
      'DMM': 'الدمام',
      'AHB': 'أبها',
      'TIF': 'الطائف',
      'MED': 'المدينة المنورة'
    };

    const fromCityName = cityNames[fromCity] || fromCity;
    const toCityName = cityNames[toCity] || toCity;

    // إنشاء رسالة واتساب
    const message = `
🛫 *أزمنجاز - تنبيه سعر*

مرحباً ${userName} 👋

*${fromCityName} ← ${toCityName}*
📅 ${formattedDate}

💰 *السعر الحالي: ${price} ريال*
✈️ الناقل: ${airline || 'غير محدد'}

${recommendation.message}

🔗 احجز الآن عبر موقعنا:
https://azmenjaz.com

ــــــــــــــــــــــــــــــ
💡 نصيحة: الأسعار تتغير بسرعة!
`.trim();

    // إرسال عبر Ultramsg
    const response = await axios.post(
      `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
      {
        token: process.env.ULTRAMSG_TOKEN,
        to: userPhone,
        body: message
      }
    );

    // حفظ سجل الإشعار
    await saveNotificationLog({
      userId,
      alertId: data.alertId,
      price,
      recommendation: recommendation.action,
      message: recommendation.message,
      sentAt: new Date()
    });

    console.log(`✅ تم إرسال تنبيه واتساب لـ ${userName} (${userPhone})`);

    return { success: true, response: response.data };

  } catch (error) {
    console.error('❌ خطأ في إرسال تنبيه واتساب:', error.response?.data || error.message);
    
    // في حالة الفشل، يمكن إرسال إيميل بدلاً منه (اختياري)
    // await sendEmailAlert(data);
    
    throw error;
  }
}

/**
 * حفظ سجل الإشعار في قاعدة البيانات
 */
async function saveNotificationLog(data) {
  try {
    const query = `
      INSERT INTO notifications_sent (alert_id, price, recommendation, message, sent_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      data.alertId || null,
      data.price,
      data.recommendation,
      data.message,
      data.sentAt
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('❌ خطأ في حفظ سجل الإشعار:', error);
  }
}

/**
 * إرسال تنبيه اختبار
 */
async function sendTestNotification(phone, name = 'صديقي') {
  try {
    const message = `
🛫 *أزمنجاز - رسالة اختبار*

مرحباً ${name}! 👋

هذه رسالة تجريبية من أزمنجاز.
إذا وصلتك هذه الرسالة، فالتنبيهات تعمل بنجاح! ✅

🌐 زر موقعنا: https://azmenjaz.com
`.trim();

    const response = await axios.post(
      `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
      {
        token: process.env.ULTRAMSG_TOKEN,
        to: phone,
        body: message
      }
    );

    console.log(`✅ تم إرسال رسالة اختبار لـ ${phone}`);
    return { success: true, response: response.data };

  } catch (error) {
    console.error('❌ خطأ في إرسال رسالة الاختبار:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendPriceAlert,
  sendTestNotification,
  saveNotificationLog
};
