import { test } from "node:test";
import assert from "node:assert/strict";
import {
    buildCatalog, cellsToEvents, currentAcademicYear, curriculumLabel, extractComboVar, yearFromCurriculumValue,
} from "../functions/_lib/easyacademy.js";

const COMBO = `var elenco_scuole = [{"label":"Tecnologia","valore":"Tecnologia","id":"5"}];
var elenco_corsi = [{"elenco_anni":[{"label":"1 - Comune","valore":"PDS0-2026|1","elenco_insegnamenti":[{"label":"Analisi ","valore":"EC-1","docente":"M. Rossi"}],"elenco_canali":[]},{"label":"senza anno","valore":"X","elenco_insegnamenti":[]}],"label":"Economia","tipo":"Laurea magistrale","valore":"50-367","scuola":"Tecnologia","facolta_code":"FAIN"}];
var elenco_cdl = [];`;

test("returns the academic year that started in September", () => {
    assert.equal(currentAcademicYear(new Date("2026-11-18T10:00:00Z")), 2026);
    assert.equal(currentAcademicYear(new Date("2027-03-01T10:00:00Z")), 2026);
    assert.equal(currentAcademicYear(new Date("2026-09-01T10:00:00Z")), 2026);
});

test("parses year and curriculum label from portal values", () => {
    assert.equal(yearFromCurriculumValue("PDS0-2026|3"), 3);
    assert.equal(yearFromCurriculumValue("broken"), null);
    assert.equal(curriculumLabel("1 - Percorso standard"), "Percorso standard");
    assert.equal(curriculumLabel("Comune"), "Comune");
});

test("throws a clear error when combo.php misses a variable", () => {
    assert.throws(() => extractComboVar("var other = [];", "elenco_corsi"), /elenco_corsi/);
});

test("builds a compact catalog and drops entries without a year", () => {
    const catalog = buildCatalog(COMBO, 2026);
    assert.equal(catalog.aa, 2026);
    assert.deepEqual(catalog.dipartimenti, [{ id: "FAIN", label: "Ingegneria e Architettura" }]);
    assert.equal(catalog.corsi[0].dip, "FAIN");
    assert.equal(catalog.corsi.length, 1);
    assert.deepEqual(catalog.corsi[0].anni, [{
        value: "PDS0-2026|1", year: 1, label: "Comune",
        lezioni: [{ code: "EC-1", label: "Analisi", docente: "M. Rossi" }],
    }]);
});

const LESSON = {
    id: "8089885", codice_insegnamento: "EC-1", nome_insegnamento: "Analisi dei dati",
    titolo_lezione: "Analisi dei dati", timestamp: 1790683200, ora_inizio: "14:00", ora_fine: "15:30",
    aula: "Lab. C1.6 [[MO 07] - Foro Boario]", tipo: "Lezione", docente: "Rossi <b>Mario</b>", Annullato: "0",
    link_aula: [""],
};

test("converts a lesson cell into an event with Rome-local start and duration", () => {
    const [event] = cellsToEvents([LESSON], []);
    assert.equal(event.start.toISOString(), "2026-09-29T12:00:00.000Z"); // 14:00 in Italy (CEST)
    assert.equal(event.end.toISOString(), "2026-09-29T13:30:00.000Z");
    assert.equal(event.uid, "8089885@uniprcalendar");
    assert.match(event.description, /Docente: Rossi Mario/);
    assert.equal(event.url, null);
});

test("skips closures and teachings that were not selected", () => {
    const closure = { nome: "Sospensione", timestamp: 1792015200, ora_inizio: "00:00", ora_fine: "24:00" };
    const other = { ...LESSON, id: "2", codice_insegnamento: "EC-2" };
    assert.equal(cellsToEvents([closure, LESSON, other], ["EC-1"]).length, 1);
    assert.equal(cellsToEvents([closure, LESSON, other], []).length, 2);
});

test("marks cancelled lessons", () => {
    const [event] = cellsToEvents([{ ...LESSON, Annullato: "1" }], []);
    assert.equal(event.cancelled, true);
    assert.match(event.title, /^\[ANNULLATA\]/);
});

test("falls back to the raw code for unknown departments", async () => {
    const { departmentName } = await import("../functions/_lib/easyacademy.js");
    assert.equal(departmentName("nuovo_dip"), "nuovo_dip");
});
