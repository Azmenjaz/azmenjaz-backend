const adminRoutes = require('./routes/adminRoutes');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const AmadeusService = require('./services/amadeusService');
const userRoutes = require('./routes/userRoutes');
const alertRoutes = require('./routes/alertRoutes');
app.post('/api/flights/search', async (req, res) => {

// ⭐ إضافة Cron Job
const { scheduleTask } = require('./cron/priceChecker');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['https://azmenjaz.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/admin', adminRoutes);

// Health check
  // Test Amadeus connection
app.get('/api/test-amadeus', async (req, res) => {
  try {
    console.log('🔍 Testing Amadeus API...');
    console.log('📌 CLIENT_ID:', process.env.AMADEUS_CLIENT_ID ? '✅ موجود' : '❌ مفقود');
    console.log('📌 CLIENT_SECRET:', process.env.AMADEUS_CLIENT_SECRET ? '✅ موجود' : '❌ مفقود');

    const result = await AmadeusService.testConnection();
    
    res.json(result);
  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Search flights
app.post('/api/flights/search', async (req, res) => {
  try {
    const { originCode, destinationCode, departureDate } = req.body;

    console.log('🔍 Flight search request:', { originCode, destinationCode, departureDate });

    // التحقق من البيانات المدخلة
    if (!originCode || !destinationCode || !departureDate) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال جميع البيانات المطلوبة'
      });
    }

    // التحقق من أكواد المدن
    const validCities = ['RUH', 'JED', 'DMM', 'AHB', 'TIF', 'MED'];
    if (!validCities.includes(originCode) || !validCities.includes(destinationCode)) {
      return res.status(400).json({
        success: false,
        error: 'كود المدينة غير صحيح'
      });
    }

    // التحقق من أن المدينتين مختلفتين
    if (originCode === destinationCode) {
      return res.status(400).json({
        success: false,
        error: 'يجب اختيار مدينتين مختلفتين'
      });
    }

    // التحقق من التاريخ
    const searchDate = new Date(departureDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (searchDate < today) {
      return res.status(400).json({
        success: false,
        error: 'التاريخ يجب أن يكون في المستقبل'
      });
    }

    // البحث عن الرحلات
    const result = await AmadeusService.searchFlights(
      originCode, 
      destinationCode, 
      departureDate
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    // إضافة روابط الحجز
    const flights = result.flights.map(flight => ({
      ...flight,
      bookingLink: AmadeusService.getBookingLink(flight.airlineCode)
    }));

    console.log('✅ Search successful:', flights.length, 'flights found');

    res.json({
      success: true,
      flights: flights,
      count: flights.length,
      searchParams: {
        from: originCode,
        to: destinationCode,
        date: departureDate
      }
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      error: 'حدث خطأ في البحث عن الرحلات',
      details: error.message
    });
  }
});

// Get price for specific flight (for cron jobs)
app.post('/api/flights/price', async (req, res) => {
  try {
    const { originCode, destinationCode, departureDate } = req.body;

    if (!originCode || !destinationCode || !departureDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const price = await AmadeusService.getFlightPrice(
      originCode,
      destinationCode,
      departureDate
    );

    if (!price) {
      return res.json({
        success: false,
        error: 'No flights found'
      });
    }

    res.json({
      success: true,
      price: price
    });

  } catch (error) {
    console.error('❌ Price check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
  
app.get('/', (req, res) => {
  res.json({ 
    message: 'Azmenjaz API Running ✅',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ⭐ تفعيل Cron Job
scheduleTask();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Cron job activated`);
});





