import { spawn } from "child_process";
import "dotenv/config";

const TEST_URL = "https://www.instagram.com/reel/DU5LbxNAcpl/"; // User's failing link

console.log("🔍 Testing yt-dlp execution...");
console.log("--------------------------------");
console.log(`URL: ${TEST_URL}`);
console.log(`USER: ${process.env.IG_USERNAME || "Not set (Anonymous)"}`);
console.log(`PASS: ${process.env.IG_PASSWORD ? "******" : "Not set"}`);

const args = ["--dump-json", "--no-warnings", "--no-playlist", TEST_URL];

if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
    console.log("🔐 Using Credentials...");
    args.push("-u", process.env.IG_USERNAME, "-p", process.env.IG_PASSWORD);
} else {
    console.log("🕵️ Using Anonymous Mode...");
}

console.log(`\nRunning command: yt-dlp ${args.join(" ")}\n`);

const ytDlp = spawn("yt-dlp", args);

let stdoutData = "";
let stderrData = "";

ytDlp.stdout.on("data", (data) => {
    stdoutData += data.toString();
    // process.stdout.write(data); // Don't dump invalid JSON to terminal
});

ytDlp.stderr.on("data", (data) => {
    stderrData += data.toString();
    process.stderr.write(data); // Dump stderr to terminal
});

ytDlp.on("close", (code) => {
    console.log(`\n--------------------------------`);
    console.log(`Process exited with code: ${code}`);

    if (code === 0) {
        console.log("✅ SUCCESS! JSON received.");
        try {
            const json = JSON.parse(stdoutData);
            console.log("Title:", json.title);
            console.log("URL:", json.url);
        } catch (e) {
            console.log("❌ Failed to parse JSON even though code was 0.");
        }
    } else {
        console.log("❌ FAILURE.");
        console.log("Full Stderr:", stderrData);
    }
});
