const Price = require('../../models/Price');

/**
 * تحليل تغيير السعر وتحديد ما إذا كان يجب إرسال تنبيه
 */
async function analyzePriceChange(alert, currentPrice) {
  const route = `${alert.from_city}-${alert.to_city}`;

  try {
    // جلب آخر 10 أسعار مسجلة
    const priceHistory = await Price.getHistory(route, alert.travel_date, 10);

    if (priceHistory.length < 3) {
      // بيانات غير كافية للتحليل
      console.log(`ℹ️ بيانات تاريخية غير كافية للمسار ${route}`);
      return false;
    }

    // حساب المتوسط
    const avgPrice = priceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / priceHistory.length;

    // حساب أقل سعر وأعلى سعر
    const minPrice = Math.min(...priceHistory.map(p => parseFloat(p.price)));
    const maxPrice = Math.max(...priceHistory.map(p => parseFloat(p.price)));

    // حساب الأيام المتبقية للسفر
    const daysUntilTravel = getDaysUntil(alert.travel_date);

    console.log(`📊 تحليل المسار ${route}:`);
    console.log(`   - السعر الحالي: ${currentPrice} ريال`);
    console.log(`   - المتوسط: ${avgPrice.toFixed(2)} ريال`);
    console.log(`   - أقل سعر: ${minPrice} ريال`);
    console.log(`   - أعلى سعر: ${maxPrice} ريال`);
    console.log(`   - أيام متبقية: ${daysUntilTravel}`);

    // ===== منطق التحليل =====

    // سيناريو 1: السعر انخفض بشكل كبير (15%+ عن المتوسط)
    if (currentPrice <= avgPrice * 0.85) {
      const percentageDrop = Math.round(((avgPrice - currentPrice) / avgPrice) * 100);
      return {
        action: 'book_now',
        urgency: 'high',
        message: `🔥 السعر انخفض إلى ${currentPrice} ريال!\nأقل بـ ${percentageDrop}% من المتوسط.\nننصح بالحجز فوراً!`
      };
    }

    // سيناريو 2: السعر قريب جداً من أقل سعر تاريخي
    if (currentPrice <= minPrice * 1.05) {
      return {
        action: 'book_now',
        urgency: 'high',
        message: `✨ السعر الآن ${currentPrice} ريال\nقريب من أفضل سعر سجلناه (${minPrice} ريال)!\nفرصة ممتازة للحجز!`
      };
    }

    // سيناريو 3: السعر جيد + موعد السفر قريب (أقل من 7 أيام)
    if (daysUntilTravel <= 7 && currentPrice <= avgPrice * 1.1) {
      return {
        action: 'book_soon',
        urgency: 'medium',
        message: `⏰ السفر قريب (${daysUntilTravel} يوم)!\nالسعر الآن ${currentPrice} ريال - معقول.\nننصح بالحجز قريباً قبل ارتفاع السعر.`
      };
    }

    // سيناريو 4: السعر انخفض بشكل ملحوظ (10-15%)
    if (currentPrice <= avgPrice * 0.90) {
      const percentageDrop = Math.round(((avgPrice - currentPrice) / avgPrice) * 100);
      return {
        action: 'good_price',
        urgency: 'medium',
        message: `👍 السعر انخفض إلى ${currentPrice} ريال\nأقل بـ ${percentageDrop}% من المتوسط.\nسعر جيد للحجز!`
      };
    }

    // سيناريو 5: السعر مرتفع جداً - انتظر
    if (currentPrice >= avgPrice * 1.25) {
      return {
        action: 'wait',
        urgency: 'low',
        message: `⏳ السعر حالياً ${currentPrice} ريال\nأعلى بـ ${Math.round(((currentPrice - avgPrice) / avgPrice) * 100)}% من المتوسط.\nننصح بالانتظار.`
      };
    }

    // سيناريو 6: التحقق من السعر المستهدف (إذا حدده المستخدم)
    if (alert.target_price && currentPrice <= alert.target_price) {
      return {
        action: 'target_reached',
        urgency: 'high',
        message: `🎯 وصلنا للسعر المستهدف!\nالسعر الآن ${currentPrice} ريال\n(هدفك كان ${alert.target_price} ريال)`
      };
    }

    // لا حاجة لإرسال تنبيه
    return false;

  } catch (error) {
    console.error('❌ خطأ في تحليل السعر:', error);
    return false;
  }
}

/**
 * حساب عدد الأيام المتبقية حتى تاريخ السفر
 */
function getDaysUntil(travelDate) {
  const today = new Date();
  const travel = new Date(travelDate);
  const diffTime = travel - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

module.exports = { analyzePriceChange };
