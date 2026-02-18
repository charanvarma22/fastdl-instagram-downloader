import axios from "axios";
import fs from "fs";

function loadCookies() {
    const lines = fs.readFileSync("cookies.txt", "utf8").split(/\r?\n/);
    const cookies = [];

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith("# Netscape")) continue;
        if (line.startsWith("# http")) continue;

        // Remove #HttpOnly_ prefix safely
        if (line.startsWith("#HttpOnly_")) {
            line = line.replace("#HttpOnly_", "");
        }

        const parts = line.split("\t");
        if (parts.length < 7) continue;

        const name = parts[5];
        const value = parts[6];

        if (name && value) {
            cookies.push(`${name}=${value}`);
        }
    }

    return cookies.join("; ");
}

const COOKIE = loadCookies();
const csrfMatch = COOKIE.match(/csrftoken=([^;]+)/);
const CSRF_TOKEN = csrfMatch ? csrfMatch[1] : "";

const mobileHeaders = {
    "User-Agent":
        "Instagram 269.0.0.18.75 Android (30/11; 420dpi; 1080x2340; samsung; SM-G991B; o1s; exynos2100; en_US)",
    "X-IG-App-ID": "936619743392459",
    "Cookie": COOKIE,
    "Accept": "*/*",
    "X-CSRFToken": CSRF_TOKEN
};

const webHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Cookie": COOKIE,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
    "Upgrade-Insecure-Requests": "1"
};

// 0️⃣ Algorithmic Shortcode -> Media ID
function getMediaId(shortcode) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let id = 0n;
    for (let i = 0; i < shortcode.length; i++) {
        const char = shortcode[i];
        const index = alphabet.indexOf(char);
        id = id * 64n + BigInt(index);
    }
    return id.toString();
}

export async function fetchMediaByShortcode(shortcode) {
    try {
        // 1️⃣ Get media ID locally (No web request needed!)
        const mediaId = getMediaId(shortcode);

        // 2️⃣ Mobile API (authenticated)
        const apiUrl = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
        const res = await axios.get(apiUrl, { headers: mobileHeaders, timeout: 10000 });

        if (!res.data?.items?.[0]) {
            throw new Error("API_BLOCKED");
        }

        return res.data.items[0];
    } catch (err) {

        if (err.message === "MEDIA_NOT_FOUND") {
            throw { code: "MEDIA_NOT_FOUND", message: "This post might be deleted, private, or archived" };
        }
        if (err.message === "API_BLOCKED") {
            throw { code: "API_BLOCKED", message: "Instagram API blocked - try again later or check cookies" };
        }
        if (err.response?.status === 404) {
            throw { code: "NOT_FOUND", message: "Post not found or has been deleted" };
        }
        if (err.code === "ECONNREFUSED") {
            throw { code: "NETWORK", message: "Network error - check your connection" };
        }
        throw { code: "UNKNOWN", message: err.message || "Failed to fetch media" };
    }
}

