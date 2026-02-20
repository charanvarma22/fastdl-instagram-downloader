import axios from 'axios';
import "dotenv/config";

const API_KEY = process.env.RAPIDAPI_KEY || "4e730287ffmsh244dcbc9e1bb9acp183296jsnf43e89d8d3bb";
const HOST = process.env.RAPIDAPI_HOST || "instagram-scraper-2022.p.rapidapi.com";
const SHORTCODE = "DU8NH_wEZM6"; // Known working reel
const URL_POST = `https://www.instagram.com/p/${SHORTCODE}/`;

const tests = [
    { name: "info_2 + url_post", url: `https://${HOST}/ig/info_2/`, params: { url_post: URL_POST } },
    { name: "info_2 + shortcode", url: `https://${HOST}/ig/info_2/`, params: { shortcode: SHORTCODE } },
    { name: "media_info + shortcode", url: `https://${HOST}/ig/media_info/`, params: { shortcode: SHORTCODE } },
    { name: "media_info + url_post", url: `https://${HOST}/ig/media_info/`, params: { url_post: URL_POST } },
    { name: "post_details + shortcode", url: `https://${HOST}/ig/post_details/`, params: { shortcode: SHORTCODE } },
    { name: "post_info + shortcode", url: `https://${HOST}/ig/post_info/`, params: { shortcode: SHORTCODE } },
];

async function runProbe() {
    console.log(`🕵️ Running Final API Probe`);
    console.log(`🔑 Key: ${API_KEY.substring(0, 5)}...`);
    console.log(`🌐 Host: ${HOST}\n`);

    for (const test of tests) {
        process.stdout.write(`Testing ${test.name.padEnd(25)} ... `);
        try {
            const response = await axios.get(test.url, {
                params: test.params,
                headers: {
                    'x-rapidapi-key': API_KEY,
                    'x-rapidapi-host': HOST
                }
            });
            console.log(`✅ ${response.status} OK`);
            // console.log("   Keys:", Object.keys(response.data));
        } catch (err) {
            if (err.response) {
                console.log(`❌ ${err.response.status} - ${err.response.data?.message || err.response.statusText}`);
            } else {
                console.log(`❌ Error: ${err.message}`);
            }
        }
    }
}

runProbe();
