document.addEventListener("DOMContentLoaded", () => {
    const pasteBtn = document.getElementById("pasteBtn");
    const input = document.getElementById("url");
    console.log("pasteBtn found:", !!pasteBtn);
    console.log("input found:", !!input);
    if (pasteBtn && input) {
        pasteBtn.onclick = async () => {
            const t = await navigator.clipboard.readText().catch(() => "");
            input.value = t;
        };
        console.log("Paste button wired successfully");
    }
});
