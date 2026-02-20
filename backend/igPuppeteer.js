import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
                '--disable-dev-shm-usage'
            ]
        });
        const page = await browser.newPage();

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

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait a bit for potential JS execution
        await new Promise(r => setTimeout(r, 2000));

        // Extract deep JSON data
        const data = await page.evaluate(() => {
            const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content;

            // Attempt to find the deep JSON data
            let mediaData = null;

            // 1. Check window.__additionalDataLoaded
            if (window.__additionalDataLoaded) {
                for (const key in window.__additionalDataLoaded) {
                    if (window.__additionalDataLoaded[key]?.graphql?.shortcode_media) {
                        mediaData = window.__additionalDataLoaded[key].graphql.shortcode_media;
                        break;
                    }
                }
            }

            // 2. Check window._sharedData
            if (!mediaData && window._sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media) {
                mediaData = window._sharedData.entry_data.PostPage[0].graphql.shortcode_media;
            }

            // 3. Scan script tags for JSON
            if (!mediaData) {
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    if (s.innerText.includes('xdt_api__v1__media__shortcode__web_info')) {
                        try {
                            const match = s.innerText.match(/\{.*\}/);
                            if (match) {
                                const parsed = JSON.parse(match[0]);
                                if (parsed?.xdt_api__v1__media__shortcode__web_info?.items?.[0]) {
                                    mediaData = parsed.xdt_api__v1__media__shortcode__web_info.items[0];
                                }
                            }
                        } catch (e) { }
                    }
                }
            }

            const result = {
                id: 'puppeteer_' + Date.now(),
                shortcode: '',
                media_type: 1,
                image_versions2: { candidates: [] },
                video_versions: [],
                carousel_media: [],
                derived_from_html: true
            };

            if (mediaData) {
                result.shortcode = mediaData.shortcode || mediaData.code;

                const getBestImage = (node) => {
                    if (node.display_resources && node.display_resources.length > 0) {
                        return node.display_resources.reduce((prev, current) => (prev.config_width > current.config_width) ? prev : current).src;
                    }
                    return node.display_url || node.image_versions2?.candidates?.[0]?.url;
                };

                // Handle Carousel
                const children = mediaData.edge_sidecar_to_children?.edges || mediaData.carousel_media;
                if (children && children.length > 0) {
                    result.carousel_media = children.map(edge => {
                        const node = edge.node || edge;
                        return {
                            video_versions: (node.is_video || node.video_versions?.length > 0) ? [{ url: node.video_url || node.video_versions?.[0]?.url }] : [],
                            image_versions2: { candidates: [{ url: getBestImage(node) }] }
                        };
                    });
                }

                // Handle Single
                if (mediaData.is_video || mediaData.video_versions?.length > 0) {
                    result.media_type = 2;
                    result.video_versions.push({ url: mediaData.video_url || mediaData.video_versions?.[0]?.url });
                }

                // Prioritize Best Display Resource for HD
                const bestImg = getBestImage(mediaData) || getMeta('og:image');
                if (bestImg) {
                    result.image_versions2.candidates.push({ url: bestImg });
                }

            } else {
                // LAST FALLBACK: OpenGraph
                const imageUrl = getMeta('og:image');
                const videoUrl = getMeta('og:video');
                if (imageUrl) result.image_versions2.candidates.push({ url: imageUrl });
                if (videoUrl) {
                    result.media_type = 2;
                    result.video_versions.push({ url: videoUrl });
                }
            }

            return result;
        });

        if (!data.image_versions2.candidates.length && !data.video_versions.length && !data.carousel_media.length) {
            const content = await page.content();
            if (content.includes("Login • Instagram") || content.includes("Welcome back to Instagram")) {
                throw new Error("LOGIN_REQUIRED");
            }
            // Save debug screenshot
            const screenPath = path.join(__dirname, 'debug_last_fail.png');
            await page.screenshot({ path: screenPath });
            console.log(`[Puppeteer] Failed to find media. Screenshot saved to ${screenPath}`);
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

function parseCookies(fileContent) {
    const cookies = [];
    const lines = fileContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;
        const parts = line.split('\t');
        if (parts.length >= 7) {
            // Netscape format
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
