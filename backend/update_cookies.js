
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonCookies = [
    {
        "domain": ".instagram.com",
        "expirationDate": 1806138260.93336,
        "hostOnly": false,
        "httpOnly": false,
        "name": "csrftoken",
        "path": "/",
        "sameSite": "unspecified",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "uXBMzd74sxltJdMxjkg2gRN3vGELo23R",
        "id": 1
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1806128609.271806,
        "hostOnly": false,
        "httpOnly": true,
        "name": "datr",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "4f2XaWS2ui3dwrRla2H8tDWi",
        "id": 2
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1772178858,
        "hostOnly": false,
        "httpOnly": false,
        "name": "dpr",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "1.25",
        "id": 3
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1779354260.933621,
        "hostOnly": false,
        "httpOnly": false,
        "name": "ds_user_id",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "80611515070",
        "id": 4
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1803104609.272012,
        "hostOnly": false,
        "httpOnly": true,
        "name": "ig_did",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "3CE475CA-8F7D-44D5-883A-4931BFB00091",
        "id": 5
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1772175570.964729,
        "hostOnly": false,
        "httpOnly": true,
        "name": "ig_direct_region_hint",
        "path": "/",
        "sameSite": "unspecified",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "\"ODN\\05480611515070\\0541803106770:01fef3e5707ebe08ff37a05cbde42c96ea4b1b7e7b14ed1b9553df7b673d74578b2ecb66\"",
        "id": 6
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1806128629,
        "hostOnly": false,
        "httpOnly": false,
        "name": "mid",
        "path": "/",
        "sameSite": "unspecified",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "aZf94QALAAGp7okF2oHQKMvl80-a",
        "id": 7
    },
    {
        "domain": ".instagram.com",
        "hostOnly": false,
        "httpOnly": true,
        "name": "rur",
        "path": "/",
        "sameSite": "lax",
        "secure": true,
        "session": true,
        "storeId": "0",
        "value": "\"ODN\\05480611515070\\0541803114260:01fe601337f2da8a620d89f84706e7e9fcd5e7b3b0526609a7490e90d351364678a41586\"",
        "id": 8
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1803110909.748293,
        "hostOnly": false,
        "httpOnly": true,
        "name": "sessionid",
        "path": "/",
        "sameSite": "unspecified",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "80611515070%3AntrnzEUj94qPMs%3A27%3AAYh_VWvi8jrHwFAZd3qlH6NwF6bfre15je1UurIW0g",
        "id": 9
    },
    {
        "domain": ".instagram.com",
        "expirationDate": 1772178858,
        "hostOnly": false,
        "httpOnly": false,
        "name": "wd",
        "path": "/",
        "sameSite": "lax",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "1536x730",
        "id": 10
    }
];

function convertToNetscape(cookies) {
    let header = "# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file!  Do not edit.\n\n";
    let content = cookies.map(c => {
        const flag = c.domain.startsWith('.') ? "TRUE" : "FALSE";
        const secure = c.secure ? "TRUE" : "FALSE";
        const expiration = Math.floor(c.expirationDate || 0);
        return `${c.domain}\t${flag}\t${c.path}\t${secure}\t${expiration}\t${c.name}\t${c.value}`;
    }).join('\n');
    return header + content;
}

const netscapeString = convertToNetscape(jsonCookies);
const outputPath = path.join(__dirname, 'cookies.txt');

fs.writeFileSync(outputPath, netscapeString);
console.log(`✅ Successfully updated cookies.txt at ${outputPath}`);
