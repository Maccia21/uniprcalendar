// Home: Dipartimento -> Corso -> Anno -> Curriculum, same flow as UniboCalendar.
const LOW_CONNECTION_MS = 5000;

document.addEventListener("DOMContentLoaded", function () {
    const areas = document.getElementById("areas");
    const courses = document.getElementById("courses");
    const years = document.getElementById("years");
    const curricula = document.getElementById("curricula");
    const submit = document.getElementById("submit-form-button");
    const lowConnection = document.getElementById("low-connection");
    const notAvailable = document.getElementById("not-available");
    let catalog = null;

    const slowTimer = setTimeout(function () { lowConnection.style.display = "block"; }, LOW_CONNECTION_MS);

    function reset(select, placeholder) {
        select.innerHTML = "";
        if (placeholder) addOption(select, "", placeholder);
    }

    function selectedCurriculum() {
        const course = findCourse(catalog, courses.value);
        if (!course) return null;
        return course.anni.find(function (a) { return a.value === curricula.value; }) || null;
    }

    function checkFormValidity() {
        const curriculum = catalog ? selectedCurriculum() : null;
        const unavailable = curriculum !== null && curriculum.disponibile === false;
        notAvailable.style.display = unavailable ? "block" : "none";
        submit.disabled = !(areas.value && courses.value && years.value && curriculum && !unavailable);
    }

    function fillCourses() {
        reset(courses, "Seleziona il corso");
        reset(years);
        reset(curricula);
        catalog.corsi
            .filter(function (c) { return c.dip === areas.value; })
            .sort(function (a, b) {
                return a.tipo === b.tipo ? a.label.localeCompare(b.label, "it") : a.tipo.localeCompare(b.tipo, "it");
            })
            .forEach(function (c) { addOption(courses, c.code, c.code + " - " + c.label + " - " + c.tipo); });
    }

    function fillYears() {
        reset(years, "Seleziona l'anno");
        reset(curricula);
        const course = findCourse(catalog, courses.value);
        if (!course) return;
        const unique = Array.from(new Set(course.anni.map(function (a) { return a.year; }))).sort(function (a, b) { return a - b; });
        unique.forEach(function (y) { addOption(years, String(y), String(y)); });
    }

    function fillCurricula() {
        reset(curricula, "Seleziona il curriculum");
        const course = findCourse(catalog, courses.value);
        if (!course || !years.value) return;
        const options = course.anni.filter(function (a) { return String(a.year) === years.value; });
        options.forEach(function (a) {
            addOption(curricula, a.value, a.label + (a.disponibile === false ? " (orario non disponibile)" : ""));
        });
        if (options.length === 1) curricula.selectedIndex = 1;
    }

    areas.addEventListener("change", function () { fillCourses(); checkFormValidity(); });
    courses.addEventListener("change", function () { fillYears(); checkFormValidity(); });
    years.addEventListener("change", function () { fillCurricula(); checkFormValidity(); });
    curricula.addEventListener("change", checkFormValidity);

    loadCatalog().then(function (data) {
        catalog = data;
        clearTimeout(slowTimer);
        lowConnection.style.display = "none";
        data.dipartimenti.forEach(function (s) { addOption(areas, s.id, s.label); });
        document.getElementById("aa-label").textContent =
            "📅 Anno accademico " + data.aa + "/" + (data.aa + 1);
    }).catch(function () {
        clearTimeout(slowTimer);
        lowConnection.textContent = "Impossibile caricare l'elenco dei corsi, ricarica la pagina.";
        lowConnection.style.display = "block";
    });
});
