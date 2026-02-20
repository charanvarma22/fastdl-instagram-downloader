import axios from "axios";
// Replaced Puppeteer with Robust External API
// This ensures stability, no IP bans, and high traffic handling.

export async function fetchMediaByShortcode(shortcode) {
    const retries = 3;
    let lastError = null;

    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🚀 Fetching media for ${shortcode} via Extract API (Attempt ${i + 1}/${retries})...`);

            // Using 'Instagram Scraper Stable API' (RockSolid)
            // Host: instagram-scraper-2022.p.rapidapi.com
            const options = {
                method: 'GET',
                url: 'https://instagram-scraper-2022.p.rapidapi.com/ig/info_2/',
                params: { url_post: `https://www.instagram.com/p/${shortcode}/` },
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': process.env.RAPIDAPI_HOST || 'instagram-scraper-2022.p.rapidapi.com'
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
            lastError = err;
            console.error(`❌ Attempt ${i + 1} failed:`, err.message);

            if (err.response) {
                console.error("API Response Status:", err.response.status);
                // If Rate Limited (429), wait and retry
                if (err.response.status === 429) {
                    console.warn("⚠️ Rate Limit Detected. Waiting 2s...");
                    await new Promise(res => setTimeout(res, 2000 * (i + 1))); // Exponential backoff
                    continue;
                }
                // If 404, it might be private or deleted, don't retry
                if (err.response.status === 404) break;
            } else {
                // Network error, maybe retry?
                await new Promise(res => setTimeout(res, 1000));
            }
        }
    }

    // If we are here, all retries failed
    console.error("❌ All API fetch attempts failed.");

    let userMessage = "Failed to fetch media. Please check API Key.";
    if (lastError?.response?.status === 429) {
        userMessage = "Server busy (Rate Limit). Please try again in a moment.";
    } else if (lastError?.response?.status === 404) {
        userMessage = "Post not found or private.";
    }

    throw {
        code: "API_ERROR",
        message: userMessage,
        originalError: lastError?.message
    };
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
