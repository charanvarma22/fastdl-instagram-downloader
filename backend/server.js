import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

// IMPORTANT: import everything, not default
import * as resolverModule from "./resolver.js";
import { fetchMediaByShortcode, fetchStoryByUrl, fetchIGTVByUrl } from "./igApi.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// resolve function (works for named or module.exports)
const resolver =
    resolverModule.default ||
    resolverModule.resolver ||
    resolverModule.resolve ||
    resolverModule.resolveUrl;

app.post("/resolve", async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        if (!resolver) {
            return res.status(500).json({ error: "Resolver function not found" });
        }

        await resolver(url, res);
    } catch (err) {
        console.error("Backend error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Compatibility route used by the frontend
app.post("/api/download", async (req, res) => {
    try {
        const { url, itemIndex } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        if (!resolver) {
            return res.status(500).json({ error: "Resolver function not found" });
        }

        // Check if itemIndex is provided (for carousel individual items)
        if (itemIndex !== undefined && itemIndex !== null) {
            // Fetch media to handle individual carousel item
            const match = url.match(/\/(reel|p|tv)\/([^/?]+)/);
            if (match) {
                const shortcode = match[2];
                const media = await fetchMediaByShortcode(shortcode);

                if (media.carousel_media && media.carousel_media[itemIndex]) {
                    const item = media.carousel_media[itemIndex];

                    // Download single video item
                    if (item.video_versions?.[0]) {
                        const videoUrl = item.video_versions[0].url;
                        res.setHeader("Content-Type", "video/mp4");
                        res.setHeader("Content-Disposition", `attachment; filename=carousel_${itemIndex}.mp4`);

                        const { default: axios } = await import("axios");
                        const stream = await axios.get(videoUrl, { responseType: "stream" });
                        return stream.data.pipe(res);
                    }

                    // Download single image item
                    if (item.image_versions2?.candidates?.[0]) {
                        const imgUrl = item.image_versions2.candidates[0].url;
                        res.setHeader("Content-Type", "image/jpeg");
                        res.setHeader("Content-Disposition", `attachment; filename=carousel_${itemIndex}.jpg`);

                        const { default: axios } = await import("axios");
                        const stream = await axios.get(imgUrl, { responseType: "stream" });
                        return stream.data.pipe(res);
                    }
                }
            }
        }

        // Default behavior: use resolver (for full carousel as zip, single video, single image)
        await resolver(url, res);
    } catch (err) {
        console.error("Backend error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// New preview endpoint - returns carousel items or media info
app.post("/api/preview", async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        // Handle stories separately (no shortcode)
        if (url.includes("/stories/")) {
            try {
                const story = await fetchStoryByUrl(url);
                if (story.type === "video") {
                    return res.json({
                        type: "video",
                        items: [{ id: 0, type: "video", thumbnail: story.thumbnail, mediaUrl: story.url, shortcode: null }],
                        shortcode: null
                    });
                }

                return res.json({
                    type: "image",
                    items: [{ id: 0, type: "image", thumbnail: story.thumbnail || story.url, mediaUrl: story.url, shortcode: null }],
                    shortcode: null
                });
            } catch (err) {
                console.error("❌ Story preview error:", err);
                return res.status(500).json({ error: err.message || "Failed to fetch story" });
            }
        }

        // Extract shortcode from URL for posts/reels/igtv
        const match = url.match(/\/(reel|p|tv)\/([^/?]+)/);
        if (!match) {
            return res.status(400).json({ error: "Invalid Instagram URL" });
        }

        const shortcode = match[2];
        console.log("📸 Fetching preview for shortcode:", shortcode);

        const media = await fetchMediaByShortcode(shortcode);
        console.log("✅ Media fetched, carousel_media:", !!media.carousel_media);

        // Check if carousel
        if (media.carousel_media && media.carousel_media.length > 0) {
            const items = media.carousel_media.map((item, idx) => {
                let thumb = null;
                let type = "image";
                let mediaUrl = null;

                if (item.video_versions?.[0]) {
                    // For videos, try to get thumbnail and video URL
                    thumb = item.image_versions2?.candidates?.[0]?.url;
                    mediaUrl = item.video_versions[0].url;
                    type = "video";
                } else if (item.image_versions2?.candidates?.[0]) {
                    thumb = item.image_versions2.candidates[0].url;
                    mediaUrl = thumb;
                    type = "image";
                }

                return {
                    id: idx,
                    type,
                    thumbnail: thumb,
                    mediaUrl,
                    shortcode
                };
            });

            console.log("🎠 Returning carousel with", items.length, "items");
            return res.json({
                type: "carousel",
                items,
                shortcode
            });
        }

        // Single video (reel or video post)
        if (media.video_versions?.[0]) {
            const thumb = media.image_versions2?.candidates?.[0]?.url;
            const videoUrl = media.video_versions[0].url;
            console.log("🎥 Returning single video");
            return res.json({
                type: "video",
                items: [{
                    id: 0,
                    type: "video",
                    thumbnail: thumb,
                    mediaUrl: videoUrl,
                    shortcode
                }],
                shortcode
            });
        }

        // Single image
        if (media.image_versions2?.candidates?.[0]) {
            const imgUrl = media.image_versions2.candidates[0].url;
            console.log("🖼️ Returning single image");
            return res.json({
                type: "image",
                items: [{
                    id: 0,
                    type: "image",
                    thumbnail: imgUrl,
                    mediaUrl: imgUrl,
                    shortcode
                }],
                shortcode
            });
        }

        return res.status(400).json({ error: "No media found in response" });

    } catch (err) {
        console.error("❌ Preview error:", err.message);
        res.status(500).json({ error: err.message || "Failed to fetch media" });
    }
});

app.get("/", (req, res) => {
    res.send("FastDL backend running");
});

app.listen(PORT, () => {
    console.log(`✅ Backend running at http://localhost:${PORT}`);
});
