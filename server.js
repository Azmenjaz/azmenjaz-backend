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
const AmadeusService = require('./services/amadeusService');
const priceHistoryService = require('./services/priceHistoryService');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins
}));
app.use(express.json());

// Serving static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/admin', adminRoutes);

// Serve the React Portal (Make sure to run 'npm run build' in frontend/portal first)
app.use('/portal', express.static(path.join(__dirname, '../frontend/dist/portal')));

// Handle React Portal routing - return index.html for all /portal/* routes
app.get('/portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/portal/index.html'));
});

scheduleTask();

// Health check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown' },
      amadeus: { status: 'unknown' },
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

  // Check Amadeus
  try {
    const amadeusResult = await AmadeusService.testConnection();
    health.services.amadeus.status = amadeusResult.success ? 'connected' : 'error';
    if (!amadeusResult.success) health.services.amadeus.error = amadeusResult.error;
  } catch (err) {
    health.services.amadeus.status = 'error';
    health.services.amadeus.error = err.message;
  }

  // Check WhatsApp (Ultramsg)
  if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
    health.services.whatsapp.status = 'configured';
  } else {
    health.services.whatsapp.status = 'not_configured (test mode)';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Test Amadeus (kept for compatibility)
app.get('/api/test-amadeus', async (req, res) => {
  try {
    console.log('Testing Amadeus API...');
    const result = await AmadeusService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search flights
app.post('/api/flights/search', async (req, res) => {
  try {
    const { originCode, destinationCode, departureDate, returnDate, travelClass } = req.body;

    if (!originCode || !destinationCode || !departureDate) {
      return res.status(400).json({ success: false, error: 'Missing data' });
    }

    const result = await AmadeusService.searchFlights(
      originCode,
      destinationCode,
      departureDate,
      returnDate,
      travelClass
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    const flights = result.flights.map(flight => ({
      ...flight,
      bookingLink: AmadeusService.getBookingLink(flight.airlineCode)
    }));

    res.json({
      success: true,
      flights: flights,
      count: flights.length
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm Price
app.post('/api/flights/confirm-price', async (req, res) => {
  try {
    const { flightOffer } = req.body;
    if (!flightOffer) {
      return res.status(400).json({ success: false, error: 'Missing flight offer' });
    }

    const result = await AmadeusService.confirmPrice(flightOffer);
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create Order (Book)
app.post('/api/flights/book', async (req, res) => {
  try {
    const { flightOffer, travelers } = req.body;
    if (!flightOffer || !travelers) {
      return res.status(400).json({ success: false, error: 'Missing flight offer or travelers data' });
    }

    const result = await AmadeusService.createOrder(flightOffer, travelers);
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get price
app.post('/api/flights/price', async (req, res) => {
  try {
    const { originCode, destinationCode, departureDate } = req.body;

    if (!originCode || !destinationCode || !departureDate) {
      return res.status(400).json({ success: false, error: 'Missing data' });
    }

    const price = await AmadeusService.getFlightPrice(originCode, destinationCode, departureDate);

    if (!price) {
      return res.json({ success: false, error: 'No flights found' });
    }

    res.json({ success: true, price: price });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Inspiration Search Endpoint
app.get('/api/flights/inspiration', async (req, res) => {
  const { origin } = req.query;
  if (!origin) {
    return res.status(400).json({ success: false, error: 'Origin is required' });
  }

  try {
    const result = await AmadeusService.getCheapestDestinations(origin);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search locations/cities
app.get('/api/locations/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'Keyword is required' });
    const result = await AmadeusService.searchCities(keyword);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get airport performance
app.get('/api/airports/performance', async (req, res) => {
  try {
    const { airportCode } = req.query;
    if (!airportCode) return res.status(400).json({ success: false, error: 'Airport code is required' });
    const result = await AmadeusService.getAirportPerformance(airportCode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
