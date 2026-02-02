/**
 * خدمة معالجة البيانات التاريخية
 * Price History Service
 */

const PricePredictionAlgorithm = require('./pricePredictionAlgorithm')

class PriceHistoryService {
  constructor() {
    this.algorithm = new PricePredictionAlgorithm()
    this.routeData = new Map()
  }

  // إنشاء معرف المسار
  createRouteId(origin, destination) {
    return `${origin}-${destination}`.toUpperCase()
  }

  // إضافة سعر
  addPrice(origin, destination, price, date = new Date().toISOString().split('T')[0]) {
    const routeId = this.createRouteId(origin, destination)
    this.algorithm.addHistoricalPrice(routeId, price, date)
    this.updateRouteData(routeId, origin, destination)
  }

  // تحديث بيانات المسار
  updateRouteData(routeId, origin, destination) {
    const history = this.algorithm.priceHistory.get(routeId) || []
    const prices = history.map(h => h.price)

    if (prices.length === 0) return

    const routeData = {
      origin,
      destination,
      routeId,
      lastUpdated: new Date().toISOString(),
      priceHistory: history,
      averagePrice: this.calculateAverage(prices),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices)
    }

    this.routeData.set(routeId, routeData)
  }

  calculateAverage(prices) {
    if (prices.length === 0) return 0
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  }

  // الحصول على إحصائيات المسار
  getRouteStatistics(origin, destination) {
    const routeId = this.createRouteId(origin, destination)
    const history = this.algorithm.priceHistory.get(routeId) || []

    if (history.length === 0) {
      return {
        routeId,
        dataPoints: 0,
        message: 'لا توجد بيانات'
      }
    }

    const prices = history.map(h => h.price)
    const avg = this.calculateAverage(prices)
    const stdDev = this.calculateStandardDeviation(prices)

    return {
      routeId,
      dataPoints: history.length,
      averagePrice: avg,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      standardDeviation: Math.round(stdDev),
      volatility: Math.round((stdDev / avg) * 100),
      priceRange: `${Math.min(...prices)} - ${Math.max(...prices)}`,
      lastUpdated: history[history.length - 1].date
    }
  }

  calculateStandardDeviation(prices) {
    const avg = this.calculateAverage(prices)
    const squaredDiffs = prices.map(p => Math.pow(p - avg, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length
    return Math.sqrt(variance)
  }

  // أرخص وقت
  getCheapestTime(origin, destination) {
    const routeId = this.createRouteId(origin, destination)
    const history = this.algorithm.priceHistory.get(routeId) || []

    if (history.length === 0) return null

    const cheapest = history.reduce((prev, current) =>
      prev.price < current.price ? prev : current
    )

    return {
      date: cheapest.date,
      price: cheapest.price
    }
  }

  // أغلى وقت
  getExpensiveTime(origin, destination) {
    const routeId = this.createRouteId(origin, destination)
    const history = this.algorithm.priceHistory.get(routeId) || []

    if (history.length === 0) return null

    const expensive = history.reduce((prev, current) =>
      prev.price > current.price ? prev : current
    )

    return {
      date: expensive.date,
      price: expensive.price
    }
  }

  // التنبؤ
  predictPrice(origin, destination, currentPrice, departureDate) {
    const routeId = this.createRouteId(origin, destination)
    return this.algorithm.predictPrice(routeId, currentPrice, departureDate)
  }
}

module.exports = new PriceHistoryService()
