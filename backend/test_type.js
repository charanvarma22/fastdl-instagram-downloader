
import axios from 'axios';

const url = "https://www.instagram.com/p/DU8Y_EYkcGc/";

async function test() {
    try {
        console.log(`Testing URL: ${url}`);
        const response = await axios.post('http://localhost:3001/api/preview', { url });
        console.log("Response Status:", response.status);
        console.log("Media Type:", response.data.type);
        console.log("Full Response:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

test();
