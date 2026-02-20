import archiver from "archiver";
import axios from "axios";

export async function streamZip(items, res) {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=carousel.zip");

    const archive = archiver("zip");
    archive.pipe(res);

    let i = 1;

    for (const item of items) {
        let url, ext;

        if (item.video_versions && item.video_versions.length > 0) {
            url = item.video_versions[0].url;
            ext = "mp4";
        } else if (item.image_versions2 && item.image_versions2.candidates && item.image_versions2.candidates.length > 0) {
            url = item.image_versions2.candidates[0].url;
            ext = "jpg";
        } else continue;

        try {
            const response = await axios.get(url, {
                responseType: "stream",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://www.instagram.com/",
                    "Accept": "*/*"
                },
                timeout: 20000
            });
            archive.append(response.data, { name: `media_${i}.${ext}` });
            i++;
        } catch (err) {
            console.error(`⚠️ Carousel Item ${i} Failed:`, err.message);
            // Continue to next item so zip isn't broken
        }
    }

    await archive.finalize();
}
