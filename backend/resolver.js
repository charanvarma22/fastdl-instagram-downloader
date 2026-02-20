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
        if (url.includes("/reel/")) return await handleReel(url, res);
        if (url.includes("/p/")) return await handlePost(url, res);
        if (url.includes("/tv/")) return await handleIGTV(url, res);
        if (url.includes("/stories/")) return await handleStory(url, res);

        return res.status(400).json({ error: "Unsupported URL type" });
    } catch (err) {
        return handleError(err, res);
    }
}

// Universal Streamer using yt-dlp (Bypasses 403 Forbidden on CDN)
function streamWithYtDlp(url, res, filename) {
    const args = ["-o", "-", url]; // Output to stdout

    // Use cookies if available
    const cookiesPath = path.join(__dirname, "cookies.txt");
    if (fs.existsSync(cookiesPath)) {
        args.push("--cookies", cookiesPath);
    } else if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
        args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
    }

    // Set Headers
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // We don't know Content-Type ahead of time easily with stdout, but browsers handle binaries well.
    // We can try to guess or let yt-dlp handle it.

    console.log(`DATA STREAM: Starting yt-dlp stream for ${url}`);

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
    // Stories might be tricky with yt-dlp directly if they prompt for login differently
    // But let's try strict generic streaming
    streamWithYtDlp(url, res, "story.mp4");
}

async function handleReel(url, res) {
    streamWithYtDlp(url, res, "reel.mp4");
}

async function handleIGTV(url, res) {
    streamWithYtDlp(url, res, "igtv.mp4");
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
            // streamZip likely uses axios. We need to fix streamZip too eventually
            // For now, let's hope axios works for public images, or failed here.
            return streamZip(media.carousel_media, res);
        }

        // Single Media
        if (media.video_versions && media.video_versions.length > 0) {
            // It's a video
            streamWithYtDlp(url, res, "post_video.mp4");
        } else {
            // It's an image
            // yt-dlp might download image if we ask it to?
            // Or we use the URL from metadata (CDN might block)

            // Try yt-dlp streaming for image?
            // yt-dlp default for image post downloads the image.
            streamWithYtDlp(url, res, "post_image.jpg");
        }

    } catch (e) {
        handleError(e, res);
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

