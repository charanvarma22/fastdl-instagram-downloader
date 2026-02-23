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
    logger.info(`🔍 [PREVIEW] Detected Type: ${media.type} | Method: ${media.method || 'unknown'} | Videos: ${media.video_versions?.length} | Images: ${media.image_versions2?.candidates?.length} | Carousel: ${media.carousel_media?.length}`);

    // Carousel
    if (media.carousel_media?.length > 0) {
      const items = media.carousel_media.map((item, idx) => ({
        id: idx,
        type: item.type || (item.video_versions?.[0] ? "video" : "image"),
        thumbnail: item.image_versions2?.candidates?.[0]?.url,
        mediaUrl: item.video_versions?.[0]?.url || item.image_versions2?.candidates?.[0]?.url,
        diagnostics: item.diagnostics, // PER-ITEM DIAGNOSTICS
        shortcode
      }));
      return res.json({ type: "carousel", items, shortcode, version: media.version, diagnostics: media.diagnostics });
    }

    // Single Video / Reel Check
    const isReelOrTv = url.includes("/reel/") || url.includes("/tv/");
    if (isReelOrTv || media.type === "video" || media.video_versions?.[0]) {
      return res.json({
        type: "video",
        version: media.version,
        diagnostics: media.diagnostics,
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
        version: media.version,
        diagnostics: media.diagnostics,
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
            const extension = isVideo ? "mp4" : "jpg";
            const filename = `media_${itemIndex}.${extension}`;
            return resolverModule.streamMedia(mediaUrl, res, filename, url);
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
// Health Check
app.get("/health", (req, res) => res.json({
  status: "ok", version: "v2.6.3-ULTRA-HD",
}));

// Frontend Catch-all (Serve index.html for any non-API routes)
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res, next) => {
  // If request contains /api/, it shouldn't be here, but let's be safe
  if (req.path.startsWith("/api/")) return next();

  const indexPath = path.join(__dirname, "dist", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error(`Static fallback error for ${req.path}: ${err.message}`);
      res.status(500).send("Frontend build missing or inaccessible. Please run 'npm run build' on the VPS.");
    }
  });
});

// Diagnostic Debug Endpoint
app.get("/api/debug", async (req, res) => {
  const { execSync } = await import("child_process");
  const report = {
    time: new Date().toISOString(),
    node: process.version,
    deps: {}
  };

  try { report.deps.ytDlp = execSync("yt-dlp --version").toString().trim(); } catch (e) { report.deps.ytDlp = "MISSING"; }
  try { report.deps.ffmpeg = execSync("ffmpeg -version").toString().split("\n")[0].trim(); } catch (e) { report.deps.ffmpeg = "MISSING"; }
  try { report.deps.git = execSync("git rev-parse --short HEAD").toString().trim(); } catch (e) { report.deps.git = "ERR"; }

  res.json(report);
});

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
