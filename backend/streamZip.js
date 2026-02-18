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

        if (item.video_versions) {
            url = item.video_versions[0].url;
            ext = "mp4";
        } else if (item.image_versions2) {
            url = item.image_versions2.candidates[0].url;
            ext = "jpg";
        } else continue;

        const stream = await axios.get(url, { responseType: "stream" });
        archive.append(stream.data, { name: `media_${i}.${ext}` });
        i++;
    }

    await archive.finalize();
}
