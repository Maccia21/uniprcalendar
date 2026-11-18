// Course page: list teachings of the chosen year/curriculum, all checked by default.
document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const errorBox = document.getElementById("course-error");
    const content = document.getElementById("course-content");
    const tbody = document.getElementById("lectures"); // list container
    const toggle = document.getElementById("select_or_deselect_all");
    let select = false;

    function fail() { errorBox.classList.remove("d-none"); }

    loadCatalog().then(function (catalog) {
        const course = findCourse(catalog, params.get("c"));
        const curriculum = course && course.anni.find(function (a) { return a.value === params.get("a"); });
        if (!course || !curriculum) return fail();

        document.getElementById("course-title").textContent =
            "🎓 " + course.label + " · " + curriculum.year + "° anno · " + curriculum.label;

        const counter = document.getElementById("counter");
        function updateCounter() {
            const boxes = Array.from(document.getElementsByName("lectures"));
            const n = boxes.filter(function (b) { return b.checked; }).length;
            counter.textContent = n + " di " + boxes.length + " insegnamenti selezionati";
        }

        curriculum.lezioni.forEach(function (lezione, i) {
            const row = document.createElement("label");
            row.className = "lecture";
            row.htmlFor = "lecture-" + i;
            const input = document.createElement("input");
            input.type = "checkbox";
            input.name = "lectures";
            input.value = lezione.code;
            input.id = "lecture-" + i;
            input.checked = true;
            input.addEventListener("change", updateCounter);
            const text = document.createElement("span");
            text.className = "lecture-name";
            text.textContent = lezione.label;
            if (lezione.docente) {
                const teacher = document.createElement("span");
                teacher.className = "lecture-teacher";
                teacher.textContent = lezione.docente;
                text.appendChild(teacher);
            }
            row.append(input, text);
            tbody.appendChild(row);
        });
        updateCounter();
        content.classList.remove("d-none");

        toggle.addEventListener("click", function () {
            document.getElementsByName("lectures").forEach(function (l) { l.checked = select; });
            updateCounter();
            select = !select;
            toggle.textContent = select ? "Seleziona tutti" : "Deseleziona tutti";
        });

        document.getElementById("select_lectures").addEventListener("submit", function (event) {
            event.preventDefault();
            const boxes = Array.from(document.getElementsByName("lectures"));
            const chosen = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
            if (chosen.length === 0) {
                alert("Seleziona almeno un insegnamento.");
                return;
            }
            const feed = new URLSearchParams({ aa: String(catalog.aa), c: course.code, a: curriculum.value });
            if (chosen.length < boxes.length) feed.set("l", chosen.join(","));
            const minutes = parseInt(document.getElementById("alert").value, 10);
            if (minutes > 0) feed.set("alert", String(Math.min(minutes, 1440)));
            window.location.href = "/link?" + feed.toString();
        });
    }).catch(fail);
});
