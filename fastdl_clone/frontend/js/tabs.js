import { titles } from "./state.js";

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const k = tab.dataset.type;
        document.getElementById("title").innerText = titles[k][0];
        document.getElementById("subtitle").innerText = titles[k][1];
        document.title = titles[k][0] + " – FastDL";
    });
});
