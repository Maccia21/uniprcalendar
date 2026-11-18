// Loads the static course catalog (public/data/catalog.json) once per page.
(function () {
    let pending = null;
    window.loadCatalog = function () {
        if (!pending) {
            pending = fetch("/data/catalog.json", { cache: "no-cache" }).then(function (r) {
                if (!r.ok) throw new Error("catalog " + r.status);
                return r.json();
            });
        }
        return pending;
    };
    window.findCourse = function (catalog, code) {
        return catalog.corsi.find(function (c) { return c.code === code; }) || null;
    };
    window.addOption = function (select, value, label) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
        return option;
    };
})();
