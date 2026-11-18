// Light/dark switch: follows the device until the user picks one, then remembers it.
(function () {
    const KEY = "uniprcalendar-theme";
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

    function current() {
        const forced = root.getAttribute("data-theme");
        if (forced) return forced;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function paint(button) {
        const dark = current() === "dark";
        button.textContent = dark ? "☀️" : "🌙";
        button.setAttribute("aria-label", dark ? "Passa al tema chiaro" : "Passa al tema scuro");
        button.title = button.getAttribute("aria-label");
    }

    document.addEventListener("DOMContentLoaded", function () {
        const button = document.getElementById("theme-toggle");
        if (!button) return;
        paint(button);
        button.addEventListener("click", function () {
            const next = current() === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
            paint(button);
        });
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { paint(button); });
    });
})();
