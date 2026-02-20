// ============================================
// INSTAMINSTA UNIFIED SERVER (Blog + Downloader)
// File: server.js
// ============================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}


// Import Custom Routes & Logic
import blogApiRoutes from "./routes/blogApi.js";
import * as resolverModule from "./resolver.js";
import { fetchMediaByShortcode, fetchStoryByUrl } from "./igApi.js";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001; // Port 3001 required for Downloader

// ============================================
// LOGGER CONFIGURATION
// ============================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
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
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  ]
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet({
  contentSecurityPolicy: false, // Required if serving frontend from same domain
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan("dev"));

// ============================================
// BLOG API ROUTES
// ============================================
app.use("/api/blog", blogApiRoutes);
app.use("/api/sitemap", blogApiRoutes); // Legacy support for sitemap update

// ============================================
// INSTAGRAM DOWNLOADER ROUTES
// ============================================
const resolver = resolverModule.default || resolverModule.resolveUrl;

// Preview Endpoint (Reels / Posts / Stories)
app.post("/api/preview", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Handle Stories
    if (url.includes("/stories/")) {
      const story = await fetchStoryByUrl(url);
      return res.json({
        type: story.type === "video" ? "video" : "image",
        items: [{ id: 0, type: story.type, thumbnail: story.thumbnail || story.url, mediaUrl: story.url, shortcode: null }],
        shortcode: null
      });
    }

    // Handle Posts/Reels/IGTV
    const match = url.match(/\/(reel|p|tv)\/([^/?]+)/);
    if (!match) return res.status(400).json({ error: "Invalid Instagram URL" });

    const shortcode = match[2];
    logger.info(`📸 Fetching preview for: ${shortcode}`);

    const media = await fetchMediaByShortcode(shortcode);

    // Carousel
    if (media.carousel_media?.length > 0) {
      const items = media.carousel_media.map((item, idx) => ({
        id: idx,
        type: item.type || (item.video_versions?.[0] ? "video" : "image"),
        thumbnail: item.image_versions2?.candidates?.[0]?.url,
        mediaUrl: item.video_versions?.[0]?.url || item.image_versions2?.candidates?.[0]?.url,
        shortcode
      }));
      return res.json({ type: "carousel", items, shortcode });
    }

    // Single Video
    if (media.type === "video" || media.video_versions?.[0]) {
      return res.json({
        type: "video",
        items: [{
          id: 0,
          type: "video",
          thumbnail: media.image_versions2?.candidates?.[0]?.url || (media.type === 'image' ? media.video_versions?.[0]?.url : null),
          mediaUrl: media.video_versions?.[0]?.url || media.image_versions2?.candidates?.[0]?.url,
          shortcode
        }],
        shortcode
      });
    }

    // Single Image
    if (media.type === "image" || media.image_versions2?.candidates?.[0]) {
      const imgUrl = media.image_versions2?.candidates?.[0]?.url || media.video_versions?.[0]?.url;
      return res.json({
        type: "image",
        items: [{ id: 0, type: "image", thumbnail: imgUrl, mediaUrl: imgUrl, shortcode }],
        shortcode
      });
    }

    throw new Error("No media found in response");
  } catch (err) {
    logger.error(`Preview error: ${err.message}`);
    res.status(500).json({ error: err.message || "Failed to fetch media" });
  }
});

// Download / Resolve Endpoint
app.post("/resolve", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !resolver) return res.status(400).json({ error: "Invalid request" });
    await resolver(url, res);
  } catch (err) {
    logger.error(`Resolve error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Frontend Individual Item Download
app.post("/api/download", async (req, res) => {
  try {
    const { url, itemIndex } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    if (itemIndex !== undefined && itemIndex !== null) {
      const match = url.match(/\/(reel|p|tv)\/([^/?]+)/);
      if (match) {
        const media = await fetchMediaByShortcode(match[2]);
        if (media.carousel_media?.[itemIndex]) {
          const item = media.carousel_media[itemIndex];
          const mediaUrl = item.video_versions?.[0]?.url || item.image_versions2?.candidates?.[0]?.url;
          const isVideo = item.type === "video" || item.video_versions?.[0];

          if (mediaUrl) {
            const { default: axios } = await import("axios");
            const response = await axios.get(mediaUrl, {
              responseType: "stream",
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.instagram.com/",
                "Accept": "*/*"
              },
              timeout: 30000
            });
            res.setHeader("Content-Disposition", `attachment; filename=media_${itemIndex}.${isVideo ? 'mp4' : 'jpg'}`);
            return response.data.pipe(res);
          }
        }
      }
    }

    // Default to full resolver
    await resolver(url, res);
  } catch (err) {
    logger.error(`Download error: ${err.message}`);
    res.status(500).json({ error: "Download failed" });
  }
});

// ============================================
// STATIC ASSETS
// ============================================
app.get("/sitemap.xml", (req, res) => res.sendFile(path.join(__dirname, "public", "sitemap.xml")));
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${process.env.SITE_URL}/sitemap.xml`);
});
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ============================================
// GLOBAL ERROR HANDLER (Ensures JSON responses)
// ============================================
app.use((err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});


// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  logger.info(`
🚀 UNIFIED SERVER STARTED
---------------------------
Port:    ${PORT}
Mode:    ${process.env.NODE_ENV || 'development'}
Blog:    /api/blog
Downloader: /api/preview
  `);
});

export default app;
