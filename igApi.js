import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import axios from "axios";
import { fetchMediaByShortcode as fetchViaPuppeteer } from "./igPuppeteer.js";
import dotenv from "dotenv";

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main function to fetch Instagram media.
 * Tries yt-dlp -> RapidAPI -> Puppeteer fallback.
 */
export async function fetchMediaByShortcode(shortcode) {
    return new Promise((resolve, reject) => {
        const url = `https://www.instagram.com/p/${shortcode}/`;
        const args = ["--dump-json", "--no-warnings", "--no-playlist", url];
        const cookiesPath = path.join(__dirname, "cookies.txt");

        let ytDlpProcess = null;

        // Watchdog timer to prevent hanging requests
        let timer = setTimeout(() => {
            console.error(`🔴 [WATCHDOG] TIMEOUT: ${shortcode} reached 60s limit.`);
            if (ytDlpProcess) ytDlpProcess.kill();
            reject({ code: "TIMEOUT", message: "Download process timed out (60s)." });
        }, 60000);

        const cleanResolve = (data) => {
            clearTimeout(timer);
            resolve(data);
        };

        const cleanReject = (error) => {
            clearTimeout(timer);
            reject(error);
        };

        if (fs.existsSync(cookiesPath)) {
            console.log(`🚀 [yt-dlp] Starting for ${shortcode} (With cookies)...`);
            args.push("--cookies", cookiesPath);
        } else if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
            console.log(`🚀 [yt-dlp] Starting for ${shortcode} (Auth fallback)...`);
            args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
        } else {
            console.log(`🚀 [yt-dlp] Starting for ${shortcode} (Anonymous)...`);
        }

        ytDlpProcess = spawn("yt-dlp", args);
        let stdoutData = "";
        let stderrData = "";

        ytDlpProcess.stdout.on("data", (data) => { stdoutData += data.toString(); });
        ytDlpProcess.stderr.on("data", (data) => { stderrData += data.toString(); });

        ytDlpProcess.on("close", async (code) => {
            console.log(`📡 [yt-dlp] Process exited with code ${code} for ${shortcode}`);

            if (code === 0) {
                try {
                    const jsonOutput = JSON.parse(stdoutData);
                    const result = transformYtDlpResponse(jsonOutput, shortcode);
                    result.method = "yt-dlp";
                    console.log(`✅ [yt-dlp] Success for ${shortcode}`);
                    return cleanResolve(result);
                } catch (err) {
                    console.error("❌ [yt-dlp] JSON Parse Error:", err.message);
                }
            }

            // --- FALLBACK CHAIN ---
            console.warn(`⚠️ [yt-dlp] Failed or empty results. Trying professional fallbacks...`);

            // 1. RapidAPI
            if (process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_KEY !== "PASTE_YOUR_KEY_HERE") {
                try {
                    const rapidData = await fetchViaRapidAPI(shortcode);
                    rapidData.method = "RapidAPI";
                    console.log(`✅ [RapidAPI] Success for ${shortcode}`);
                    return cleanResolve(rapidData);
                } catch (rapidErr) {
                    console.warn(`⚠️ [RapidAPI] Failed: ${rapidErr.message}`);
                }
            } else {
                console.log("No valid RAPIDAPI_KEY. Skipping RapidAPI...");
            }

            // 2. Puppeteer (Final Attempt)
            console.log(`🔄 [Puppeteer] Starting deep scraping for ${shortcode}...`);
            try {
                const puppeteerData = await fetchViaPuppeteer(shortcode);
                puppeteerData.method = "Puppeteer";
                console.log(`✅ [Puppeteer] Success for ${shortcode}`);
                return cleanResolve(puppeteerData);
            } catch (fallbackErr) {
                console.error(`❌ [ALL METHODS FAILED] for ${shortcode}: ${fallbackErr.message}`);
                return cleanReject({
                    code: "DOWNLOAD_FAILED",
                    message: "Failed to fetch media from all available methods.",
                    originalError: fallbackErr.message
                });
            }
        });

        ytDlpProcess.on("error", (err) => {
            console.error("❌ [yt-dlp] Process spawn error:", err.message);
            // Don't reject yet, let the handler above move to fallback
        });
    });
}

