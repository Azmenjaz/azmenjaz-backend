/**
 * خوارزمية توقع أسعار الرحلات
 * Price Prediction Algorithm
 */

class PricePredictionAlgorithm {
  constructor() {
    this.priceHistory = new Map()
    this.DAYS_TO_PREDICT = 7
    this.MIN_DATA_POINTS = 3
  }

  // إضافة سعر تاريخي
  addHistoricalPrice(routeId, price, date) {
    if (!this.priceHistory.has(routeId)) {
      this.priceHistory.set(routeId, [])
    }

    const history = this.priceHistory.get(routeId)
    history.push({
      date,
      price,
      timestamp: new Date(date).getTime()
    })

    history.sort((a, b) => a.timestamp - b.timestamp)
  }

  // حساب المتوسط
  calculateAveragePrice(prices) {
    if (prices.length === 0) return 0
    return prices.reduce((a, b) => a + b, 0) / prices.length
  }

  // حساب الانحراف المعياري
  calculateStandardDeviation(prices) {
    const avg = this.calculateAveragePrice(prices)
    const squaredDiffs = prices.map(price => Math.pow(price - avg, 2))
    const variance = this.calculateAveragePrice(squaredDiffs)
    return Math.sqrt(variance)
  }

  // تحليل الاتجاه
  analyzeTrend(prices) {
    if (prices.length < 2) return 0

    let upDays = 0
    let downDays = 0

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) upDays++
      else if (prices[i] < prices[i - 1]) downDays++
    }

    const total = upDays + downDays
    return total === 0 ? 0 : (upDays - downDays) / total
  }

  // عامل الموسمية
  calculateSeasonalityFactor(departureDate) {
    const date = new Date(departureDate)
    const dayOfWeek = date.getDay()
    const dayOfMonth = date.getDate()

    // الجمعة والسبت أغلى
    if (dayOfWeek === 5 || dayOfWeek === 6) return 1.15

    // منتصف الشهر أرخص
    if (dayOfMonth >= 15 && dayOfMonth <= 20) return 0.95

    // بداية الشهر أغلى
    if (dayOfMonth >= 1 && dayOfMonth <= 5) return 1.08

    return 1.0
  }

  // عامل الطلب
  calculateDemandFactor(daysUntilDeparture) {
    if (daysUntilDeparture <= 3) return 1.25
    if (daysUntilDeparture <= 7) return 1.15
    if (daysUntilDeparture <= 14) return 1.08
    if (daysUntilDeparture <= 30) return 1.0
    if (daysUntilDeparture <= 60) return 0.95
    return 0.90
  }

  // Linear Regression
  linearRegression(prices) {
    if (prices.length < 2) return prices[prices.length - 1] || 0

    const n = prices.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = prices

    const xMean = x.reduce((a, b) => a + b) / n
    const yMean = y.reduce((a, b) => a + b) / n

    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean)
      denominator += Math.pow(x[i] - xMean, 2)
    }

    const slope = denominator === 0 ? 0 : numerator / denominator
    const intercept = yMean - slope * xMean

    const nextDayPrice = slope * n + intercept
    return Math.max(nextDayPrice, prices[prices.length - 1] * 0.8)
  }

  // الخوارزمية الرئيسية
  predictPrice(routeId, currentPrice, departureDate) {
    const history = this.priceHistory.get(routeId) || []
    const prices = history.map(h => h.price)

    const today = new Date()
    const departure = new Date(departureDate)
    const daysUntilDeparture = Math.ceil(
      (departure.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    // بيانات محدودة
    if (prices.length < this.MIN_DATA_POINTS) {
      const seasonalityFactor = this.calculateSeasonalityFactor(departureDate)
      const demandFactor = this.calculateDemandFactor(daysUntilDeparture)
      const predictedPrice = currentPrice * seasonalityFactor * demandFactor

      return {
        currentPrice,
        predictedPrice: Math.round(predictedPrice),
        priceChange: Math.round(predictedPrice - currentPrice),
        priceChangePercent: Math.round(((predictedPrice - currentPrice) / currentPrice) * 100 * 100) / 100,
        recommendation: 'WAIT',
        confidence: 40,
        riskLevel: 'MEDIUM',
        bestDayToBuy: 'غير متأكد - بيانات محدودة',
        factors: {
          trendFactor: 0,
          seasonalityFactor: Math.round(seasonalityFactor * 100) / 100,
          demandFactor: Math.round(demandFactor * 100) / 100,
          daysUntilDeparture
        }
      }
    }

    // حساب العوامل
    const trendFactor = this.analyzeTrend(prices)
    const seasonalityFactor = this.calculateSeasonalityFactor(departureDate)
    const demandFactor = this.calculateDemandFactor(daysUntilDeparture)

    // التنبؤ
    let predictedBasePrice = this.linearRegression(prices)
    let predictedPrice = predictedBasePrice * seasonalityFactor * demandFactor

    if (trendFactor > 0.3) {
      predictedPrice *= 1 + trendFactor * 0.1
    } else if (trendFactor < -0.3) {
      predictedPrice *= 1 + trendFactor * 0.1
    }

    // حساب الثقة
    const priceStdDev = this.calculateStandardDeviation(prices)
    const avgPrice = this.calculateAveragePrice(prices)
    const volatility = priceStdDev / avgPrice
    const confidence = Math.max(0, Math.min(100, 100 - volatility * 100))

    // حساب التغيير
    const priceChange = predictedPrice - currentPrice
    const priceChangePercent = (priceChange / currentPrice) * 100

    // مستوى الخطر
    let riskLevel = 'LOW'
    if (Math.abs(priceChangePercent) > 15 && daysUntilDeparture < 7) {
      riskLevel = 'HIGH'
    } else if (Math.abs(priceChangePercent) > 10 || daysUntilDeparture < 3) {
      riskLevel = 'MEDIUM'
    }

    // التوصية
    let recommendation = 'WAIT'
    if (priceChangePercent > 10 && confidence > 60) {
      recommendation = 'BUY_NOW'
    } else if (daysUntilDeparture <= 2) {
      recommendation = 'BUY_NOW'
    } else if (priceChangePercent < -5 && confidence > 60 && daysUntilDeparture > 5) {
      recommendation = 'WAIT'
    } else if (confidence < 50) {
      recommendation = 'RISKY'
    }

    return {
      currentPrice,
      predictedPrice: Math.round(predictedPrice),
      priceChange: Math.round(priceChange),
      priceChangePercent: Math.round(priceChangePercent * 100) / 100,
      recommendation,
      confidence: Math.round(confidence),
      riskLevel,
      bestDayToBuy: this.calculateBestDayToBuy(currentPrice, predictedPrice, daysUntilDeparture),
      factors: {
        trendFactor: Math.round(trendFactor * 100) / 100,
        seasonalityFactor: Math.round(seasonalityFactor * 100) / 100,
        demandFactor: Math.round(demandFactor * 100) / 100,
        daysUntilDeparture
      }
    }
  }

  calculateBestDayToBuy(currentPrice, predictedPrice, daysUntilDeparture) {
    const priceChangePercent = ((predictedPrice - currentPrice) / currentPrice) * 100

    if (priceChangePercent > 10) {
      return 'اليوم (السعر الحالي جيد)'
    }

    if (priceChangePercent < -5 && daysUntilDeparture > 7) {
      return `خلال ${Math.ceil(daysUntilDeparture / 2)} أيام`
    }

    if (daysUntilDeparture > 30) {
      return 'خلال 2-3 أسابيع'
    }

    return 'في أقرب وقت'
  }
}

module.exports = PricePredictionAlgorithm
