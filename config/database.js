const { Pool } = require('pg');
require('dotenv').config();

// يحاول الكود قراءة أي من المتغيرين المتاحين في Railway
const rawUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || '';
const connectionString = rawUrl.replace('postgresql://', 'postgres://');

if (!rawUrl) {
  console.error('❌ خطأ: لم يتم العثور على رابط قاعدة البيانات (DATABASE_URL) في الإعدادات.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 10000, // مهلة 10 ثوانٍ للاتصال
});

// وظيفة اختبار الاتصال مع إعادة المحاولة التلقائية
const connectWithRetry = (attempts = 5) => {
  pool.connect((err, client, release) => {
    if (err) {
      console.error(`⚠️ فشل الاتصال (محاولة ${6 - attempts}):`, err.message);
      if (attempts > 1) {
        console.log('🔄 جاري إعادة المحاولة خلال 5 ثوانٍ...');
        setTimeout(() => connectWithRetry(attempts - 1), 5000);
      } else {
        console.error('❌ فشل الاتصال النهائي. تأكد من صحة الرابط في Railway.');
      }
    } else {
      console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
      release();
    }
  });
};

connectWithRetry();

module.exports = pool;