function transformYtDlpResponse(data, shortcode) {
    const getBestImg = (item, type = "single") => {
        const candidates = [];
        const isActuallyVideo = (item.vcodec && item.vcodec !== 'none') || (item.ext && ['mp4', 'm4v', 'webm', 'mov'].includes(item.ext.toLowerCase()));

        if (!isActuallyVideo && item.url) {
            candidates.push({ url: item.url, width: item.width || 0, height: item.height || 0, source: 'main_url' });
        }

        if (item.thumbnails && item.thumbnails.length > 0) {
            item.thumbnails.forEach(t => {
                candidates.push({ url: t.url, width: t.width || 0, height: t.height || 0, source: 'thumbnail' });
            });
        }

        if (candidates.length > 0) {
            // Square-Proof Scoring: Area - (Penalty if perfect square)
            const scored = candidates.map(c => {
                const area = (c.width || 1) * (c.height || 1);
                const ratio = (c.width || 1) / (c.height || 1);
                const isSquare = Math.abs(1 - ratio) < 0.05;
                // Penalize squares by 50% if they compete with high-res originals
                const score = isSquare ? (area * 0.5) : area;
                return { ...c, score, isSquare, ratio };
            });

            const winner = scored.reduce((a, b) => (a.score >= b.score ? a : b));
            console.log(`📸 [HD_DEBUG] ${type} | Final Selection: ${winner.width}x${winner.height} (Ratio: ${winner.ratio.toFixed(2)}) | Score: ${winner.score} | Source: ${winner.source}`);
            return winner.url;
        }

        return item.url || item.thumbnail;
    };

    if (data._type === 'playlist' && data.entries) {
        return {
            shortcode: shortcode,
            version: "v2.2-ULTRA-HD",
            carousel_media: data.entries.map((entry, idx) => {
                const isEntryVid = (entry.vcodec && entry.vcodec !== 'none') || (entry.ext && ['mp4', 'm4v', 'webm', 'mov'].includes(entry.ext.toLowerCase()));
                return {
                    video_versions: isEntryVid ? [{ url: entry.url }] : [],
                    image_versions2: { candidates: [{ url: getBestImg(entry, `carousel_${idx}`) }] },
                    type: isEntryVid ? "video" : "image"
                };
            }),
            video_versions: [],
            image_versions2: { candidates: [] }
        };
    }

    const isVideo = (data.vcodec && data.vcodec !== 'none') || (data.ext && ['mp4', 'm4v', 'webm', 'mov'].includes(data.ext.toLowerCase()));

    return {
        shortcode: shortcode,
        version: "v2.2-ULTRA-HD",
        video_versions: isVideo ? [{ url: data.url }] : [],
        image_versions2: {
            candidates: [{ url: getBestImg(data, "single") }]
        },
        type: isVideo ? "video" : "image",
        carousel_media: []
    };
}

export async function fetchStoryByUrl(storyUrl) {
    try {
        console.log(`🎬 Fetching story via Puppeteer: ${storyUrl}`);
        const data = await fetchViaPuppeteer(null, storyUrl);
        return data;
    } catch (err) {
        console.error("Story fetch failed:", err.message);
        throw err;
    }
}

export async function fetchIGTVByUrl(igtvUrl) {
    const shortcodeMatch = igtvUrl.match(/\/tv\/([^/?]+)/);
    if (!shortcodeMatch) throw new Error("INVALID_URL");
    return await fetchMediaByShortcode(shortcodeMatch[1]);
}

async function fetchViaRapidAPI(shortcode) {
    const key = process.env.RAPIDAPI_KEY;
    const host = process.env.RAPIDAPI_HOST || "instagram-scraper-20251.p.rapidapi.com";

    console.log(`🌐 [RapidAPI] Connecting to ${host} for shortcode: ${shortcode}...`);

    const endpoints = [
        { url: `https://${host}/v1/post_info`, params: { shortcode } },
        { url: `https://${host}/post/info`, params: { shortcode } },
        { url: `https://${host}/v1/info`, params: { shortcode } },
        { url: `https://${host}/ig/info_2/`, params: { shortcode } }
    ];

    for (const ep of endpoints) {
        try {
            console.log(`📡 [RapidAPI] Trying endpoint: ${ep.url}`);
            const response = await axios.get(ep.url, {
                params: ep.params,
                headers: {
                    'x-rapidapi-key': key,
                    'x-rapidapi-host': host
                },
                timeout: 15000
            });

            if (response.data && (response.data.items || response.data.data || response.data.shortcode)) {
                console.log(`✅ [RapidAPI] Data received from ${ep.url}`);
                return transformRapidAPIResponse(response.data, shortcode);
            }
        } catch (e) {
            const status = e.response?.status;
            const errorMsg = e.response?.data?.message || e.message;
            console.warn(`⚠️ [RapidAPI] Endpoint ${ep.url} failed (${status || 'No Status'}): ${errorMsg}`);
        }
    }
    throw new Error("RapidAPI failed to return data from all tested endpoints.");
}

