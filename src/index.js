require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
const { initSocket } = require('./socket');

// Route imports
const authRoutes = require('./routes/auth');
const referralRoutes = require('./routes/referral');
const walletRoutes = require('./routes/wallet');
const withdrawalRoutes = require('./routes/withdrawal');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
const server = createServer(app);
initSocket(server);
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware to track API hits
app.use((req, res, next) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log('Payload:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/deposit', require('./routes/deposit'));
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'SharingApp Backend', version: '1.0.0' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invite Landing Page
// ─────────────────────────────────────────────────────────────────────────────
app.get('/invite/:code', (req, res) => {
  try {
    const code = req.params.code || '';
    const htmlPath = path.join(__dirname, '../public/invite.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('{{REFERRAL_CODE}}', code);
    res.send(html);
  } catch (err) {
    res.status(500).send('Error loading invite page.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_URL = 'mongodb+srv://Deepak:1234@cluster0.zi0obep.mongodb.net/sharingapp'

// 'mongodb://127.0.0.1:27017/sharingapp'
mongoose.connect(SERVER_URL)
  .then(() => console.log('📦 MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

server.listen(PORT, () => {
  console.log(`\n🚀 SharingApp Server & Sockets running on http://localhost:${PORT}`);
  console.log('📋 Available API Routes:');
  console.log(`   POST   /api/auth/register`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/referral/my-code`);
  console.log(`   POST   /api/referral/apply`);
  console.log(`   GET    /api/referral/history`);
  console.log(`   GET    /api/referral/stats`);
  console.log(`   GET    /api/wallet`);
  console.log(`   GET    /api/wallet/balance`);
  console.log(`   POST   /api/withdrawal/request`);
  console.log(`   GET    /api/withdrawal/history`);
  console.log(`   GET    /api/withdrawal/status/:id`);
  console.log(`   GET    /api/payment/details`);
  console.log(`   POST   /api/payment/upi`);
  console.log(`   POST   /api/payment/bank`);
  console.log(`   GET    /api/admin/users`);
  console.log(`   POST   /api/admin/credit`);
  console.log(`   GET    /health\n`);
});

module.exports = { app, server };
