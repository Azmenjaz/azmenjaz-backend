const { Pool } = require('pg');
require('dotenv').config();

// التحقق من المتغيرات المتاحة (Public أولاً لأنه الأكثر استقراراً في الكرون)
const rawUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || '';
const connectionString = rawUrl.replace('postgresql://', 'postgres://');

// تشخيص الرابط المستخدم
if (rawUrl) {
  const maskedUrl = rawUrl.split('@')[1] || rawUrl.substring(0, 20);
  console.log(`📡 Attempting connection to: ${maskedUrl}`);
} else {
  console.error('❌ No Database URL found in environment variables!');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // مطلوب في أغلب استضافات السحاب مثل Railway للاتصال الخارجي
  },
  max: 5, // تقليل العدد لثبات الاتصال
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ خطأ مفاجئ في مجمع الاتصالات:', err.message);
});

const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
      client.release();
      return;
    } catch (err) {
      console.error(`⚠️ محاولة ${i + 1} فشلت: ${err.message}`);

      if (err.message.includes('ECONNRESET')) {
        console.error('💡 نصيحة: تم قطع الاتصال من السيرفر. تأكد أنك تستخدم DATABASE_PUBLIC_URL كاملاً.');
      }

      if (i === retries - 1) {
        console.error('❌ فشل الاتصال النهائي. يرجى مراجعة إعدادات DATABASE_PUBLIC_URL في Railway.');
      } else {
        await new Promise(res => setTimeout(res, 3000)); // انتظر 3 ثوانٍ قبل المحاولة التالية
      }
    }
  }
};

testConnection();

module.exports = pool;