function transformRapidAPIResponse(data, shortcode) {
    // Dig for the item in various possible response structures
    const item = data.item || data.items?.[0] || data.data?.[0] || data.data || data;

    if (!item || (!item.image_versions2 && !item.video_versions && !item.display_url)) {
        console.error("❌ [RapidAPI] Invalid item structure:", JSON.stringify(data).substring(0, 200));
        throw new Error("Could not parse RapidAPI response structure.");
    }

    const result = {
        shortcode: shortcode,
        version: "v2.2-ULTRA-HD",
        media_type: item.media_type || 1,
        image_versions2: { candidates: [] },
        video_versions: [],
        carousel_media: []
    };

    const carouselArr = item.carousel_media || item.edge_sidecar_to_children?.edges;
    if (carouselArr && carouselArr.length > 0) {
        result.carousel_media = carouselArr.map(c => {
            const node = c.node || c;

            // Collect all image versions
            const imgCandidates = [
                ...(node.image_versions2?.candidates || []),
                ...(node.display_resources || []).map(r => ({ url: r.src || r.url, width: r.config_width || r.width, height: r.config_height || r.height })),
                { url: node.display_url, width: node.dimensions?.width || 0, height: node.dimensions?.height || 0 }
            ].filter(r => r && r.url);

            // Area + Square-Proof selection
            const scored = imgCandidates.map(c => {
                const area = (c.width || 1) * (c.height || 1);
                const ratio = (c.width || 1) / (c.height || 1);
                const isSquare = Math.abs(1 - ratio) < 0.05;
                const score = isSquare ? (area * 0.5) : area;
                return { ...c, score, isSquare, ratio };
            });

            const winner = scored.length > 0
                ? scored.reduce((a, b) => (a.score >= b.score ? a : b))
                : { url: node.display_url, width: 0, height: 0, ratio: 1 };

            console.log(`📸 [RapidAPI] Carousel Item | Selection: ${winner.width}x${winner.height} (Ratio: ${winner.ratio.toFixed(2)}) | Score: ${winner.score}`);
            const bestImg = winner.url;

            // Collect all video versions
            const vidCandidates = [
                ...(node.video_versions || []),
                { url: node.video_url, width: node.dimensions?.width || 0, height: node.dimensions?.height || 0 }
            ].filter(v => v && v.url);

            const bestVid = vidCandidates.length > 0
                ? vidCandidates.reduce((a, b) => {
                    const resA = (a.width || 0) * (a.height || 0);
                    const resB = (b.width || 0) * (b.height || 0);
                    return resA > resB ? a : b;
                }).url
                : node.video_url;

            return {
                image_versions2: { candidates: [{ url: bestImg }] },
                video_versions: bestVid ? [{ url: bestVid }] : [],
                type: (bestVid || node.is_video || node.media_type === 2) ? "video" : "image"
            };
        });
    }

    // Unified selection for single media
    const vidCandidates = [
        ...(item.video_versions || []),
        { url: item.video_url, width: item.dimensions?.width || 0, height: item.dimensions?.height || 0 }
    ].filter(v => v && v.url);

    const isVideo = vidCandidates.length > 0 || item.is_video || item.media_type === 2;

    if (isVideo) {
        result.media_type = 2;
        const bestVid = vidCandidates.length > 0
            ? vidCandidates.reduce((a, b) => {
                const resA = (a.width || 0) * (a.height || 0);
                const resB = (b.width || 0) * (b.height || 0);
                return resA > resB ? a : b;
            }).url
            : item.video_url;
        if (bestVid) result.video_versions.push({ url: bestVid });
    }

    const imgCandidates = [
        ...(item.image_versions2?.candidates || []),
        ...(item.display_resources || []).map(r => ({ url: r.src || r.url, width: r.config_width || r.width, height: r.config_height || r.height })),
        { url: item.display_url, width: item.dimensions?.width || 0, height: item.dimensions?.height || 0 }
    ].filter(r => r && r.url);

    const scored = imgCandidates.map(c => {
        const area = (c.width || 1) * (c.height || 1);
        const ratio = (c.width || 1) / (c.height || 1);
        const isSquare = Math.abs(1 - ratio) < 0.05;
        const score = isSquare ? (area * 0.5) : area;
        return { ...c, score, isSquare, ratio };
    });

    const winner = scored.length > 0
        ? scored.reduce((a, b) => (a.score >= b.score ? a : b))
        : { url: (item.display_url || item.thumbnail_url), width: 0, height: 0, ratio: 1 };

    console.log(`📸 [RapidAPI] Single Item | Selection: ${winner.width}x${winner.height} (Ratio: ${winner.ratio.toFixed(2)}) | Score: ${winner.score}`);
    const bestImg = winner.url;

    if (bestImg) {
        result.image_versions2.candidates.push({ url: bestImg });
    }

    // Set top-level type for server preview logic
    result.type = isVideo ? "video" : "image";

    return result;
}
