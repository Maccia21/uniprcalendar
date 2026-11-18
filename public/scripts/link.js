// Link page: build the subscription URL (same host as this site) for Google and Apple.
document.addEventListener("DOMContentLoaded", function () {
    const query = window.location.search.substring(1);
    const params = new URLSearchParams(query);
    if (!params.get("aa") || !params.get("c") || !params.get("a")) {
        document.getElementById("link-error").classList.remove("d-none");
        document.getElementById("box").classList.add("d-none");
        document.getElementById("raw-link-box").classList.add("d-none");
        return;
    }
    const httpsUrl = window.location.origin + "/ics?" + query;
    const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");

    document.getElementById("raw-link").textContent = httpsUrl;

    document.getElementById("google-button").addEventListener("click", function (event) {
        event.preventDefault();
        const open = function () { window.open(this.href, "_blank"); }.bind(this);
        if (navigator.clipboard) navigator.clipboard.writeText(httpsUrl).then(open, open);
        else open();
    });

    const apple = document.getElementById("apple-button");
    apple.href = webcalUrl;
});
