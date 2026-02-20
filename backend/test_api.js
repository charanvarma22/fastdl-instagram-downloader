import axios from 'axios';
import "dotenv/config";

const API_KEY = process.env.RAPIDAPI_KEY || "4e730287ffmsh244dcbc9e1bb9acp183296jsnf43e89d8d3bb";
const HOST = "instagram-scraper-2022.p.rapidapi.com";
const TEST_SHORTCODE = "DU8NH_wEZM6"; // A valid reel shortcode

const endpoints = [
    { path: '/ig/post_info/', params: { shortcode: TEST_SHORTCODE } },
    { path: '/ig/info_2/', params: { url_post: `https://www.instagram.com/reel/${TEST_SHORTCODE}/` } },
    { path: '/ig/media_info/', params: { shortcode: TEST_SHORTCODE } },
    { path: '/media/info/', params: { shortcode: TEST_SHORTCODE } },
];

async function testEndpoints() {
    console.log(`🔍 Testing API Key: ${API_KEY.substring(0, 5)}...`);
    console.log(`🌐 Host: ${HOST}\n`);

    for (const ep of endpoints) {
        const url = `https://${HOST}${ep.path}`;
        try {
            console.log(`Testing ${ep.path}...`);
            const response = await axios.get(url, {
                params: ep.params,
                headers: {
                    'x-rapidapi-key': API_KEY,
                    'x-rapidapi-host': HOST
                }
            });
            console.log(`✅ SUCCESS: ${ep.path} [Status: ${response.status}]`);
            console.log(`   Data keys: ${Object.keys(response.data).join(', ')}\n`);
        } catch (error) {
            console.log(`❌ FAILED: ${ep.path}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status} - ${error.response.data?.message || error.response.statusText}\n`);
            } else {
                console.log(`   Error: ${error.message}\n`);
            }
        }
    }
}

testEndpoints();
