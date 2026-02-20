// ============================================
// INSTAMINSTA BLOG API SERVER
// File: server.js
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const winston = require('winston');
const path = require('path');

// Import routes
const blogApiRoutes = require('./routes/blogApi');

// ============================================
// INITIALIZE EXPRESS APP
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// LOGGER CONFIGURATION
// ============================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
};

if (process.env.ENABLE_CORS === 'true') {
  app.use(cors(corsOptions));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

if (process.env.ENABLE_RATE_LIMIT === 'true') {
  app.use('/api/', limiter);
}

// ============================================
// GENERAL MIDDLEWARE
// ============================================

// Compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Static files
app.use(express.static('public'));

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/blog', blogApiRoutes);
app.use('/api/sitemap', blogApiRoutes);

// ============================================
// PROXY: Forward Downloader requests to Port 3001
// ============================================
const http = require('http');

const forwardToDownloader = (req, res) => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('Downloader Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Instagram service is offline. Please ensure the backend is running on port 3001.' });
    }
  });
};

// Mount proxy for specific routes
app.all('/api/preview', forwardToDownloader);
app.all('/api/download', forwardToDownloader);
app.all('/resolve', forwardToDownloader);

// Sitemap.xml serving
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Robots.txt serving
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: ${process.env.SITE_URL}/sitemap.xml`);
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, () => {
  logger.info(`
╔════════════════════════════════════════════╗
║   INSTAMINSTA BLOG API SERVER STARTED     ║
╠════════════════════════════════════════════╣
║  Environment: ${process.env.NODE_ENV?.padEnd(29)} ║
║  Port:        ${PORT.toString().padEnd(29)} ║
║  URL:         ${process.env.SITE_URL?.padEnd(29)} ║
║  Time:        ${new Date().toISOString().padEnd(29)} ║
╚════════════════════════════════════════════╝
  `);

  logger.info('API Endpoints:');
  logger.info('  POST /api/blog/publish');
  logger.info('  GET  /api/sitemap/update');
  logger.info('  GET  /api/blog/stats');
  logger.info('  GET  /api/blog/health');
  logger.info('  GET  /health');
  logger.info('  GET  /sitemap.xml');
  logger.info('  GET  /robots.txt');
});

module.exports = app;
