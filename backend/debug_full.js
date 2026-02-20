
import { fetchMediaByShortcode } from './igApi.js';
import { fetchMediaByShortcode as fetchViaPuppeteer } from './igPuppeteer.js';

// Test URLs from the user's reports
const tests = [
    { name: "Reel (User Example)", code: "DUr8bZdkalm" },
    { name: "Post (HD/Carousel Example)", code: "DUylfyoEx_" }
];

async function runDebug() {
    console.log("🔍 STARTING BACKEND DEBUG...");

    for (const t of tests) {
        console.log(`\n--- Testing ${t.name} (${t.code}) ---`);

        // 1. Test Combined API
        console.log("1. Testing Combined igApi.fetchMediaByShortcode...");
        try {
            const result = await fetchMediaByShortcode(t.code);
            console.log("✅ SUCCESS (Combined)");
            console.log("   - Media Type:", result.carousel_media?.length > 0 ? "Carousel" : result.video_versions?.length > 0 ? "Video" : "Image");
        } catch (err) {
            console.log("❌ FAILED (Combined)");
            console.log("   - Error:", err.message || err);
            if (err.originalError) console.log("   - Original Error Details:", err.originalError);
        }

        // 2. Test Puppeteer Directly (Verbosed)
        console.log("\n2. Testing Puppeteer Fallback Directly...");
        try {
            const pResult = await fetchViaPuppeteer(t.code);
            console.log("✅ SUCCESS (Puppeteer)");
            console.log("   - Items found:", pResult.carousel_media?.length || (pResult.video_versions?.length || pResult.image_versions2?.candidates?.length ? 1 : 0));
        } catch (pErr) {
            console.log("❌ FAILED (Puppeteer)");
            console.log("   - Error:", pErr.message);
        }
    }

    process.exit(0);
}

runDebug();
