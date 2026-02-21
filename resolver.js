import axios from "axios";
import { fetchMediaByShortcode, fetchStoryByUrl, fetchIGTVByUrl } from "./igApi.js";
import { streamZip } from "./streamZip.js";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
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

export async function streamWithYtDlp(url, res, filename) {
    console.log(`📡 [yt-dlp] Resolving compatible stream for: ${url}`);

    // Favors MP4 containers with H.264 for widest compatibility
    const formatStr = "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";

    const args = [
        "--no-playlist",
        "--get-url", // Get the direct URL instead of downloading
        "-f", formatStr,
        "--user-agent", IG_USER_AGENT,
        "--referer", "https://www.instagram.com/",
        url
    ];

    const cookiesPath = path.join(__dirname, "cookies.txt");
    if (fs.existsSync(cookiesPath)) {
        args.push("--cookies", cookiesPath);
    } else if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
        args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
    }

    const { exec } = await import("child_process");
    const cmd = `yt-dlp ${args.map(a => `"${a}"`).join(" ")}`;

    exec(cmd, async (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
            console.warn(`⚠️ [yt-dlp] Quick resolution failed, falling back to direct pipe: ${stderr}`);
            return streamDirectPipe(url, res, filename);
        }

        const resolvedUrls = stdout.trim().split("\n");
        const finalUrl = resolvedUrls[0]; // Take primary stream

        console.log(`🚀 [yt-dlp] Resolved direct link: ${finalUrl.substring(0, 50)}...`);

        // Use streamDirect to handle headers and fail-over
        return streamDirect(finalUrl, res, filename, url);
    });
}

// Fallback: Direct pipe from yt-dlp (Standard)
function streamDirectPipe(url, res, filename) {
    const formatStr = "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
    const args = ["-o", "-", "-f", formatStr, "--user-agent", IG_USER_AGENT, "--referer", "https://www.instagram.com/", url];

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "video/mp4");

    const ytDlp = spawn("yt-dlp", args);
    ytDlp.stdout.pipe(res);

    ytDlp.on("close", (code) => {
        if (code === 0) console.log("✅ [yt-dlp] Pipe stream finished.");
    });

    res.on("close", () => {
        if (ytDlp && !ytDlp.killed) ytDlp.kill();
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

        // Prefer Video -> Forced yt-dlp for codec consistency
        if (media.type === "video" || (media.video_versions && media.video_versions.length > 0)) {
            return streamWithYtDlp(url, res, defaultFilename);
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

        // Single Media -> Forced yt-dlp for videos
        if (media.type === "video" || (media.video_versions && media.video_versions.length > 0)) {
            return streamWithYtDlp(url, res, "post_video.mp4");
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


export async function streamDirect(cdnUrl, res, filename, originalUrl = null) {
    try {
        const ext = path.extname(filename).toLowerCase();
        const isVideo = ext === '.mp4';
        const contentType = isVideo ? 'video/mp4' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');

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

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", contentType);
        response.data.pipe(res);
    } catch (err) {
        console.warn(`🔴 Direct Stream Failed (Blocked/403): ${err.message}`);

        if (originalUrl) {
            console.log(`🔄 [FAIL-SAFE] Switching to yt-dlp for: ${originalUrl}`);
            return streamWithYtDlp(originalUrl, res, filename);
        }

        if (!res.headersSent) {
            res.status(500).json({ error: "Media download failed. Link might be expired or blocked." });
        }
    }
}

// Unified export for server.js to use for shared fail-safe logic
export async function streamMedia(mediaUrl, res, filename, originalUrl) {
    const isVideo = filename.toLowerCase().endsWith(".mp4");

    // For videos, ALWAYS use yt-dlp for codec enforcement (H.264/AAC)
    if (isVideo && originalUrl) {
        console.log(`🎬 [ROUTER] Routing Video to yt-dlp: ${originalUrl}`);
        return streamWithYtDlp(originalUrl, res, filename);
    }

    // For images, use direct CDN streaming
    console.log(`🖼️ [ROUTER] Routing Image to Direct Stream: ${filename}`);
    return streamDirect(mediaUrl, res, filename, originalUrl);
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
