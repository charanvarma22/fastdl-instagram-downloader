const API_BASE = "http://localhost:3001";

async function _downloadMedia(url) {
    const res = await fetch(`${API_BASE}/api/download`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
    });

    return res;
}

async function _previewMedia(url) {
    const res = await fetch(`${API_BASE}/api/preview`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
    });

    return res;
}

window.downloadMedia = _downloadMedia;
window.previewMedia = _previewMedia;
