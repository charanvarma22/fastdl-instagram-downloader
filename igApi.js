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
    const getBestImg = (item) => {
        if (item.thumbnails && item.thumbnails.length > 0) {
            // Find the widest thumbnail (highest resolution)
            return item.thumbnails.reduce((a, b) => ((a.width || 0) > (b.width || 0) ? a : b)).url;
        }
        return item.url || item.thumbnail;
    };

    if (data._type === 'playlist' && data.entries) {
        return {
            shortcode: shortcode,
            carousel_media: data.entries.map(entry => {
                const isEntryVideo = entry.ext === 'mp4' || entry.ext === 'webm' || entry.vcodec !== 'none';
                return {
                    video_versions: isEntryVideo ? [{ url: entry.url }] : [],
                    image_versions2: { candidates: [{ url: getBestImg(entry) }] },
                    type: isEntryVideo ? "video" : "image"
                };
            }),
            video_versions: [],
            image_versions2: { candidates: [] }
        };
    }

    const isVideo = ['mp4', 'webm', 'mkv', 'mov'].includes(data.ext) || (data.formats && data.formats.some(f => f.vcodec !== 'none' && f.vcodec !== undefined));

    return {
        shortcode: shortcode,
        video_versions: isVideo ? [{ url: data.url }] : [],
        image_versions2: {
            candidates: [{ url: getBestImg(data) }]
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
                ...(node.display_resources || []).map(r => ({ url: r.src || r.url, width: r.config_width || r.width })),
                { url: node.display_url, width: node.dimensions?.width || 1080 } // High default for source
            ].filter(r => r && r.url);

            const bestImg = imgCandidates.length > 0
                ? imgCandidates.reduce((a, b) => ((a.width || 0) > (b.width || 0) ? a : b)).url
                : node.display_url;

            // Collect all video versions
            const vidCandidates = [
                ...(node.video_versions || []),
                { url: node.video_url, width: node.dimensions?.width || 1080 }
            ].filter(v => v && v.url);

            const bestVid = vidCandidates.length > 0
                ? vidCandidates.reduce((a, b) => ((a.width || 0) > (b.width || 0) ? a : b)).url
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
        { url: item.video_url, width: item.dimensions?.width || 0 }
    ].filter(v => v && v.url);

    const isVideo = vidCandidates.length > 0 || item.is_video || item.media_type === 2;

    if (isVideo) {
        result.media_type = 2;
        const bestVid = vidCandidates.length > 0
            ? vidCandidates.reduce((a, b) => ((a.width || 0) > (b.width || 0) ? a : b)).url
            : item.video_url;
        if (bestVid) result.video_versions.push({ url: bestVid });
    }

    const imgCandidates = [
        ...(item.image_versions2?.candidates || []),
        ...(item.display_resources || []).map(r => ({ url: r.src || r.url, width: r.config_width || r.width })),
        { url: item.display_url, width: item.dimensions?.width || 1080 }
    ].filter(r => r && r.url);

    const bestImg = imgCandidates.length > 0
        ? imgCandidates.reduce((a, b) => ((a.width || 0) > (b.width || 0) ? a : b)).url
        : (item.display_url || item.thumbnail_url);

    if (bestImg) {
        result.image_versions2.candidates.push({ url: bestImg });
    }

    // Set top-level type for server preview logic
    result.type = isVideo ? "video" : "image";

    return result;
}
