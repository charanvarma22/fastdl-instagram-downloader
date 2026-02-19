-- ============================================
-- SEO BLOG AUTOMATION DATABASE SCHEMA
-- Database: instaminsta_db
-- ============================================

-- ============================================
-- TABLE: blogs
-- Stores all published blog posts
-- ============================================
CREATE TABLE IF NOT EXISTS `blogs` (
  `blog_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `content` LONGTEXT NOT NULL COMMENT 'Original markdown content',
  `html_content` LONGTEXT NOT NULL COMMENT 'Converted HTML content',
  `excerpt` TEXT,
  `meta_title` VARCHAR(60),
  `meta_description` VARCHAR(160),
  `keyword` VARCHAR(255),
  `category` VARCHAR(100),
  `author_id` INT UNSIGNED DEFAULT 1,
  `status` ENUM('draft', 'published', 'archived') DEFAULT 'published',
  `view_count` INT UNSIGNED DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `published_at` TIMESTAMP NULL,
  INDEX idx_slug (`slug`),
  INDEX idx_keyword (`keyword`),
  INDEX idx_category (`category`),
  INDEX idx_status (`status`),
  INDEX idx_published_at (`published_at`),
  INDEX idx_created_at (`created_at`),
  FULLTEXT idx_fulltext (`title`, `content`, `excerpt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: seo_keywords
-- Stores keywords for blog generation
-- ============================================
CREATE TABLE IF NOT EXISTS `seo_keywords` (
  `keyword_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `keyword` VARCHAR(255) NOT NULL UNIQUE,
  `category` VARCHAR(100),
  `search_volume` INT UNSIGNED DEFAULT 0 COMMENT 'Monthly search volume',
  `difficulty` TINYINT UNSIGNED DEFAULT 0 COMMENT 'SEO difficulty 0-100',
  `priority` TINYINT UNSIGNED DEFAULT 5 COMMENT 'Priority 1-10, higher = more important',
  `status` ENUM('pending', 'active', 'paused') DEFAULT 'pending',
  `used` TINYINT(1) DEFAULT 0,
  `used_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_used (`status`, `used`),
  INDEX idx_priority (`priority`),
  INDEX idx_category (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: blog_publish_log
-- Logs all publish attempts (success & failures)
-- ============================================
CREATE TABLE IF NOT EXISTS `blog_publish_log` (
  `log_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `keyword` VARCHAR(255),
  `slug` VARCHAR(255),
  `status` ENUM('success', 'failed') NOT NULL,
  `error_message` TEXT,
  `plagiarism_score` DECIMAL(5,2) DEFAULT NULL,
  `word_count` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (`status`),
  INDEX idx_created_at (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: internal_links
-- Tracks internal linking between blog posts
-- ============================================
CREATE TABLE IF NOT EXISTS `internal_links` (
  `link_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `source_blog_id` INT UNSIGNED NOT NULL,
  `target_blog_id` INT UNSIGNED NOT NULL,
  `anchor_text` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`source_blog_id`) REFERENCES `blogs`(`blog_id`) ON DELETE CASCADE,
  FOREIGN KEY (`target_blog_id`) REFERENCES `blogs`(`blog_id`) ON DELETE CASCADE,
  INDEX idx_source (`source_blog_id`),
  INDEX idx_target (`target_blog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: blog_analytics
-- Daily analytics for each blog post
-- ============================================
CREATE TABLE IF NOT EXISTS `blog_analytics` (
  `analytics_id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `blog_id` INT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  `views` INT UNSIGNED DEFAULT 0,
  `unique_visitors` INT UNSIGNED DEFAULT 0,
  `avg_time_on_page` INT UNSIGNED DEFAULT 0 COMMENT 'Seconds',
  `bounce_rate` DECIMAL(5,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`blog_id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_blog_date` (`blog_id`, `date`),
  INDEX idx_date (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SAMPLE DATA: SEO Keywords
-- Add your initial keywords here
-- ============================================
INSERT INTO `seo_keywords` (`keyword`, `category`, `search_volume`, `difficulty`, `priority`, `status`) VALUES
('how to grow instagram followers organically', 'Instagram Growth', 5400, 45, 9, 'pending'),
('best time to post on instagram 2024', 'Instagram Tips', 8900, 52, 8, 'pending'),
('instagram reels ideas for business', 'Content Strategy', 3200, 38, 7, 'pending'),
('instagram hashtag strategy', 'Engagement', 6700, 48, 8, 'pending'),
('how to create viral instagram content', 'Content Creation', 4100, 55, 9, 'pending'),
('instagram algorithm explained', 'Platform Updates', 7200, 50, 7, 'pending'),
('instagram marketing tips for beginners', 'Marketing', 5800, 42, 8, 'pending'),
('how to increase instagram engagement', 'Engagement', 9100, 47, 9, 'pending'),
('instagram story templates', 'Design', 2900, 35, 6, 'pending'),
('instagram analytics guide', 'Analytics', 3400, 40, 7, 'pending');

-- ============================================
-- STORED PROCEDURE: Get Daily Publish Count
-- ============================================
DELIMITER //
CREATE PROCEDURE GetDailyPublishCount()
BEGIN
    SELECT COUNT(*) as count 
    FROM blogs 
    WHERE DATE(created_at) = CURDATE() 
    AND status = 'published';
END //
DELIMITER ;

-- ============================================
-- STORED PROCEDURE: Get Next Keyword
-- Returns highest priority unused keyword
-- ============================================
DELIMITER //
CREATE PROCEDURE GetNextKeyword()
BEGIN
    SELECT keyword_id, keyword, category 
    FROM seo_keywords 
    WHERE status = 'pending' 
    AND used = 0 
    ORDER BY priority DESC, RAND() 
    LIMIT 1;
END //
DELIMITER ;

-- ============================================
-- TRIGGER: Update blog updated_at on content change
-- ============================================
DELIMITER //
CREATE TRIGGER before_blog_update
BEFORE UPDATE ON blogs
FOR EACH ROW
BEGIN
    IF NEW.content != OLD.content THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;

-- ============================================
-- VIEW: Blog Performance Summary
-- ============================================
CREATE OR REPLACE VIEW blog_performance AS
SELECT 
    b.blog_id,
    b.title,
    b.slug,
    b.keyword,
    b.category,
    b.view_count,
    b.created_at,
    b.published_at,
    COUNT(il.link_id) as internal_links_count,
    DATEDIFF(CURDATE(), DATE(b.published_at)) as days_since_published
FROM blogs b
LEFT JOIN internal_links il ON b.blog_id = il.source_blog_id
WHERE b.status = 'published'
GROUP BY b.blog_id
ORDER BY b.created_at DESC;

-- ============================================
-- VIEW: Publishing Statistics
-- ============================================
CREATE OR REPLACE VIEW publishing_stats AS
SELECT 
    DATE(created_at) as publish_date,
    COUNT(*) as posts_published,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    AVG(plagiarism_score) as avg_plagiarism_score,
    AVG(word_count) as avg_word_count
FROM blog_publish_log
GROUP BY DATE(created_at)
ORDER BY publish_date DESC;

-- ============================================
-- INDEXES FOR OPTIMIZATION
-- ============================================
ALTER TABLE blogs ADD INDEX idx_status_published_at (status, published_at);
ALTER TABLE seo_keywords ADD INDEX idx_composite (status, used, priority);

-- ============================================
-- GRANTS (Optional - adjust username/password)
-- ============================================
-- CREATE USER 'n8n_user'@'localhost' IDENTIFIED BY 'your_secure_password';
-- GRANT SELECT, INSERT, UPDATE ON instaminsta_db.* TO 'n8n_user'@'localhost';
-- FLUSH PRIVILEGES;

-- ============================================
-- CLEANUP QUERIES (Use when needed)
-- ============================================

-- Reset all keywords to unused (for testing)
-- UPDATE seo_keywords SET used = 0, used_at = NULL WHERE used = 1;

-- Delete failed publish logs older than 30 days
-- DELETE FROM blog_publish_log WHERE status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Archive old blogs (optional)
-- UPDATE blogs SET status = 'archived' WHERE published_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
