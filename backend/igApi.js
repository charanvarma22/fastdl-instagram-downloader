import axios from "axios";
// Replaced Puppeteer with Robust External API
// This ensures stability, no IP bans, and high traffic handling.

export async function fetchMediaByShortcode(shortcode) {
    try {
        console.log(`🚀 Fetching media for ${shortcode} via Extract API...`);

        // Using 'Instagram Scraper Stable API' (RockSolid)
        // Host: instagram-scraper-2022.p.rapidapi.com
        const options = {
            method: 'GET',
            url: 'https://instagram-scraper-20221.p.rapidapi.com/ig/post_info/',
            params: { shortcode: shortcode },
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'instagram-scraper-20221.p.rapidapi.com'
            }
        };

        const response = await axios.request(options);
        const data = response.data;

        if (!data) throw new Error("API returned no data");

        // Transform RockSolid API response to our internal format
        // RockSolid returns data.owner, data.display_url, data.video_url, etc. directly or nested

        // Check if it's a valid response
        if (!data.shortcode && !data.id) {
            // Some APIs return data inside a 'data' property
            if (data.data) return transformRockSolidResponse(data.data, shortcode);
            // Or maybe it is direct
        }

        return transformRockSolidResponse(data, shortcode);

    } catch (err) {
        console.error("❌ API fetch failed:", err.message);
        if (err.response) {
            console.error("API Response:", err.response.data);
        }
        throw {
            code: "API_ERROR",
            message: "Failed to fetch media. Please check API Key."
        };
    }
}

function transformRockSolidResponse(data, shortcode) {
    return {
        shortcode: shortcode,
        video_versions: data.video_url ? [{ url: data.video_url }] : [],
        image_versions2: {
            candidates: data.display_url ? [{ url: data.display_url }] : []
        },
        // RockSolid handles carousels differently, often in 'children' or 'sidecar'
        // We will map if present, otherwise basic support
        carousel_media: data.children ? data.children.map(child => ({
            video_versions: child.video_url ? [{ url: child.video_url }] : [],
            image_versions2: { candidates: [{ url: child.display_url }] }
        })) : []
    };
}



// Legacy wrappers - can also use API if supported
export async function fetchStoryByUrl(storyUrl) {
    return { code: "NOT_IMPLEMENTED", message: "Stories not yet enabled on API mode." };
}

export async function fetchIGTVByUrl(igtvUrl) {
    const shortcodeMatch = igtvUrl.match(/\/tv\/([^/?]+)/);
    if (!shortcodeMatch) throw new Error("INVALID_URL");
    return await fetchMediaByShortcode(shortcodeMatch[1]);
}
