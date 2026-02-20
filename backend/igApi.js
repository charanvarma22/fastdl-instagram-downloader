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

// robust yt-dlp wrapper
// This ensures stability, no IP bans (until heavy usage), and high traffic handling via CLI.

export async function fetchMediaByShortcode(shortcode) {
    return new Promise((resolve, reject) => {
        const url = `https://www.instagram.com/p/${shortcode}/`;

        const args = ["--dump-json", "--no-warnings", "--no-playlist", url];

        // Path to cookies.txt (in the same directory as this file)
        const cookiesPath = path.join(__dirname, "cookies.txt");

        if (fs.existsSync(cookiesPath)) {
            console.log(`🚀 Fetching media for ${shortcode} via yt-dlp (Using cookies.txt)...`);
            args.push("--cookies", cookiesPath);
        } else if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
            console.log(`🚀 Fetching media for ${shortcode} via yt-dlp (Authenticated as ${process.env.IG_USERNAME})...`);
            args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
        } else {
            console.log(`🚀 Fetching media for ${shortcode} via yt-dlp (Anonymous)...`);
        }

        // Spawn yt-dlp process
        const ytDlp = spawn("yt-dlp", args);

        let stdoutData = "";
        let stderrData = "";

        ytDlp.stdout.on("data", (data) => {
            stdoutData += data.toString();
        });

        ytDlp.stderr.on("data", (data) => {
            stderrData += data.toString();
        });

        ytDlp.on("close", async (code) => {
            if (code !== 0) {
                console.error(`❌ yt-dlp failed with code ${code}`);
                console.error("Stderr:", stderrData);

                // FALLBACK: If yt-dlp fails (No video formats or 403 or anything for posts), try Puppeteer
                // Especially for "No video formats found" or general scraping failure on Posts
                if (stderrData.includes("No video formats found") || stderrData.includes("Unable to download") || code !== 0) {
                    console.warn(`⚠️ yt-dlp failed (Code ${code}). Trying RapidAPI...`);

                    // 2. TRY RAPIDAPI (Paid/Quota-based)
                    if (process.env.RAPIDAPI_KEY) {
                        try {
                            const rapidData = await fetchViaRapidAPI(shortcode);
                            console.log("✅ SUCCESS via RapidAPI!");
                            return resolve(rapidData);
                        } catch (rapidErr) {
                            console.warn(`⚠️ RapidAPI failed: ${rapidErr.message}. Trying Puppeteer Fallback...`);
                        }
                    } else {
                        console.log("No RAPIDAPI_KEY found. Skipping RapidAPI...");
                    }

                    console.log("⚠️ Switching to Puppeteer Fallback...");
                    try {
                        const puppeteerData = await fetchViaPuppeteer(shortcode);
                        return resolve(puppeteerData);
                    } catch (fallbackErr) {
                        console.error("Puppeteer Fallback failed:", fallbackErr.message);
                        return reject({
                            code: "DOWNLOAD_FAILED",
                            message: "Failed to fetch media (all methods failed).",
                            originalError: fallbackErr.message
                        });
                    }
                }

                if (stderrData.includes("404")) {
                    return reject({
                        code: "NOT_FOUND",
                        message: "Post not found or private.",
                        originalError: stderrData
                    });
                }
                if (stderrData.includes("Too Many Requests") || stderrData.includes("429")) {
                    return reject({
                        code: "RATE_LIMIT",
                        message: "Server busy (IP Rate Limit). Try again later.",
                        originalError: stderrData
                    });
                }

                return reject({
                    code: "DOWNLOAD_FAILED",
                    message: "Failed to fetch media.",
                    originalError: stderrData
                });
            }

            try {
                // yt-dlp might output multiple JSON objects if it encounters a playlist-like structure
                // We only want the first valid JSON
                const jsonOutput = JSON.parse(stdoutData);
                resolve(transformYtDlpResponse(jsonOutput, shortcode));
            } catch (err) {
                console.error("❌ Failed to parse yt-dlp JSON:", err.message);
                reject({
                    code: "PARSE_ERROR",
                    message: "Failed to parse media data.",
                    originalError: err.message
                });
            }
        });

        // Timeout to prevent hanging processes (45 seconds - increased for Puppeteer chance)
        setTimeout(() => {
            ytDlp.kill();
            reject({ code: "TIMEOUT", message: "Request timed out." });
        }, 45000);
    });
}


function transformYtDlpResponse(data, shortcode) {
    // Determine type
    // yt-dlp returns 'entries' for carousels sometimes, or explicit formats

    // Check for carousel (yt-dlp often creates a playlist for carousels)
    if (data._type === 'playlist' && data.entries) {
        return {
            shortcode: shortcode,
            carousel_media: data.entries.map(entry => ({
                video_versions: entry.ext === 'mp4' || entry.vcodec !== 'none' ? [{ url: entry.url }] : [],
                image_versions2: { candidates: [{ url: entry.thumbnail || entry.url }] }
            })),
            video_versions: [], // It's a carousel container
            image_versions2: { candidates: [] }
        };
    }

    // Single Media
    // Check if it has video codec
    const isVideo = data.ext === 'mp4' || (data.formats && data.formats.some(f => f.vcodec !== 'none' && f.vcodec !== undefined));

    return {
        shortcode: shortcode,
        video_versions: isVideo ? [{ url: data.url }] : [],
        image_versions2: {
            candidates: data.thumbnail ? [{ url: data.thumbnail }] : []
        },
        carousel_media: []
    };
}

// Story support via Puppeteer
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
    const host = process.env.RAPIDAPI_HOST || "instagram-scraper-2022.p.rapidapi.com";

    console.log(`🌐 Fetching via RapidAPI (${host})...`);

    const endpoints = [
        { url: `https://${host}/ig/info_2/`, params: { shortcode } },
        { url: `https://${host}/ig/post_info/`, params: { shortcode } },
        { url: `https://${host}/post/info`, params: { shortcode } }
    ];

    for (const ep of endpoints) {
        try {
            const response = await axios.get(ep.url, {
                params: ep.params,
                headers: {
                    'x-rapidapi-key': key,
                    'x-rapidapi-host': host
                },
                timeout: 10000
            });

            if (response.data && (response.data.items || response.data.data)) {
                return transformRapidAPIResponse(response.data, shortcode);
            }
        } catch (e) {
            console.warn(`RapidAPI endpoint ${ep.url} failed: ${e.message}`);
        }
    }
    throw new Error("RapidAPI failed to return data from all endpoints.");
}

function transformRapidAPIResponse(data, shortcode) {
    const item = data.items?.[0] || data.data?.[0] || data.data || data;

    if (!item) throw new Error("Could not parse RapidAPI response.");

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
            const img = node.image_versions2?.candidates?.[0]?.url || node.display_url;
            const vid = node.video_versions?.[0]?.url || node.video_url;

            return {
                image_versions2: { candidates: [{ url: img }] },
                video_versions: vid ? [{ url: vid }] : []
            };
        });
    }

    if (item.video_versions?.length > 0 || item.video_url) {
        result.media_type = 2;
        result.video_versions.push({ url: item.video_versions?.[0]?.url || item.video_url });
    }

    const bestImg = item.image_versions2?.candidates?.[0]?.url || item.display_url || item.thumbnail_url;
    if (bestImg) {
        result.image_versions2.candidates.push({ url: bestImg });
    }

    return result;
}
