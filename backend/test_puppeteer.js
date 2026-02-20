
import puppeteer from 'puppeteer';

(async () => {
    console.log("🧪 Testing Puppeteer Launch...");
    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        console.log("✅ Browser launched successfully!");

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log("Navigation check...");
        await page.goto('https://example.com');
        console.log("✅ Navigation successful!");

        await browser.close();
        console.log("🎉 Puppeteer is working correctly.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Puppeteer Failed:", error);
        console.error("\nPOSSIBLE FIXES:");
        console.error("1. Did you run './install_puppeteer_deps.sh'?");
        console.error("2. Is the server running out of memory?");
        process.exit(1);
    }
})();
