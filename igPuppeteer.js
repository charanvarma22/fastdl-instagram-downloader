import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function fetchMediaByShortcode(shortcode, fullUrl = null) {
    let browser = null;
    try {
        const url = fullUrl || `https://www.instagram.com/p/${shortcode}/`;
        console.log(`[Puppeteer] Launching browser for: ${url}`);

        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--window-size=1280,800'
            ]
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // essential: Set a real user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set cookies if available
        const cookiesPath = path.join(__dirname, "cookies.txt");
        if (fs.existsSync(cookiesPath)) {
            try {
                const cookieContent = fs.readFileSync(cookiesPath, 'utf8');
                const cookies = parseCookies(cookieContent);
                if (cookies.length > 0) {
                    await page.setCookie(...cookies);
                }
            } catch (e) {
                console.error("[Puppeteer] Failed to load cookies:", e.message);
            }
        }

        // Pipe browser console to node console
        page.on('console', msg => console.log(`[Puppeteer Browser] ${msg.text()}`));

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for page to settle
        await new Promise(r => setTimeout(r, 4000));

        let content = await page.content();

        // Extract deep JSON data
        const data = await page.evaluate(() => {
            const result = {
                id: 'puppeteer_' + Date.now(),
                shortcode: '',
                media_type: 1,
                type: 'image',
                version: 'v2.6.9-ULTRA-HD',
                image_versions2: { candidates: [] },
                video_versions: [],
                carousel_media: [],
                derived_from_html: true,
                diagnostics: 'Puppeteer Selection'
            };

            const getBestImage = (node, label = "unnamed") => {
                const candidates = [
                    ...(node.image_versions2?.candidates || []).map(c => ({ src: c.url || c.src, width: c.width, height: c.height, tag: 'v2' })),
                    ...(node.display_resources || []).map(r => ({ src: r.src, width: r.config_width || r.width, height: r.config_height || r.height, tag: 'res' })),
                    { src: node.display_url, width: node.dimensions?.width || 0, height: node.dimensions?.height || 0, tag: 'display' }
                ].filter(c => c.src);

                if (candidates.length > 0) {
                    const topW = node.dimensions?.width || 1080;
                    const topH = node.dimensions?.height || 1080;
                    const targetRatio = topW / (topH || 1);
                    const targetIsSquare = Math.abs(1 - targetRatio) < 0.05;

                    const scored = candidates.map((c, idx) => {
                        const hasMeta = !!(c.width && c.height);
                        // v2.6.7 Assumption Logic:
                        // If no metadata, we assume it's PORTRAIT (1080x1350) 
                        // so it loses points to actual landscape originals.
                        const width = c.width || (targetIsSquare ? 1080 : topW) || 1080;
                        const height = c.height || (targetIsSquare ? 1350 : topH) || 1350;
                        const area = width * height;
                        const ratio = width / (height || 1);

                        const isSquare = Math.abs(1 - ratio) < 0.02;

                        // v2.6.9 RATIO X-FORCE (10x)
                        let score = area;
                        if (isSquare) {
                            score *= 0.1; // 90% penalty for potential automated crops
                        } else {
                            score *= 10.0; // 10x bonus for ANY non-square (Portrait or Landscape)
                        }
                        if (hasMeta) score *= 1.5;      // Prefer real data over assumptions

                        console.log(`[${label} C#${idx}] ${width}x${height} | Ratio: ${ratio.toFixed(2)} | Score: ${score.toFixed(0)} | Tag: ${c.tag}`);
                        return { src: c.src, score, width, height, ratio };
                    });
                    const winner = scored.reduce((prev, current) => (prev.score >= current.score) ? prev : current);
                    console.log(`🏆 [${label} WINNER] ${winner.width}x${winner.height} (${winner.ratio.toFixed(2)})`);
                    return { url: winner.src, diag: `${winner.width}x${winner.height} HD` };
                }
                return { url: node.display_url || (node.image_versions2?.candidates?.[0]?.url), diag: "fallback" };
            };

            // Deep Scan for JSON
            let mediaData = null;
            try {
                if (window.__additionalDataLoaded) {
                    for (const key in window.__additionalDataLoaded) {
                        const item = window.__additionalDataLoaded[key]?.graphql?.shortcode_media || window.__additionalDataLoaded[key]?.items?.[0];
                        if (item) { mediaData = item; break; }
                    }
                }
                if (!mediaData && window._sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media) {
                    mediaData = window._sharedData.entry_data.PostPage[0].graphql.shortcode_media;
                }
                if (!mediaData) {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const s of scripts) {
                        if (s.innerText.includes('shortcode_media') || s.innerText.includes('xdt_api')) {
                            const matches = s.innerText.match(/\{"xdt_api.*?\}/g) || s.innerText.match(/\{"graphql".*?\}/g);
                            if (matches) {
                                for (const match of matches) {
                                    try {
                                        const parsed = JSON.parse(match);
                                        const item = parsed?.xdt_api__v1__media__shortcode__web_info?.items?.[0] || parsed?.graphql?.shortcode_media;
                                        if (item) { mediaData = item; break; }
                                    } catch (e) { }
                                }
                            }
                        }
                        if (mediaData) break;
                    }
                }
            } catch (e) { }

            if (mediaData) {
                result.shortcode = mediaData.shortcode || mediaData.code;
                const isVideo = !!(mediaData.is_video || (mediaData.media_type === 2) || mediaData.video_url || mediaData.video_versions?.length > 0);

                result.media_type = isVideo ? 2 : 1;
                result.type = isVideo ? "video" : "image";

                // Handle Carousel
                const children = mediaData.edge_sidecar_to_children?.edges || mediaData.carousel_media;
                if (children && children.length > 0) {
                    result.type = "carousel";
                    result.carousel_media = children.map((edge, idx) => {
                        const node = edge.node || edge;
                        const isNodeVideo = !!(node.is_video || node.media_type === 2 || node.video_url || node.video_versions?.length > 0);
                        const imgInfo = getBestImage(node, `item_${idx}`);
                        return {
                            video_versions: isNodeVideo ? [{ url: node.video_url || node.video_versions?.[0]?.url }] : [],
                            image_versions2: { candidates: [{ url: imgInfo.url }] },
                            type: isNodeVideo ? "video" : "image",
                            diagnostics: imgInfo.diag
                        };
                    });
                } else {
                    // Single
                    if (isVideo) {
                        const videoUrl = mediaData.video_url || mediaData.video_versions?.[0]?.url;
                        if (videoUrl) result.video_versions.push({ url: videoUrl });
                    }
                    const imgInfo = getBestImage(mediaData, "single");
                    if (imgInfo.url) result.image_versions2.candidates.push({ url: imgInfo.url });
                    result.diagnostics = `Puppeteer ${imgInfo.diag} (${isVideo ? 'Video' : 'Image'})`;
                }
            }

            // Global Meta Fallback
            if (result.image_versions2.candidates.length === 0 && result.video_versions.length === 0 && result.carousel_media.length === 0) {
                const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content;
                const ogImg = getMeta('og:image');
                if (ogImg) result.image_versions2.candidates.push({ url: ogImg });
                const ogVid = getMeta('og:video');
                if (ogVid) {
                    result.media_type = 2;
                    result.type = "video";
                    result.video_versions.push({ url: ogVid });
                }
            }

            return result;
        });

        if (!data.image_versions2.candidates.length && !data.video_versions.length && !data.carousel_media.length) {
            content = await page.content();

            // Detect blocks
            if (content.includes("Login • Instagram") || content.includes("Welcome back to Instagram") || page.url().includes("/accounts/login")) {
                throw new Error("LOGIN_REQUIRED");
            }
            if (content.includes("Suspicious activity") || content.includes("Verify your account") || content.includes("Challenge")) {
                throw new Error("ACCOUNT_FLAGGED_VERIFICATION_REQUIRED");
            }
            if (content.includes("Wait a few minutes before you try again") || content.includes("Too Many Requests")) {
                throw new Error("IP_RATE_LIMITED");
            }

            // Save debug screenshot
            const screenPath = path.join(__dirname, 'debug_last_fail.png');
            await page.screenshot({ path: screenPath });

            // Save HTML for deep inspection
            const htmlPath = path.join(__dirname, 'debug_last_fail.html');
            fs.writeFileSync(htmlPath, content);

            console.log(`[Puppeteer] Failed to find media. Screenshot saved to ${screenPath}. HTML saved to ${htmlPath}`);
            throw new Error("MEDIA_NOT_FOUND");
        }

        data.shortcode = data.shortcode || shortcode;
        return data;

    } catch (error) {
        console.error("[Puppeteer] Error:", error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

async function attemptLogin(page, username, password) {
    console.log(`[Puppeteer] Attempting login for ${username}...`);
    try {
        await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: 'networkidle2' });

        // Wait for login fields
        await page.waitForSelector('input[name="username"]', { timeout: 10000 });

        await page.type('input[name="username"]', username, { delay: 100 });
        await page.type('input[name="password"]', password, { delay: 100 });

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        const content = await page.content();
        if (content.includes("Login • Instagram") || content.includes("Welcome back to Instagram")) {
            throw new Error("Login failed - still on login page.");
        }

        console.log("[Puppeteer] Login successful. Saving fresh cookies...");
        const cookies = await page.cookies();
        saveCookiesAsNetscape(cookies);

    } catch (err) {
        console.error("[Puppeteer] Login attempt failed:", err.message);
        throw err;
    }
}

function saveCookiesAsNetscape(cookies) {
    const cookiesPath = path.join(__dirname, "cookies.txt");
    let header = "# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file!  Do not edit.\n\n";
    let content = cookies.map(c => {
        const domain = c.domain;
        const flag = domain.startsWith('.') ? "TRUE" : "FALSE";
        const path = c.path;
        const secure = c.secure ? "TRUE" : "FALSE";
        const expiration = Math.floor(c.expires || (Date.now() / 1000 + 86400 * 30));
        return `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${c.name}\t${c.value}`;
    }).join('\n');

    fs.writeFileSync(cookiesPath, header + content);
}

function parseCookies(fileContent) {
    const cookies = [];
    const lines = fileContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;
        const parts = line.split('\t');
        if (parts.length >= 7) {
            cookies.push({
                domain: parts[0],
                path: parts[2],
                secure: parts[3] === 'TRUE',
                expires: parseInt(parts[4]) || undefined,
                name: parts[5],
                value: parts[6].trim()
            });
        }
    }
    return cookies;
}
