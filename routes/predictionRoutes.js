/**
 * Routes لخوارزمية التنبؤ
 */

const express = require('express')
const router = express.Router()
const priceService = require('../services/priceHistoryService')

// توقع السعر
router.get('/price', async (req, res) => {
  try {
    const { origin, destination, currentPrice, departureDate } = req.query

    if (!origin || !destination || !currentPrice || !departureDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      })
    }

    const prediction = await priceService.predictPrice(
      origin,
      destination,
      parseFloat(currentPrice),
      departureDate
    )

    res.json({
      success: true,
      data: prediction
    })
  } catch (error) {
    console.error('Error predicting price:', error)
    res.status(500).json({
      success: false,
      message: 'Error predicting price'
    })
  }
})

// إضافة سعر
router.post('/add-price', async (req, res) => {
  try {
    const { origin, destination, price, date, airline } = req.body

    if (!origin || !destination || !price) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      })
    }

    const success = await priceService.addPrice(
      origin,
      destination,
      parseFloat(price),
      date || new Date().toISOString().split('T')[0],
      airline
    )

    res.json({
      success: success,
      message: success ? 'Price added successfully' : 'Error adding price'
    })
  } catch (error) {
    console.error('Error adding price:', error)
    res.status(500).json({
      success: false,
      message: 'Error adding price'
    })
  }
})

// الإحصائيات
router.get('/statistics', async (req, res) => {
  try {
    const { origin, destination, travelDate } = req.query

    if (!origin || !destination || !travelDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters (origin, destination, travelDate)'
      })
    }

    const stats = await priceService.getRouteStatistics(origin, destination, travelDate)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error getting statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Error getting statistics'
    })
  }
})

// أرخص وقت
router.get('/cheapest-time', (req, res) => {
  try {
    const { origin, destination } = req.query

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      })
    }

    const cheapest = priceService.getCheapestTime(origin, destination)

    res.json({
      success: true,
      data: cheapest
    })
  } catch (error) {
    console.error('Error getting cheapest time:', error)
    res.status(500).json({
      success: false,
      message: 'Error getting cheapest time'
    })
  }
})

// أغلى وقت
router.get('/expensive-time', (req, res) => {
  try {
    const { origin, destination } = req.query

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      })
    }

    const expensive = priceService.getExpensiveTime(origin, destination)

    res.json({
      success: true,
      data: expensive
    })
  } catch (error) {
    console.error('Error getting expensive time:', error)
    res.status(500).json({
      success: false,
      message: 'Error getting expensive time'
    })
  }
})

module.exports = router
