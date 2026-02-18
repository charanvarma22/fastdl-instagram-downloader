# n8n SEO Blog Automation System - Quick Start

🚀 **Automated SEO Blog Publishing for Instaminsta**

## 📦 What's Included

1. **n8n-workflow-seo-blog-automation.json** - Complete n8n workflow (import this)
2. **node-api-endpoints.js** - Blog publishing API routes
3. **server.js** - Main Node.js server
4. **database-schema.sql** - Complete database schema
5. **package.json** - Node.js dependencies
6. **.env.example** - Environment configuration template
7. **n8n-SEO-Blog-Automation-Setup-Guide.docx** - Full documentation

## ⚡ Quick Setup (5 Minutes)

### 1. Database Setup
```bash
mysql -u root -p instaminsta_db < database-schema.sql
```

### 2. API Installation
```bash
cd /var/www/instaminsta/api
npm install
cp .env.example .env
# Edit .env with your credentials
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # Generate API key
npm start
```

### 3. Import n8n Workflow
1. Open n8n (usually port 5678)
2. Click **⋮** → **Import from File**
3. Upload `n8n-workflow-seo-blog-automation.json`
4. Configure credentials:
   - MySQL (database connection)
   - OpenAI API
   - Blog API Key (Header Auth)
   - Copyleaks API
5. Activate workflow (toggle switch)

## 🔑 Required API Keys

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Copyleaks**: https://copyleaks.com/ (or use alternative)
3. **Blog API Key**: Generate with crypto (see step 2 above)

## 📊 How It Works

**Daily Automation Flow:**
1. ⏰ Cron triggers at random time (8-10 AM)
2. 🔍 Fetches unused keyword from database
3. ✅ Checks daily limit (max 3 posts)
4. 🤖 GPT-4o generates 1200-1800 word blog
5. 👤 GPT-4o Mini humanizes content
6. 📝 Copyleaks checks plagiarism (<10%)
7. 🔗 Inserts 3-5 internal links automatically
8. 📤 Publishes via secure API
9. 🗺️ Updates sitemap.xml
10. 📋 Logs success/failure

## 🎯 Features

✅ Fully automated (1-3 posts/day)
✅ 100% original content (plagiarism checked)
✅ SEO optimized (meta tags, internal links)
✅ Natural tone (no AI clichés)
✅ Auto sitemap updates
✅ Comprehensive error handling
✅ Production-ready security

## 🛠️ API Endpoints

```bash
# Publish blog (used by n8n)
POST /api/blog/publish

# Update sitemap
GET /api/sitemap/update

# Get statistics
GET /api/blog/stats

# Health check
GET /api/blog/health
```

## 📈 Monitoring

```bash
# Check API health
curl https://instaminsta.com/api/blog/health

# View stats
curl -H "x-api-key: YOUR_KEY" https://instaminsta.com/api/blog/stats

# Check today's posts
mysql> SELECT COUNT(*) FROM blogs WHERE DATE(created_at) = CURDATE();

# View recent logs
mysql> SELECT * FROM blog_publish_log ORDER BY created_at DESC LIMIT 10;
```

## ⚙️ Configuration

Edit `.env` file:

```env
# Critical settings
BLOG_API_KEY=your_secure_key_here
OPENAI_API_KEY=sk-proj-xxxxx
COPYLEAKS_API_KEY=your_key
DB_USER=your_user
DB_PASSWORD=your_password

# Limits
MAX_POSTS_PER_DAY=3
MIN_WORD_COUNT=1200
MAX_WORD_COUNT=1800
PLAGIARISM_THRESHOLD=10
```

## 🔧 Troubleshooting

**Workflow not running?**
- Ensure workflow is Active (toggle in n8n)
- Check n8n service: `sudo systemctl status n8n`

**API errors?**
- Verify API key matches in n8n and .env
- Check server: `pm2 status`
- Test: `curl http://localhost:3000/health`

**High plagiarism?**
- Increase AI temperature (0.85 → 0.9)
- Add more specific instructions in prompts

**Database issues?**
- Test connection: `mysql -u user -p database`
- Check credentials in .env

## 🔐 Security Checklist

✅ Use HTTPS in production
✅ Keep .env out of Git
✅ Generate strong API keys (64+ chars)
✅ Enable rate limiting
✅ Regular backups
✅ Update dependencies: `npm audit fix`

## 📚 Sample Keywords

Already included in database schema:
- how to grow instagram followers organically
- best time to post on instagram 2024
- instagram reels ideas for business
- instagram hashtag strategy
- how to create viral instagram content

Add more keywords:
```sql
INSERT INTO seo_keywords (keyword, category, priority, status) 
VALUES ('your keyword here', 'Category', 8, 'pending');
```

## 🚀 Production Deployment

Using PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name instaminsta-api
pm2 save
pm2 startup
```

## 📧 Need Help?

Check the full documentation:
**n8n-SEO-Blog-Automation-Setup-Guide.docx**

---

**Created for Instaminsta • Version 1.0 • 2025**
