const Price = require('../models/Price');
const priceService = require('../services/priceHistoryService');

async function analyzePriceChange(alert, currentPrice) {
  const origin = alert.from_city;
  const destination = alert.to_city;
  const travelDate = alert.travel_date;

  try {
    // استخدام الخوارزمية المطورة للتحليل
    const analysis = await priceService.predictPrice(origin, destination, currentPrice, travelDate);

    console.log(`📊 تحليل ${origin}-${destination}: الحالي=${currentPrice} المتوقع=${analysis.predictedPrice} التوصية=${analysis.recommendation}`);

    // السعر المستهدف له أولوية
    if (alert.target_price && currentPrice <= alert.target_price) {
      return {
        action: 'target_reached',
        urgency: 'high',
        message: `🎯 وصلنا للسعر المستهدف! الآن ${currentPrice} ريال. احجز فوراً!`
      };
    }

    // بناء قرار التنبيه بناءً على توصية الخوارزمية
    if (analysis.recommendation === 'BUY_NOW') {
      let statusMsg = `✨ السعر الآن ${currentPrice} ريال. `;
      if (analysis.analysis.isAtSupport) {
        statusMsg += "هذا السعر في أدنى مستوياته التاريخية!";
      } else {
        statusMsg += `تتوقع الخوارزمية ارتفاع السعر إلى ${analysis.predictedPrice} ريال قريباً.`;
      }

      return {
        action: 'book_now',
        urgency: analysis.confidence > 70 ? 'high' : 'medium',
        message: statusMsg
      };
    }

    // تنبيه خاص بالانخفاض الكبير حتى لو لم تكن التوصية هي الشراء (مثلاً للانتظار أكثر)
    if (analysis.priceChangePercent < -15) {
      return {
        action: 'price_drop',
        urgency: 'medium',
        message: `📉 انخفاض ملحوظ! السعر حالياً ${currentPrice} ريال. قد ينخفض أكثر، لكن السعر الحالي جيد.`
      };
    }

    return false;

  } catch (error) {
    console.error('❌ خطأ في تحليل السعر:', error);
    return false;
  }
}

module.exports = { analyzePriceChange };
