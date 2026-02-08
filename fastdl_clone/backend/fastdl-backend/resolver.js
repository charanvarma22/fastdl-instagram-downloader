import axios from "axios";
import { fetchMediaByShortcode, fetchStoryByUrl, fetchIGTVByUrl } from "./igApi.js";
import { streamZip } from "./streamZip.js";

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

async function handleStory(url, res) {
    try {
        const story = await fetchStoryByUrl(url);

        if (story.type === "video") {
            res.setHeader("Content-Type", "video/mp4");
            res.setHeader("Content-Disposition", "attachment; filename=story.mp4");

            const stream = await axios.get(story.url, { responseType: "stream" });
            return stream.data.pipe(res);
        }

        if (story.type === "image") {
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Content-Disposition", "attachment; filename=story.jpg");

            const stream = await axios.get(story.url, { responseType: "stream" });
            return stream.data.pipe(res);
        }

        return res.status(400).json({ error: "Unsupported story media type" });
    } catch (err) {
        return handleError(err, res);
    }
}

function extractShortcode(url) {
    const m = url.match(/\/(reel|p|tv)\/([^/?]+)/);
    if (!m) throw new Error("Invalid Instagram URL");
    return m[2];
}

async function handleReel(url, res) {
    const shortcode = extractShortcode(url);
    const media = await fetchMediaByShortcode(shortcode);

    const videoUrl = media.video_versions?.[0]?.url;
    if (!videoUrl) throw new Error("Reel video not found");

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=reel.mp4");

    const stream = await axios.get(videoUrl, { responseType: "stream" });
    stream.data.pipe(res);
}

async function handleIGTV(url, res) {
    try {
        const igtv = await fetchIGTVByUrl(url);

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename=igtv_${igtv.title.slice(0, 30)}.mp4`);

        const stream = await axios.get(igtv.url, { responseType: "stream" });
        return stream.data.pipe(res);
    } catch (err) {
        return handleError(err, res);
    }
}

/* ================= POSTS ================= */

async function handlePost(url, res) {
    const shortcode = extractShortcode(url);
    const media = await fetchMediaByShortcode(shortcode);

    if (media.carousel_media) {
        return streamZip(media.carousel_media, res);
    }

    return streamSingle(media, res);
}

async function streamSingle(media, res) {
    /* VIDEO POST */
    if (media.video_versions) {
        const videoUrl = media.video_versions[0].url;

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", "attachment; filename=video.mp4");

        const stream = await axios.get(videoUrl, { responseType: "stream" });
        return stream.data.pipe(res);
    }

    /* IMAGE POST */
    if (media.image_versions2) {
        const imgUrl = media.image_versions2.candidates[0].url;

        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Content-Disposition", "attachment; filename=image.jpg");

        const stream = await axios.get(imgUrl, { responseType: "stream" });
        return stream.data.pipe(res);
    }

    throw new Error("Unknown post type");
}

// Error handler with user-friendly messages
function handleError(err, res) {
    const errorMap = {
        "MEDIA_NOT_FOUND": { status: 404, message: "Post not found - it might be deleted or private" },
        "STORY_NOT_FOUND": { status: 404, message: "Story expired or deleted (stories disappear after 24h)" },
        "API_BLOCKED": { status: 429, message: "Instagram is blocking requests - try again in a few minutes" },
        "NOT_FOUND": { status: 404, message: "Content not found" },
        "NO_VIDEO": { status: 400, message: "Video not found in this IGTV" },
        "INVALID_URL": { status: 400, message: "Invalid Instagram URL format" },
        "NETWORK": { status: 503, message: "Network error - please check your connection" },
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
