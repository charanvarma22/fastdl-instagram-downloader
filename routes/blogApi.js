// ============================================
// BLOG PUBLISHING API ENDPOINTS (WordPress Compatible)
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

// Admin protection for sensitive routes
const adminRoutes = ['/publish', '/sitemap/update', '/stats'];
router.use((req, res, next) => {
  if (adminRoutes.some(path => req.path.startsWith(path))) {
    return authenticateAPIKey(req, res, next);
  }
  next();
});

// ============================================
// ENDPOINT: Get All Published Blogs (WP Format)
// GET /api/blog/posts
// ============================================
router.get('/posts', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [blogs] = await connection.query(`
      SELECT 
        blog_id as id, title, slug, excerpt, content, category, 
        keyword, created_at as date, published_at, view_count
      FROM blogs 
      WHERE status = 'published' 
      ORDER BY published_at DESC
    `);

    connection.release();

    // Transform to WordPress REST API Format for Frontend Compatibility
    const wpFormatBlogs = blogs.map(blog => ({
      id: blog.id,
      date: blog.date,
      slug: blog.slug,
      status: 'publish',
      title: { rendered: blog.title },
      content: { rendered: blog.content },
      excerpt: { rendered: blog.excerpt || '' },
      author: 1,
      _embedded: {
        'wp:featuredmedia': [{
          source_url: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80'
        }],
        'author': [{ name: 'Admin' }]
      }
    }));

    res.status(200).json(wpFormatBlogs);
  } catch (error) {
    console.error('Fetch blogs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blog posts' });
  }
});

// ============================================
// ENDPOINT: Get Single Blog (WP Format)
// GET /api/blog/post/:slug
// ============================================
router.get('/post/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const connection = await pool.getConnection();

    const [blogs] = await connection.query(
      'SELECT * FROM blogs WHERE slug = ? AND status = "published"',
      [slug]
    );

    if (blogs.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    const blog = blogs[0];

    // Update view count
    await connection.query(
      'UPDATE blogs SET view_count = view_count + 1 WHERE blog_id = ?',
      [blog.blog_id]
    );

    connection.release();

    // Map to WP Format
    res.status(200).json({
      id: blog.blog_id,
      date: blog.created_at,
      slug: blog.slug,
      title: { rendered: blog.title },
      content: { rendered: blog.content },
      excerpt: { rendered: blog.excerpt || '' }
    });
  } catch (error) {
    console.error('Fetch single blog error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blog post' });
  }
});

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

    if (!title || !slug || !content) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const [existing] = await connection.query('SELECT blog_id FROM blogs WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Slug exists' });
    }

    const htmlContent = DOMPurify.sanitize(marked.parse(content));
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO blogs (
        title, slug, content, html_content, excerpt, 
        meta_title, meta_description, keyword, category, 
        author_id, status, view_count, created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())`,
      [title, slug, content, htmlContent, excerpt, meta_title || title, meta_description || excerpt, keyword, category, author_id, status]
    );

    await connection.commit();
    res.status(201).json({ success: true, data: { blog_id: result.insertId, slug } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// ENDPOINTS Mirroring (Sitemap, Stats, Health)
// ============================================
router.get('/sitemap/update', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [blogs] = await connection.query("SELECT slug, updated_at, created_at FROM blogs WHERE status = 'published'");
    connection.release();
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${blogs.map(b => `<url><loc>${process.env.SITE_URL}/blog/${b.slug}</loc></url>`).join('')}</urlset>`;
    await fs.writeFile(path.join(__dirname, '../public/sitemap.xml'), sitemap);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [stats] = await connection.query("SELECT COUNT(*) as total_blogs, SUM(view_count) as total_views FROM blogs WHERE status = 'published'");
    connection.release();
    res.json({ success: true, data: stats[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ status: 'healthy' });
  } catch (e) { res.status(503).json({ status: 'unhealthy', error: e.message }); }
});

module.exports = router;
