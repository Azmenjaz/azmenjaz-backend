const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { scheduleTask } = require('./cron/priceChecker');
const userRoutes = require('./routes/userRoutes');
const alertRoutes = require('./routes/alertRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const corporateRoutes = require('./routes/corporateRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tpRoutes = require('./routes/travelpayoutsRoutes');
const contactRoutes = require('./routes/contactRoutes');
const duffelRoutes = require('./routes/duffelRoutes');
// const AmadeusService = require('./services/amadeusService'); // Amadeus disabled for now
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins
}));
app.use(express.json());

// ⚠️ IMPORTANT: API routes MUST come BEFORE static files!
// Otherwise, 404 responses will serve HTML from static folder

// Routes
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tp', tpRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/duffel', duffelRoutes);

// Health check (before static)
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown' },
      amadeus: { status: 'disabled' },
      whatsapp: { status: 'unknown' }
    }
  };

  // Check Database
  try {
    const pool = require('./config/database');
    await pool.query('SELECT 1');
    health.services.database.status = 'connected';
  } catch (err) {
    health.status = 'error';
    health.services.database.status = 'disconnected';
    health.services.database.error = err.message;
  }

  // Check WhatsApp (Ultramsg)
  if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
    health.services.whatsapp.status = 'configured';
  } else {
    health.services.whatsapp.status = 'not_configured (test mode)';
  }

  res.json(health);
});

// Serving static frontend files (AFTER all API routes!)
app.use(express.static(path.join(__dirname, '../Frontend/public_html')));

scheduleTask();

// Amadeus endpoints disabled (placeholder responses)
app.get('/api/test-amadeus', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus is temporarily disabled on this environment.'
  });
});

app.post('/api/flights/search', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus flight search is temporarily disabled.'
  });
});

app.post('/api/flights/confirm-price', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus confirm price is temporarily disabled.'
  });
});

app.post('/api/flights/book', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus booking is temporarily disabled.'
  });
});

app.post('/api/flights/price', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus pricing is temporarily disabled.'
  });
});

app.get('/api/flights/inspiration', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus inspiration is temporarily disabled.'
  });
});

app.get('/api/locations/search', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus locations search is temporarily disabled.'
  });
});

app.get('/api/airports/performance', (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Amadeus airport performance is temporarily disabled.'
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
