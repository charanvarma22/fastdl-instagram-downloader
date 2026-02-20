import axios from "axios";
import { fetchMediaByShortcode, fetchStoryByUrl, fetchIGTVByUrl } from "./igApi.js";
import { streamZip } from "./streamZip.js";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function resolveUrl(url, res) {
    try {
        if (url.includes("/reel/")) return await handleSingleMedia(url, res, "reel.mp4");
        if (url.includes("/p/")) return await handlePost(url, res);
        if (url.includes("/tv/")) return await handleSingleMedia(url, res, "igtv.mp4");
        if (url.includes("/stories/")) return await handleStory(url, res);

        return res.status(400).json({ error: "Unsupported URL type" });
    } catch (err) {
        return handleError(err, res);
    }
}

// Universal Streamer using yt-dlp (Bypasses 403 Forbidden on CDN)
const IG_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function streamWithYtDlp(url, res, filename) {
    const args = [
        "-o", "-",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--user-agent", IG_USER_AGENT,
        "--referer", "https://www.instagram.com/",
        url
    ]; // Output to stdout as MP4

    // Use cookies if available
    const cookiesPath = path.join(__dirname, "cookies.txt");
    if (fs.existsSync(cookiesPath)) {
        args.push("--cookies", cookiesPath);
    } else if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
        args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
    }

    // Set Headers
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", filename.endsWith(".mp4") ? "video/mp4" : "image/jpeg");

    console.log(`📡 [yt-dlp] Starting direct stream for ${url}...`);

    const ytDlp = spawn("yt-dlp", args);

    ytDlp.stdout.pipe(res);

    ytDlp.stderr.on("data", (data) => {
        console.error("Stream Stderr:", data.toString());
    });

    ytDlp.on("close", (code) => {
        if (code !== 0) {
            console.error(`Stream failed with code ${code}`);
            // If headers sent, we can't send JSON error. Connection just closes.
            if (!res.headersSent) {
                res.status(500).json({ error: "Download stream failed" });
            }
        }
    });

    // Handle client disconnect
    res.on("close", () => {
        ytDlp.kill();
    });
}

async function handleStory(url, res) {
    try {
        const media = await fetchStoryByUrl(url);

        // Use post handling logic for story (single image or single video)
        if (media.video_versions && media.video_versions.length > 0) {
            const videoUrl = media.video_versions[0].url;
            return streamDirect(videoUrl, res, "story_video.mp4", url);
        } else {
            const imgUrl = media.image_versions2.candidates[0].url;
            return streamDirect(imgUrl, res, "story_image.jpg", url);
        }
    } catch (e) {
        handleError(e, res);
    }
}

async function handleSingleMedia(url, res, defaultFilename = "media.mp4") {
    try {
        const shortcode = extractShortcode(url);
        const media = await fetchMediaByShortcode(shortcode);

        // Force 'video' for Reels/TV if not already detected
        if (url.includes("/reel/") || url.includes("/tv/")) {
            media.type = "video";
            if (!defaultFilename.endsWith(".mp4")) defaultFilename = "media.mp4";
        }

        // Prefer Video
        if (media.type === "video" || (media.video_versions && media.video_versions.length > 0)) {
            const videoUrl = media.video_versions?.[0]?.url || media.image_versions2?.candidates?.[0]?.url;
            return streamDirect(videoUrl, res, defaultFilename, url);
        }

        // Fallback to Image
        if (media.image_versions2 && media.image_versions2.candidates.length > 0) {
            const imgUrl = media.image_versions2.candidates[0].url;
            const ext = imgUrl.includes(".webp") ? "webp" : "jpg";
            return streamDirect(imgUrl, res, defaultFilename.replace(".mp4", `.${ext}`), url);
        }

        // Absolute fallback to yt-dlp scraping
        streamWithYtDlp(url, res, defaultFilename);
    } catch (e) {
        handleError(e, res);
    }
}

/* ================= POSTS ================= */

async function handlePost(url, res) {
    // For posts, we still need to know if it's a Carousel (Zip) or Single
    // So we fetch metadata first
    try {
        const shortcode = extractShortcode(url);
        const media = await fetchMediaByShortcode(shortcode);

        if (media.carousel_media && media.carousel_media.length > 0) {
            // For zip, we pass the MEDIA object to streamZip
            return streamZip(media.carousel_media, res);
        }

        // Single Media
        if (media.type === "video" || (media.video_versions && media.video_versions.length > 0)) {
            const videoUrl = media.video_versions?.[0]?.url || media.image_versions2?.candidates?.[0]?.url;
            return streamDirect(videoUrl, res, "post_video.mp4", url);
        } else {
            // It's an image
            // If it came from HTML fallback, we MUST use the direct URL
            if (media.derived_from_html) {
                const imgUrl = media.image_versions2.candidates[0].url;
                return streamDirect(imgUrl, res, "post_image.jpg", url);
            }

            // Otherwise, try streaming with yt-dlp (standard flow)
            // But honestly, if it's an image, direct streaming via axios is often safer if we have the URL
            // Let's rely on the URL if present
            if (media.image_versions2 && media.image_versions2.candidates.length > 0) {
                const imgUrl = media.image_versions2.candidates[0].url;
                return streamDirect(imgUrl, res, "post_image.jpg", url);
            }

            // Fallback to yt-dlp stream if no URL (unlikely)
            streamWithYtDlp(url, res, "post_image.jpg");
        }

    } catch (e) {
        handleError(e, res);
    }
}


async function streamDirect(cdnUrl, res, filename, originalUrl = null) {
    try {
        const ext = path.extname(filename).toLowerCase();
        const contentType = ext === '.mp4' ? 'video/mp4' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", contentType);

        const response = await axios.get(cdnUrl, {
            responseType: "stream",
            headers: {
                "User-Agent": IG_USER_AGENT,
                "Referer": "https://www.instagram.com/",
                "Accept": "*/*"
            },
            timeout: 20000,
            validateStatus: (status) => status === 200 // Force error for any non-200
        });

        response.data.pipe(res);
    } catch (err) {
        console.error(`🔴 Direct Stream Failed for ${filename}:`, err.message);

        // Fail-Safe Fallback: If direct CDN link is blocked (403) or failed, use yt-dlp
        if (originalUrl) {
            console.log(`🔄 [FAIL-SAFE] Switching to yt-dlp for: ${originalUrl}`);
            // Clear headers if they cause issues, though res.setHeader is fine to overwrite
            return streamWithYtDlp(originalUrl, res, filename);
        }

        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download media." });
        }
    }
}

function extractShortcode(url) {
    const m = url.match(/\/(reel|p|tv)\/([^/?]+)/);
    if (!m) throw new Error("Invalid Instagram URL");
    return m[2];
}

// Error handler with user-friendly messages
function handleError(err, res) {
    if (res.headersSent) return; // Can't send JSON if streaming started

    console.error("Resolver Error:", err.message);

    const errorMap = {
        "MEDIA_NOT_FOUND": { status: 404, message: "Post not found - it might be deleted or private" },
        "API_BLOCKED": { status: 429, message: "Instagram is blocking requests - try again in a few minutes" },
        "NOT_FOUND": { status: 404, message: "Content not found" },
        "INVALID_URL": { status: 400, message: "Invalid Instagram URL format" },
        "UNKNOWN": { status: 500, message: "Unknown error occurred" }
    };

    const errorCode = err.code || "UNKNOWN";
    const errorInfo = errorMap[errorCode] || { status: 500, message: err.message || "Server error" };

    return res.status(errorInfo.status).json({
        error: errorInfo.message,
        code: errorCode,
        timestamp: new Date().toISOString()
    });
}

