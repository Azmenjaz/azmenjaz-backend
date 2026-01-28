const Price = require('../models/Price');

async function analyzePriceChange(alert, currentPrice) {
  const route = `${alert.from_city}-${alert.to_city}`;

  try {
    const priceHistory = await Price.getHistory(route, alert.travel_date, 10);

    if (priceHistory.length < 3) {
      console.log(`ℹ️ بيانات تاريخية غير كافية للمسار ${route}`);
      return false;
    }

    const avgPrice = priceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / priceHistory.length;
    const minPrice = Math.min(...priceHistory.map(p => parseFloat(p.price)));

    console.log(`📊 تحليل ${route}: الحالي=${currentPrice} المتوسط=${avgPrice.toFixed(2)} الأقل=${minPrice}`);

    // السعر انخفض 15%+
    if (currentPrice <= avgPrice * 0.85) {
      const percentageDrop = Math.round(((avgPrice - currentPrice) / avgPrice) * 100);
      return {
        action: 'book_now',
        urgency: 'high',
        message: `🔥 السعر انخفض إلى ${currentPrice} ريال! أقل بـ ${percentageDrop}% من المتوسط. احجز الآن!`
      };
    }

    // قريب من أقل سعر
    if (currentPrice <= minPrice * 1.05) {
      return {
        action: 'book_now',
        urgency: 'high',
        message: `✨ السعر الآن ${currentPrice} ريال - قريب من أفضل سعر! فرصة ممتازة!`
      };
    }

    // السعر مرتفع
    if (currentPrice >= avgPrice * 1.25) {
      return {
        action: 'wait',
        urgency: 'low',
        message: `⏳ السعر حالياً ${currentPrice} ريال - أعلى من المعتاد. ننصح بالانتظار.`
      };
    }

    // السعر المستهدف
    if (alert.target_price && currentPrice <= alert.target_price) {
      return {
        action: 'target_reached',
        urgency: 'high',
        message: `🎯 وصلنا للسعر المستهدف! الآن ${currentPrice} ريال`
      };
    }

    return false;

  } catch (error) {
    console.error('❌ خطأ في تحليل السعر:', error);
    return false;
  }
}

module.exports = { analyzePriceChange };
