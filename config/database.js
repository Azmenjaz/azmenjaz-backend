const { Pool } = require('pg');
require('dotenv').config();

const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl.replace('postgresql://', 'postgres://');

// التحقق من نوع الاتصال (داخلي أم خارجي) للتنبيه
if (connectionString.includes('railway.internal')) {
  console.warn('⚠️ تنبيه: أنت تستخدم عنوان الربط الداخلي لـ Railway، قد يسبب مشاكل في الاتصال. يفضل استخدام Public Connection String.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20, // أقصى عدد من الاتصالات النشطة
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // مهلة الاتصال قبل الفشل
});

// اختبار الاتصال مع تفاصيل الخطأ
pool.on('error', (err) => {
  console.error('❌ خطأ غير متوقع في قاعدة البيانات:', err.message);
});

// فحص أولي عند التشغيل
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ قاعدة البيانات متصلة بنجاح!');
    client.release();
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
    console.error('💡 نصيحة: تأكد من استخدام Public Connection String في إعدادات Railway.');
  }
};

testConnection();

module.exports = pool;
