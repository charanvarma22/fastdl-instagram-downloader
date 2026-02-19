// ============================================
// BLOG PUBLISHING API ENDPOINTS
// File: routes/blogApi.js
// ============================================

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { marked } = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const fs = require('fs').promises;
const path = require('path');

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ============================================
// MIDDLEWARE: API Key Authentication
// ============================================
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'API key required' 
    });
  }
  
  if (apiKey !== process.env.BLOG_API_KEY) {
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid API key' 
    });
  }
  
  next();
};

// Apply authentication to all routes
router.use(authenticateAPIKey);

// ============================================
// ENDPOINT: Publish New Blog
// POST /api/blog/publish
// ============================================
router.post('/publish', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      meta_title,
      meta_description,
      keyword,
      category,
      author_id = 1,
      status = 'published'
    } = req.body;

    // Validation
    if (!title || !slug || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, slug, content'
      });
    }

    // Check if slug already exists
    const [existing] = await connection.query(
      'SELECT blog_id FROM blogs WHERE slug = ?',
      [slug]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Blog with this slug already exists'
      });
    }

    // Convert markdown to HTML and sanitize
    const htmlContent = DOMPurify.sanitize(marked.parse(content));

    // Start transaction
    await connection.beginTransaction();

    // Insert blog post
    const [result] = await connection.query(
      `INSERT INTO blogs (
        title, slug, content, html_content, excerpt, 
        meta_title, meta_description, keyword, category, 
        author_id, status, view_count, created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())`,
      [
        title,
        slug,
        content,
        htmlContent,
        excerpt,
        meta_title || title,
        meta_description || excerpt,
        keyword,
        category,
        author_id,
        status
      ]
    );

    const blogId = result.insertId;

    // Commit transaction
    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Blog published successfully',
      data: {
        blog_id: blogId,
        slug: slug,
        url: `/blog/${slug}`
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Blog publish error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to publish blog',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ENDPOINT: Update Sitemap
// GET /api/sitemap/update
// ============================================
router.get('/sitemap/update', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Fetch all published blogs
    const [blogs] = await connection.query(
      `SELECT slug, updated_at, created_at 
       FROM blogs 
       WHERE status = 'published' 
       ORDER BY created_at DESC`
    );

    connection.release();

    // Generate sitemap XML
    const sitemap = generateSitemapXML(blogs);

    // Write sitemap to public directory
    const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    await fs.writeFile(sitemapPath, sitemap, 'utf8');

    // Ping Google Search Console (optional)
    await pingSearchEngines();

    res.status(200).json({
      success: true,
      message: 'Sitemap updated successfully',
      blogs_count: blogs.length,
      sitemap_url: '/sitemap.xml'
    });

  } catch (error) {
    console.error('Sitemap update error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to update sitemap',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// HELPER: Generate Sitemap XML
// ============================================
function generateSitemapXML(blogs) {
  const baseUrl = process.env.SITE_URL || 'https://instaminsta.com';
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // Homepage
  xml += '  <url>\n';
  xml += `    <loc>${baseUrl}/</loc>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>1.0</priority>\n';
  xml += '  </url>\n';
  
  // Blog listing page
  xml += '  <url>\n';
  xml += `    <loc>${baseUrl}/blog</loc>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>0.9</priority>\n';
  xml += '  </url>\n';
  
  // Individual blog posts
  blogs.forEach(blog => {
    const lastmod = (blog.updated_at || blog.created_at).toISOString().split('T')[0];
    
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/blog/${blog.slug}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  });
  
  xml += '</urlset>';
  
  return xml;
}

// ============================================
// HELPER: Ping Search Engines
// ============================================
async function pingSearchEngines() {
  const sitemapUrl = encodeURIComponent(`${process.env.SITE_URL}/sitemap.xml`);
  
  const pingUrls = [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`
  ];

  for (const url of pingUrls) {
    try {
      await fetch(url);
    } catch (error) {
      console.error(`Failed to ping: ${url}`, error.message);
    }
  }
}

// ============================================
// ENDPOINT: Get Blog Statistics
// GET /api/blog/stats
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [stats] = await connection.query(`
      SELECT 
        COUNT(*) as total_blogs,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(created_at) >= CURDATE() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as week_count,
        SUM(view_count) as total_views,
        AVG(view_count) as avg_views_per_blog
      FROM blogs 
      WHERE status = 'published'
    `);

    connection.release();

    res.status(200).json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// ============================================
// ENDPOINT: Health Check
// GET /api/blog/health
// ============================================
router.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;

// ============================================
// USAGE IN MAIN APP (app.js or server.js)
// ============================================
/*
const express = require('express');
const blogApiRoutes = require('./routes/blogApi');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount blog API routes
app.use('/api/blog', blogApiRoutes);
app.use('/api/sitemap', blogApiRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/
