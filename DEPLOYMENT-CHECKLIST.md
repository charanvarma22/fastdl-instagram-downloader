# Production Deployment Checklist

## Pre-Deployment Checklist

### ✅ System Requirements
- [ ] Hostinger VPS running Ubuntu 20.04+ or similar
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] MySQL/MariaDB installed and running
- [ ] n8n installed and accessible
- [ ] Domain name configured (instaminsta.com)
- [ ] SSL certificate installed (Let's Encrypt recommended)

### ✅ API Keys & Credentials
- [ ] OpenAI API key obtained (https://platform.openai.com/api-keys)
- [ ] Copyleaks API key obtained (or alternative)
- [ ] Generated secure Blog API key (64+ characters)
- [ ] Database credentials ready
- [ ] All credentials stored in .env file
- [ ] .env file added to .gitignore (if using Git)

### ✅ Database Setup
- [ ] database-schema.sql executed successfully
- [ ] All tables created (blogs, seo_keywords, etc.)
- [ ] Sample keywords inserted
- [ ] Database user has proper permissions
- [ ] Database connection tested from API

### ✅ Node.js API
- [ ] Dependencies installed (`npm install`)
- [ ] .env file configured correctly
- [ ] Server starts without errors (`npm start`)
- [ ] Health endpoint responds (`curl localhost:3000/health`)
- [ ] All routes accessible
- [ ] PM2 configured for auto-restart

### ✅ n8n Workflow
- [ ] Workflow imported successfully
- [ ] All credentials configured:
  - [ ] MySQL connection
  - [ ] OpenAI API
  - [ ] Blog API key (Header Auth)
  - [ ] Copyleaks API
- [ ] Test execution runs successfully
- [ ] Workflow activated (toggle on)
- [ ] Cron schedule verified

---

## Security Hardening

### 🔐 Essential Security Steps
- [ ] HTTPS enabled (SSL certificate installed)
- [ ] Firewall configured (UFW or iptables)
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw allow 5678/tcp  # n8n (restrict by IP if possible)
  sudo ufw enable
  ```
- [ ] Rate limiting enabled in .env (`ENABLE_RATE_LIMIT=true`)
- [ ] API key authentication working
- [ ] Database user has minimal required permissions
- [ ] SSH key-based authentication (disable password login)
- [ ] Regular security updates enabled
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

### 🔒 API Security
- [ ] CORS properly configured (only allow your domain)
- [ ] Helmet.js security headers active
- [ ] Request size limits set (10mb default)
- [ ] API endpoints require authentication
- [ ] No sensitive data in logs
- [ ] Error messages don't expose system info (production mode)

### 🛡️ Database Security
- [ ] MySQL root access restricted to localhost
- [ ] Application database user has limited privileges
- [ ] Regular backups configured (see Backup section)
- [ ] SQL injection protection (using parameterized queries)

---

## Testing Phase

### 🧪 System Tests
- [ ] Manual workflow execution (test in n8n)
- [ ] Check keyword fetch works
- [ ] Verify AI content generation
- [ ] Test plagiarism check
- [ ] Confirm internal linking works
- [ ] API publish endpoint tested
- [ ] Sitemap update verified
- [ ] Database logging confirmed

### 📊 Performance Tests
- [ ] API response time < 200ms (health endpoint)
- [ ] Blog generation completes in < 2 minutes
- [ ] Database queries optimized (use EXPLAIN)
- [ ] No memory leaks (`pm2 monit`)
- [ ] CPU usage acceptable under load

### 🔍 Quality Tests
- [ ] Generated content meets word count (1200-1800)
- [ ] Plagiarism scores < 10%
- [ ] Internal links inserted correctly
- [ ] Meta tags generated properly
- [ ] Sitemap.xml validates (use online validator)
- [ ] Content sounds natural (human review)

---

## Go-Live Steps

### 1. Final Configuration
```bash
# Set production environment
NODE_ENV=production

# Set proper site URL
SITE_URL=https://instaminsta.com

# Enable rate limiting
ENABLE_RATE_LIMIT=true

# Set logging level
LOG_LEVEL=warn
```

### 2. Start Services with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start API server
pm2 start server.js --name instaminsta-api

# Save PM2 process list
pm2 save

# Configure auto-start on reboot
pm2 startup

# Monitor
pm2 monit
```

### 3. Configure Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name instaminsta.com www.instaminsta.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name instaminsta.com www.instaminsta.com;

    ssl_certificate /etc/letsencrypt/live/instaminsta.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/instaminsta.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        # Your main website
        proxy_pass http://localhost:8080;
    }
}
```

### 4. Verify n8n is Running
```bash
sudo systemctl status n8n
# OR if using PM2
pm2 list | grep n8n
```

### 5. Activate Workflow
- [ ] Login to n8n dashboard
- [ ] Verify workflow is Active
- [ ] Check execution history is empty (fresh start)

### 6. Submit Sitemap to Google
```bash
# Ping Google manually (first time)
curl "https://www.google.com/ping?sitemap=https://instaminsta.com/sitemap.xml"

# Verify in Google Search Console
# - Add sitemap.xml
# - Request indexing
```

---

## Monitoring Setup

### 📈 Daily Monitoring Tasks

**Manual Checks (First Week):**
- [ ] Check n8n execution history daily
- [ ] Review blog_publish_log table
- [ ] Verify published content quality
- [ ] Monitor plagiarism scores
- [ ] Check sitemap updates

**API Monitoring:**
```bash
# Health check
curl https://instaminsta.com/api/blog/health

# Get statistics
curl -H "x-api-key: YOUR_KEY" https://instaminsta.com/api/blog/stats

