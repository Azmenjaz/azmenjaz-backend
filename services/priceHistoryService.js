/**
 * خدمة معالجة البيانات التاريخية المطورة
 * Enhanced Price History Service
 */

const PricePredictionAlgorithm = require('./pricePredictionAlgorithm')
const Price = require('../models/Price')

class PriceHistoryService {
  constructor() {
    this.algorithm = new PricePredictionAlgorithm()
    this.routeData = new Map()
    this.hydratedRoutes = new Set()
  }

  // إنشاء معرف المسار
  createRouteId(origin, destination) {
    return `${origin}-${destination}`.toUpperCase()
  }

  // استعادة البيانات من قاعدة البيانات (Hydration)
  async hydrateRoute(origin, destination, travelDate) {
    const routeId = this.createRouteId(origin, destination)
    const hydrationKey = `${routeId}-${travelDate}`

    if (this.hydratedRoutes.has(hydrationKey)) return

    try {
      console.log(`🚰 Hydrating history for ${hydrationKey}...`)
      const history = await Price.getHistory(routeId, travelDate, 30)

      if (history && history.length > 0) {
        // إضافة البيانات بترتيب زمني (من الأقدم للأحدث)
        history.reverse().forEach(record => {
          this.algorithm.addHistoricalPrice(
            routeId,
            parseFloat(record.price),
            record.recorded_at || record.travel_date
          )
        })
        console.log(`✅ Hydrated ${history.length} points for ${hydrationKey}`)
      }

      this.hydratedRoutes.add(hydrationKey)
    } catch (error) {
      console.error(`❌ Hydration error for ${hydrationKey}:`, error.message)
    }
  }

  // إضافة سعر وحفظه في قاعدة البيانات
  async addPrice(origin, destination, price, travelDate, airline = null) {
    const routeId = this.createRouteId(origin, destination)

    try {
      // 1. الحفظ في قاعدة البيانات
      await Price.save(routeId, travelDate, price, airline)

      // 2. تحديث الخوارزمية في الذاكرة
      this.algorithm.addHistoricalPrice(routeId, price, new Date().toISOString())

      // 3. تحديث الإحصائيات
      this.updateRouteData(routeId, origin, destination)

      return true
    } catch (error) {
      console.error('❌ Error adding price:', error.message)
      return false
    }
  }

  // تحديث بيانات المسار في الذاكرة لفترة قصيرة
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

  // الحصول على إحصائيات المسار مع ضمان التحميل من القاعدة
  async getRouteStatistics(origin, destination, travelDate) {
    await this.hydrateRoute(origin, destination, travelDate)

    const routeId = this.createRouteId(origin, destination)
    const history = this.algorithm.priceHistory.get(routeId) || []

    if (history.length === 0) {
      return {
        routeId,
        dataPoints: 0,
        message: 'لا توجد بيانات كافية'
      }
    }

    const prices = history.map(h => h.price)
    const avg = this.calculateAverage(prices)

    // استخدام الخوارزمية لحساب الانحراف المعياري
    const stdDev = this.algorithm.calculateStandardDeviation(prices, avg)

    return {
      routeId,
      travelDate,
      dataPoints: history.length,
      averagePrice: avg,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      standardDeviation: Math.round(stdDev),
      volatility: Math.round((stdDev / avg) * 100) || 0,
      priceRange: `${Math.min(...prices)} - ${Math.max(...prices)}`,
      lastUpdated: history[history.length - 1].date
    }
  }

  // الحصول على أرخص وقت
  async getCheapestTime(origin, destination, travelDate) {
    await this.hydrateRoute(origin, destination, travelDate)
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

  // التنبؤ مع ضمان تحميل البيانات التاريخية
  async predictPrice(origin, destination, currentPrice, travelDate) {
    // التأكد من استعادة التاريخ قبل التنبؤ
    await this.hydrateRoute(origin, destination, travelDate)

    const routeId = this.createRouteId(origin, destination)
    return this.algorithm.predictPrice(routeId, currentPrice, travelDate)
  }
}

module.exports = new PriceHistoryService()
