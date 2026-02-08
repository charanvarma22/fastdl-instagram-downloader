const grid = document.getElementById("searchGrid");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const progressBox = document.getElementById("progressBox");

document.getElementById("downloadBtn").addEventListener("click", () => {
  grid.innerHTML = `
    <div class="preview-card"><img src="https://placehold.co/300x300"/></div>
    <div class="preview-card"><img src="https://placehold.co/300x300"/></div>
    <div class="preview-card"><img src="https://placehold.co/300x300"/></div>
  `;

  progressBox.style.display = "block";
  let p = 0;
  const t = setInterval(() => {
    p += 5;
    progressFill.style.width = p + "%";
    progressText.innerText = p + "%";
    if (p >= 100) clearInterval(t);
  }, 120);
});