# Check PM2 status
pm2 status
pm2 logs instaminsta-api --lines 50
```

**Database Monitoring:**
```sql
-- Posts published today
SELECT COUNT(*) FROM blogs WHERE DATE(created_at) = CURDATE();

-- Recent activity
SELECT * FROM blog_publish_log ORDER BY created_at DESC LIMIT 10;

-- Keyword usage
SELECT COUNT(*) as used FROM seo_keywords WHERE used = 1;
SELECT COUNT(*) as remaining FROM seo_keywords WHERE used = 0;

-- Average plagiarism score
SELECT AVG(plagiarism_score) FROM blog_publish_log WHERE plagiarism_score IS NOT NULL;
```

### 🚨 Set Up Alerts (Optional but Recommended)

**Option 1: Email Alerts via n8n**
Add email notification nodes to workflow for:
- Failed plagiarism checks
- API publish failures
- Daily summary reports

**Option 2: Uptime Monitoring**
Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake

Monitor these URLs:
- https://instaminsta.com/api/blog/health
- https://instaminsta.com/sitemap.xml

---

## Backup Configuration

### 💾 Database Backups

**Daily Automated Backup:**
```bash
# Create backup script
sudo nano /usr/local/bin/backup-instaminsta-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/instaminsta"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u your_user -p'your_password' instaminsta_db > $BACKUP_DIR/db_backup_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-instaminsta-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /usr/local/bin/backup-instaminsta-db.sh >> /var/log/backup-instaminsta.log 2>&1
```

**Test Backup:**
```bash
# Run backup manually
sudo /usr/local/bin/backup-instaminsta-db.sh

# Verify backup file created
ls -lh /backups/instaminsta/
```

---

## Post-Launch Monitoring

### Week 1 Checklist
- [ ] Day 1: Verify first automated post published
- [ ] Day 2: Check plagiarism scores acceptable
- [ ] Day 3: Verify internal links working
- [ ] Day 4: Check sitemap updates
- [ ] Day 5: Review content quality
- [ ] Day 6: Monitor server resources
- [ ] Day 7: Weekly summary review

### Metrics to Track
```sql
-- Create analytics view
CREATE VIEW weekly_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as posts_published,
    AVG(view_count) as avg_views,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_attempts
FROM blog_publish_log
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View weekly stats
SELECT * FROM weekly_stats;
```

### Performance Benchmarks
- **Content Generation:** < 90 seconds
- **API Response:** < 200ms
- **Plagiarism Check:** < 10 seconds
- **Daily Posts:** 1-3 (as configured)
- **Plagiarism Rate:** < 10% average
- **Failed Publishes:** < 5% of attempts

---

## Scaling Preparation

### When to Scale Up

**Indicators:**
- Consistent 3 posts/day for 30+ days
- Low plagiarism scores (<5% average)
- High engagement on published content
- Keyword list running low

**Scaling Actions:**
1. Increase daily limit to 5 posts
2. Add more keywords to database
3. Create category-specific workflows
4. Implement image generation
5. Add social media auto-posting
6. Set up CDN for static assets

---

## Emergency Procedures

### 🚨 What to Do If...

**Workflow Stops Running:**
```bash
1. Check n8n service: sudo systemctl status n8n
2. Check API health: curl localhost:3000/health
3. Review n8n execution history for errors
4. Check database connection
5. Restart if needed: pm2 restart instaminsta-api
```

**High Plagiarism Scores:**
```bash
1. Review recent posts in database
2. Check OpenAI temperature setting
3. Temporarily increase threshold in workflow
4. Review AI prompts for specificity
5. Consider alternative AI model
```

**API Not Responding:**
```bash
1. Check PM2 status: pm2 status
2. Review logs: pm2 logs instaminsta-api
3. Check server resources: htop
4. Restart API: pm2 restart instaminsta-api
5. Check Nginx config if using reverse proxy
```

**Database Connection Lost:**
```bash
1. Check MySQL status: sudo systemctl status mysql
2. Review database logs: sudo tail -f /var/log/mysql/error.log
3. Test connection: mysql -u user -p
4. Check connection pool settings
5. Restart MySQL if necessary: sudo systemctl restart mysql
```

---

## Maintenance Schedule

### Daily (Automated)
- ✅ Blog publishing (via n8n)
- ✅ Database backup (via cron)
- ✅ Log rotation

### Weekly (Manual)
- 📊 Review publishing statistics
- 🔍 Quality check on published content
- 📈 Monitor keyword usage
- 🔧 Check for npm updates

### Monthly (Manual)
- 🔄 Update Node.js packages (`npm update`)
- 🔐 Rotate API keys (best practice)
- 📦 Review disk space usage
- 🧹 Clean old logs
- 📊 Performance review

---

## Success Criteria

### ✅ System is Production-Ready When:
- [ ] 7+ days of successful automated publishing
- [ ] Zero critical errors in logs
- [ ] Plagiarism scores consistently < 10%
- [ ] All published content meets quality standards
- [ ] Sitemap updates automatically
- [ ] Backups running successfully
- [ ] Monitoring in place
- [ ] Team trained on basic troubleshooting

---

## Support Contacts

**Technical Issues:**
- n8n Community: https://community.n8n.io/
- OpenAI Support: https://help.openai.com/
- Hostinger Support: Via hosting panel

**Emergency Checklist:**
```bash
# Quick health check
curl https://instaminsta.com/api/blog/health
pm2 status
sudo systemctl status n8n
mysql -e "SELECT COUNT(*) FROM instaminsta_db.blogs WHERE DATE(created_at) = CURDATE();"
```

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Go-Live Approved:** _______________

✅ Ready for Production!
