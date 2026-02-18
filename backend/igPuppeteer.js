
import puppeteer from 'puppeteer';

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
            ]
        });
        const page = await browser.newPage();

        // essential: Set a real user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const url = `https://www.instagram.com/p/${shortcode}/`;
        console.log(`[Puppeteer] Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

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
                caption: { text: title || description || '' }
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
            } else if (type && type.includes('video')) {
                // Try to find video tag if meta is missing but type says video
                const videoTag = document.querySelector('video');
                if (videoTag && videoTag.src) {
                    result.media_type = 2;
                    result.video_versions.push({
                        url: videoTag.src,
                        width: 1080,
                        height: 1080,
                        type: 101
                    });
                }
            }

            return result;
        });

        if (!data.image_versions2.candidates.length && !data.video_versions.length) {
            // Check for private account or login redirect
            const content = await page.content();
            if (content.includes("Login • Instagram") || content.includes("Welcome back to Instagram")) {
                throw new Error("LOGIN_REQUIRED");
            }
            throw new Error("MEDIA_NOT_FOUND_OR_PRIVATE");
        }

        console.log(`[Puppeteer] Successfully extracted data. Video? ${data.video_versions.length > 0}`);
        return data;

    } catch (error) {
        console.error("[Puppeteer] Error:", error.message);
        if (browser) {
            const pages = await browser.pages();
            if (pages.length > 0) {
                await pages[0].screenshot({ path: 'error_screenshot.png', fullPage: true });
                console.log("[Puppeteer] Saved error_screenshot.png");
            }
        }
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
