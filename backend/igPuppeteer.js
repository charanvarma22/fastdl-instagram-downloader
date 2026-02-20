import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function fetchMediaByShortcode(shortcode) {
    let browser = null;
    try {
        console.log(`[Puppeteer] Launching browser for shortcode: ${shortcode}`);
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
                    console.log(`[Puppeteer] Loading ${cookies.length} cookies...`);
                    await page.setCookie(...cookies);
                }
            } catch (e) {
                console.error("[Puppeteer] Failed to load cookies:", e.message);
            }
        }

        const url = `https://www.instagram.com/p/${shortcode}/`;
        console.log(`[Puppeteer] Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for key elements to ensure page load (or valid 404)
        try {
            await page.waitForSelector('meta[property="og:image"]', { timeout: 10000 });
        } catch (e) {
            console.log("[Puppeteer] Meta tag not found immediately, checking page content...");
        }

        // Extract OpenGraph data
        const data = await page.evaluate(() => {
            const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content;

            const type = getMeta('og:type');
            const videoUrl = getMeta('og:video');
            const videoSecureUrl = getMeta('og:video:secure_url');
            const imageUrl = getMeta('og:image');
            const title = getMeta('og:title');
            const description = getMeta('og:description');

            const result = {
                id: 'puppeteer_scraped_' + Date.now(),
                code: 'unknown',
                media_type: 1, // Default to image
                image_versions2: { candidates: [] },
                video_versions: [],
                carousel_media: [],
                caption: { text: title || description || '' },
                derived_from_html: true // Forces resolver to stream direct URL
            };

            if (imageUrl) {
                result.image_versions2.candidates.push({ url: imageUrl, width: 1080, height: 1080 });
            }

            if (videoUrl || videoSecureUrl) {
                result.media_type = 2; // Video
                result.video_versions.push({
                    url: videoUrl || videoSecureUrl,
                    width: 1080,
                    height: 1080,
                    type: 101
                });
            }

            return result;
        });

        // Add Shortcode to result
        data.shortcode = shortcode;

        if (!data.image_versions2.candidates.length && !data.video_versions.length) {
            // Check for private account or login redirect
            const content = await page.content();
            if (content.includes("Login • Instagram") || content.includes("Welcome back to Instagram")) {
                throw new Error("LOGIN_REQUIRED");
            }
            // Take screenshot for debug if failing
            // await page.screenshot({ path: 'debug_fail.png' });
            throw new Error("MEDIA_NOT_FOUND_OR_PRIVATE");
        }

        console.log(`[Puppeteer] Successfully extracted data. Video? ${data.video_versions.length > 0}`);
        return data;

    } catch (error) {
        console.error("[Puppeteer] Error:", error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
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
