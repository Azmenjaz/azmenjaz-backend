const cron = require('node-cron');
const Alert = require('../models/Alert');
const Price = require('../models/Price');
const User = require('../models/User');
const AmadeusService = require('../services/amadeusService');
const { analyzePriceChange } = require('../utils/priceAnalyzer');
const { sendPriceAlert } = require('../services/notificationService');

// جدولة: كل 12 ساعة (8 صباحاً و 8 مساءً)
const scheduleTask = () => {
  cron.schedule('0 8,20 * * *', async () => {
    console.log('🔍 [Cron] بدء فحص الأسعار...');
    console.log(`⏰ الوقت: ${new Date().toLocaleString('ar-SA')}`);
    
    try {
      await checkAllPrices();
    } catch (error) {
      console.error('❌ [Cron] خطأ في فحص الأسعار:', error);
    }
  });

  console.log('✅ [Cron] تم جدولة فحص الأسعار (8 ص و 8 م)');
};

// فحص جميع الأسعار
async function checkAllPrices() {
  try {
    const alerts = await Alert.getActive();
    
    if (alerts.length === 0) {
      console.log('ℹ️ [Cron] لا توجد تنبيهات نشطة');
      return;
    }

    console.log(`📊 [Cron] عدد التنبيهات النشطة: ${alerts.length}`);

    let successCount = 0;
    let failCount = 0;
    let notificationsSent = 0;

    for (let alert of alerts) {
      try {
        const result = await processAlert(alert);
        
        if (result.success) {
          successCount++;
          if (result.notificationSent) {
            notificationsSent++;
          }
        } else {
          failCount++;
        }

        await sleep(1000);

      } catch (error) {
        console.error(`❌ [Cron] خطأ في معالجة التنبيه ${alert.id}:`, error.message);
        failCount++;
      }
    }

    console.log('✅ [Cron] انتهى فحص الأسعار');
    console.log(`📊 النتائج: نجح ${successCount} | فشل ${failCount} | تنبيهات مرسلة ${notificationsSent}`);

  } catch (error) {
    console.error('❌ [Cron] خطأ عام:', error);
    throw error;
  }
}

// معالجة تنبيه واحد
async function processAlert(alert) {
  const route = `${alert.from_city}-${alert.to_city}`;
  
  console.log(`🔄 [${alert.id}] فحص: ${route} في ${alert.travel_date}`);

  try {
    const priceData = await AmadeusService.getFlightPrice(
      alert.from_city,
      alert.to_city,
      alert.travel_date
    );

    if (!priceData) {
      console.log(`⚠️ [${alert.id}] لم يتم العثور على رحلات`);
      return { success: false };
    }

    await Price.save(
      route,
      alert.travel_date,
      priceData.price,
      priceData.airline
    );

    console.log(`💰 [${alert.id}] السعر الحالي: ${priceData.price} ريال`);

    const analysis = await analyzePriceChange(alert, priceData.price);

    if (analysis) {
      await sendPriceAlert({
        userId: alert.user_id,
        userName: alert.name,
        userPhone: alert.phone,
        route: route,
        fromCity: alert.from_city,
        toCity: alert.to_city,
        travelDate: alert.travel_date,
        price: priceData.price,
        airline: priceData.airline,
        recommendation: analysis
      });

      console.log(`✅ [${alert.id}] تم إرسال تنبيه`);
      return { success: true, notificationSent: true };
    }

    console.log(`ℹ️ [${alert.id}] لا حاجة لإرسال تنبيه`);
    return { success: true, notificationSent: false };

  } catch (error) {
    console.error(`❌ [${alert.id}] خطأ:`, error.message);
    return { success: false };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scheduleTask, checkAllPrices };
