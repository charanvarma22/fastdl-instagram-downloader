import axios from 'axios';
import "dotenv/config";

const API_KEY = process.env.RAPIDAPI_KEY || "4e730287ffmsh244dcbc9e1bb9acp183296jsnf43e89d8d3bb";
// const HOST = "instagram-scraper-2022.p.rapidapi.com";
const HOST = process.env.RAPIDAPI_HOST || "instagram-scraper-2022.p.rapidapi.com";

const TEST_SHORTCODE = "DU8dSUNj36J"; // The one failing in the screenshot

async function testSpecific() {
    console.log(`🔍 Testing Specific Shortcode: ${TEST_SHORTCODE}`);
    console.log(`🔑 Key: ${API_KEY.substring(0, 5)}...`);
    console.log(`🌐 Host: ${HOST}`);

    const url = `https://${HOST}/ig/info_2/`;
    const params = { url_post: `https://www.instagram.com/p/${TEST_SHORTCODE}/` };

    try {
        console.log(`\nREQUEST: ${url}`);
        console.log(`PARAMS:`, params);

        const response = await axios.get(url, {
            params: params,
            headers: {
                'x-rapidapi-key': API_KEY,
                'x-rapidapi-host': HOST
            }
        });

        console.log(`\n✅ SUCCESS [${response.status}]`);
        // console.log(JSON.stringify(response.data, null, 2));
        console.log("Keys:", Object.keys(response.data));
    } catch (error) {
        console.log(`\n❌ FAILED`);
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Data:`, error.response.data);
            console.log(`Headers:`, error.response.headers);
        } else {
            console.log(`Error: ${error.message}`);
        }
    }
}

testSpecific();