// Best-effort fetch for stories given a full story URL (e.g. /stories/<username>/<id>/)
export async function fetchStoryByUrl(storyUrl) {
    // Try to call the Instagram mobile API first if we can extract a numeric media id
    try {
        const idMatch = storyUrl.match(/stories\/[^\/]+\/(\d+)/);
        if (idMatch) {
            const mediaId = idMatch[1];
            try {
                const apiUrl = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
                const res = await axios.get(apiUrl, { headers: mobileHeaders, timeout: 10000 });
                const item = res.data?.items?.[0];
                if (item) {
                    if (item.video_versions && item.video_versions.length > 0) {
                        const videoUrl = item.video_versions[0].url;
                        const thumbnail = item.image_versions2?.candidates?.[0]?.url || null;
                        return { type: "video", url: videoUrl, thumbnail };
                    }
                    if (item.image_versions2 && item.image_versions2.candidates?.length > 0) {
                        const imgUrl = item.image_versions2.candidates[0].url;
                        return { type: "image", url: imgUrl, thumbnail: imgUrl };
                    }
                }
            } catch (apiErr) {
                // fall through to HTML scraping if mobile API fails
                console.warn("mobile API story fetch failed:", apiErr.message);
            }
        }

        // Fallback: fetch the public story page HTML and try to extract urls
        const html = await axios.get(storyUrl, { headers: webHeaders, timeout: 10000 });
        const data = html.data || "";

        // try several regexes for video URL
        const videoMatch = data.match(/"video_versions"\s*:\s*\[\s*\{[^\}]*"url"\s*:\s*"([^"]+)"/i);
        if (videoMatch) {
            const videoUrl = videoMatch[1].replace(/\\u0026/g, "&");
            // Try to extract thumbnail from display_url
            const thumbMatch = data.match(/"display_url"\s*:\s*"([^"]+)"/i) || data.match(/"image_versions2"[^}]*"candidates"[^\]]*\{[^}]*"url"\s*:\s*"([^"]+)"/i);
            const thumbnail = thumbMatch ? thumbMatch[1].replace(/\\u0026/g, "&") : null;
            return { type: "video", url: videoUrl, thumbnail };
        }

        // try for a single video_url field
        const videoMatch2 = data.match(/"video_url"\s*:\s*"([^\"]+)"/i);
        if (videoMatch2) {
            const videoUrl = videoMatch2[1].replace(/\\u0026/g, "&");
            const thumbMatch = data.match(/"display_url"\s*:\s*"([^"]+)"/i) || data.match(/"image_versions2"[^}]*"candidates"[^\]]*\{[^}]*"url"\s*:\s*"([^"]+)"/i);
            const thumbnail = thumbMatch ? thumbMatch[1].replace(/\\u0026/g, "&") : null;
            return { type: "video", url: videoUrl, thumbnail };
        }

        // try image/display URL
        const imgMatch = data.match(/"display_url"\s*:\s*"([^\"]+)"/i) || data.match(/"display_src"\s*:\s*"([^\"]+)"/i);
        if (imgMatch) {
            const imgUrl = imgMatch[1].replace(/\\u0026/g, "&");
            return { type: "image", url: imgUrl, thumbnail: imgUrl };
        }

        throw new Error("STORY_NOT_FOUND");
    } catch (err) {
        if (err.message === "STORY_NOT_FOUND" || err.code === "STORY_NOT_FOUND") {
            throw { code: "STORY_NOT_FOUND", message: "Story expired or has been deleted" };
        }
        if (err.response?.status === 404) {
            throw { code: "NOT_FOUND", message: "Story not found" };
        }
        throw { code: "UNKNOWN", message: "Failed to fetch story media" };
    }
}

// IGTV Video Downloader
export async function fetchIGTVByUrl(igtvUrl) {
    try {
        // Extract shortcode from URL
        const shortcodeMatch = igtvUrl.match(/\/tv\/([^/?]+)/);
        if (!shortcodeMatch) {
            throw new Error("INVALID_URL");
        }

        const shortcode = shortcodeMatch[1];
        const media = await fetchMediaByShortcode(shortcode);

        // IGTV content should have video_versions
        if (!media.video_versions || media.video_versions.length === 0) {
            throw new Error("NO_VIDEO");
        }

        const videoUrl = media.video_versions[0].url;
        const caption = media.caption?.text || "igtv";

        return {
            type: "video",
            url: videoUrl,
            title: caption.substring(0, 50) // First 50 chars as filename hint
        };
    } catch (err) {
        if (err.message === "INVALID_URL") {
            throw { code: "INVALID_URL", message: "Invalid IGTV URL format" };
        }
        if (err.message === "NO_VIDEO") {
            throw { code: "NO_VIDEO", message: "IGTV video not found - it might be private or deleted" };
        }
        throw err; // re-throw other errors for proper handling
    }
}
