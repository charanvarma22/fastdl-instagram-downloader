import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_URL = "https://www.instagram.com/p/DUnoaMtjXUZ/"; // User's failing Post

console.log(`🔍 Debugging Post: ${TEST_URL}`);

const args = ["--dump-json", "--no-warnings", "--no-playlist", TEST_URL];

// Path to cookies.txt
const cookiesPath = path.join(__dirname, "cookies.txt");
if (fs.existsSync(cookiesPath)) {
    console.log("🍪 Found cookies.txt");
    args.push("--cookies", cookiesPath);
} else if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
    console.log("🔐 Using Env Credentials");
    args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
} else {
    console.log("⚠️ No credentials found. Using Anonymous.");
}

const ytDlp = spawn("yt-dlp", args);

let stdoutData = "";
let stderrData = "";

ytDlp.stdout.on("data", (data) => {
    stdoutData += data.toString();
});

ytDlp.stderr.on("data", (data) => {
    stderrData += data.toString();
    console.error("Stderr:", data.toString());
});

ytDlp.on("close", (code) => {
    console.log(`\nProcess exited with code: ${code}`);

    if (code === 0) {
        try {
            const json = JSON.parse(stdoutData);
            console.log("\n✅ JSON Parsed Successfully:");
            console.log("Type:", json._type);
            console.log("Ext:", json.ext);
            console.log("Formats:", json.formats ? json.formats.length : "None");
            console.log("Entries:", json.entries ? json.entries.length : "None");
            console.log("Thumbnail:", json.thumbnail);

            // Dump full keys to see what we have
            console.log("\nKeys:", Object.keys(json));

        } catch (e) {
            console.error("❌ Failed to parse JSON:", e.message);
            console.log("Raw Output (truncated):", stdoutData.slice(0, 500));
        }
    } else {
        console.error("❌ yt-dlp failed.");
    }
});
