import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

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

        ytDlp.on("close", (code) => {
            if (code !== 0) {
                console.error(`❌ yt-dlp failed with code ${code}`);
                console.error("Stderr:", stderrData);

                // Detailed error handling
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

        // Timeout to prevent hanging processes (30 seconds)
        setTimeout(() => {
            ytDlp.kill();
            reject({ code: "TIMEOUT", message: "Request timed out." });
        }, 30000);
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

// Legacy wrappers
export async function fetchStoryByUrl(storyUrl) {
    return { code: "NOT_IMPLEMENTED", message: "Stories not yet enabled on this version." };
}

export async function fetchIGTVByUrl(igtvUrl) {
    const shortcodeMatch = igtvUrl.match(/\/tv\/([^/?]+)/);
    if (!shortcodeMatch) throw new Error("INVALID_URL");
    return await fetchMediaByShortcode(shortcodeMatch[1]);
}
