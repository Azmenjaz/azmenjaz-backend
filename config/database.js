const { Pool } = require('pg');
require('dotenv').config();

const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl.replace('postgresql://', 'postgres://');

// التحقق من جودة الرابط
if (rawUrl) {
  console.log(`📡 Database URL prefix: ${rawUrl.substring(0, 15)}...`);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 10, // تقليل العدد لتجنب قطع الاتصال
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
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
      console.error(`⚠️ محاولة ${i + 1} فشلت:`, err.message);
      if (err.message.includes('ECONNRESET')) {
        console.error('💡 نصيحة: خطأ ECONNRESET غالباً يعني مشكلة في SSL أو أن الرابط غير كامل.');
      }
      if (i === retries - 1) {
        console.error('❌ فشل الاتصال النهائي. يرجى التأكد من Public Connection String.');
      } else {
        await new Promise(res => setTimeout(res, 2000));
      }
    }
  }
};

testConnection();

module.exports = pool;
