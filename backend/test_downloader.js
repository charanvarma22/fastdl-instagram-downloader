
import { fetchMediaByShortcode } from "./igApi.js";

async function test() {
    try {
        console.log("Testing downloader with shortcode: DQ4R4FICgXI");
        const shortcode = "DQ4R4FICgXI"; // From screenshot
        const media = await fetchMediaByShortcode(shortcode);
        console.log("Success! Media found:", media.id);
        console.log("Media type:", media.media_type);
    } catch (error) {
        console.error("Error:", error);
        if (error.code) console.error("Error Code:", error.code);
        if (error.message) console.error("Error Message:", error.message);
    }
}

test();
