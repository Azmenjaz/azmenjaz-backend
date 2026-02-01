const adminRoutes = require('./routes/adminRoutes');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
const alertRoutes = require('./routes/alertRoutes');

app.get('/test-amadeus', async (req, res) => {
  try {
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: 'RUH',
      destinationLocationCode: 'JED',
      departureDate: '2026-02-15',
      adults: '1'
    });
    
    res.json({ success: true, flights: response.data.length });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.message,
      description: error.description
    });
  }
});

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


