require('dotenv').config();
const express = require('express');
const connect = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const paperRoutes = require('./routes/papers');
const reviewRoutes = require('./routes/reviews');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - allow frontend at localhost:3000 (change for production)
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// Basic rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200
});
app.use(limiter);

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/reviews', reviewRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => {
    console.error('Failed to start', err);
    process.exit(1);
  });
