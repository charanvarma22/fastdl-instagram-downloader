// Wire download button directly (don't wait for DOMContentLoaded)
function wireDownloadButton() {
    const downloadBtn = document.getElementById("downloadBtn");
    if (!downloadBtn) {
        console.warn("downloadBtn not found yet, retrying...");
        setTimeout(wireDownloadButton, 100);
        return;
    }

    console.log("✓ downloadBtn found");
    console.log("✓ downloadMedia available:", typeof window.downloadMedia);

    downloadBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const input = document.getElementById("url");

        console.log("====== DOWNLOAD CLICK ======");
        console.log("Input element found:", !!input);
        console.log("Input element:", input);
        console.log("Input value (raw):", JSON.stringify(input?.value));
        console.log("Input value (length):", input?.value?.length);

        const url = input?.value?.trim();
        console.log("URL after trim:", JSON.stringify(url));
        console.log("URL is empty?:", !url);

        if (!url) {
            console.warn("No URL provided, showing alert");
            alert("Paste a link first");
            return;
        }

        if (typeof window.downloadMedia !== "function") {
            alert("Download function not available. Backend not running?");
            return;
        }

        try {
            console.log("→ Calling backend with URL:", url);
            const res = await window.downloadMedia(url);
            console.log("← Response:", res.status, res.statusText);

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert("Error: " + (err.error || "Unknown error"));
                return;
            }

            const blob = await res.blob();
            const cd = res.headers.get("content-disposition") || "";
            let filename = "download";
            const match = cd.match(/filename[^;=\n]*=(["\']?)([^"\';\n]*)\1/);
            if (match) filename = match[2];

            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);

            alert("Downloaded: " + filename);

        } catch (err) {
            console.error("Download failed:", err);
            alert("Download failed: " + err.message);
        }
    });
}

// Auto-fetch when URL is pasted
function wireAutoFetch() {
    const input = document.getElementById("url");
    if (!input) {
        setTimeout(wireAutoFetch, 100);
        return;
    }

    input.addEventListener("paste", async (e) => {
        setTimeout(async () => {
            const url = input.value?.trim();
            if (url && isValidInstagramUrl(url)) {
                await autoFetchMedia(url);
            }
        }, 100);
    });

    input.addEventListener("change", async () => {
        const url = input.value?.trim();
        if (url && isValidInstagramUrl(url)) {
            await autoFetchMedia(url);
        }
    });
}

function isValidInstagramUrl(url) {
    return url.includes("instagram.com") && (url.includes("/p/") || url.includes("/reel/") || url.includes("/tv/") || url.includes("/stories/"));
}

async function autoFetchMedia(url) {
    console.log("🔍 Auto-fetching media from:", url);

    if (typeof window.previewMedia !== "function") {
        console.error("previewMedia not available");
        return;
    }

    const searchSection = document.getElementById("searchResultSection");
    const searchGrid = document.getElementById("searchGrid");
    const downloadAllContainer = document.getElementById("downloadAllContainer");

    // Clear previous results and show loading
    searchGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Loading...</div>';
    downloadAllContainer.innerHTML = "";
    searchSection.style.display = "block";

    // Auto-scroll to search results
    setTimeout(() => {
        searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    try {
        const res = await window.previewMedia(url);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("Backend error:", err.error);
            searchGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: red;">Error: ' + (err.error || "Failed to fetch") + '</div>';
            return;
        }

        const data = await res.json();
        console.log("📦 Received preview data:", data);

        // Clear loading
        searchGrid.innerHTML = "";

        // Display grid of items
        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                const card = document.createElement("div");
                card.className = "media-card";

                let overlay = "";
                if (item.type === "video") {
                    overlay = '<div class="media-overlay"><svg class="play-icon" viewBox="0 0 24 24"><path fill="white" d="M8 5v14l11-7z"></path></svg><svg class="fullscreen-icon" viewBox="0 0 24 24"><path fill="white" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg></div>';
                } else {
                    overlay = '<div class="media-overlay"><svg class="fullscreen-icon" viewBox="0 0 24 24"><path fill="white" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg></div>';
                }

                card.innerHTML = `
                    <img src="${item.thumbnail}" class="media-thumbnail" alt="media" style="width:100%;height:200px;object-fit:cover;">
                    ${overlay}
                `;

                searchGrid.appendChild(card);

                // Attach overlay click handler for zoom/play
                const overlay_el = card.querySelector(".media-overlay");
                if (overlay_el) {
                    overlay_el.addEventListener("click", (e) => {
                        e.stopPropagation();
                        openMediaModal(item.mediaUrl || item.thumbnail, item.type);
                    });
                }
            });

            // Add "Download All" button only for carousels (append to downloadAllContainer, not searchSection)
            if (data.type === "carousel" && data.items.length > 1) {
                downloadAllContainer.innerHTML = '<div style="text-align: center; padding: 30px 0;"><button class="download-all-btn" style="padding: 12px 30px; background: linear-gradient(135deg, #7B3FE4, #E91E63); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">📦 Download All as ZIP</button></div>';

                downloadAllContainer.querySelector(".download-all-btn").addEventListener("click", async () => {
                    await downloadAllAsZip(url);
                });
            }
        }

    } catch (err) {
        console.error("Auto-fetch failed:", err);
        searchGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: red;">Error: ' + err.message + '</div>';
    }
}

function openMediaModal(src, type) {
    const modal = document.getElementById("mediaModal");
    const container = document.getElementById("modalMediaContainer");

    if (type === "video") {
        container.innerHTML = `<video controls style="width:100%; height:auto; max-height:85vh;"><source src="${src}" type="video/mp4"></video>`;
    } else {
        container.innerHTML = `<img src="${src}" alt="media" style="width:100%; height:auto; max-height:85vh;">`;
    }

    modal.style.display = "flex";

    // Close modal on close button click
    const closeBtn = modal.querySelector(".modal-close");
    closeBtn.onclick = () => {
        modal.style.display = "none";
    };

    // Close modal on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    };
}

async function downloadAllAsZip(url) {
    if (typeof window.downloadMedia !== "function") {
        alert("Download function not available");
        return;
    }

    try {
        console.log("📦 Downloading all as ZIP:", url);
        // Fixed port to 3001
        const res = await fetch("http://localhost:3001/api/download", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert("Download failed: " + (err.error || "Unknown error"));
            return;
        }

        const blob = await res.blob();
        const cd = res.headers.get("content-disposition") || "";
        const filename = cd.match(/filename[^;=\n]*=(["\']?)([^"\';\n]*)\1/)?.[2] || "carousel.zip";

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);

        alert("Downloaded: " + filename);
    } catch (err) {
        console.error("Download failed:", err);
        alert("Download failed: " + err.message);
    }
}

// Start wiring immediately
wireDownloadButton();
wireAutoFetch();
