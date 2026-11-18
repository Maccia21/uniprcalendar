// Generates public/data/catalog.json (departments, courses, years, curricula, teachings).
// Runs at build/deploy time only: the live site never calls this.
//   node scripts/build-catalog.mjs            -> current academic year
//   node scripts/build-catalog.mjs 2026       -> a specific year
//   node scripts/build-catalog.mjs --skip-check  -> skip the "timetable published?" check

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTAL_URL, buildCatalog, currentAcademicYear, fetchCells } from "../functions/_lib/easyacademy.js";

const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "catalog.json");
const CHECK_CONCURRENCY = 4;

async function fetchCombo(aa) {
    const response = await fetch(`${PORTAL_URL}/combo.php?sw=ec_&aa=${aa}&page=corsi`);
    if (!response.ok) throw new Error(`combo.php ha risposto ${response.status}`);
    return response.text();
}

/** Marks each year/curriculum with whether UNIPR publishes lessons for it. */
async function markAvailability(catalog) {
    const jobs = catalog.corsi.flatMap((c) => c.anni.map((a) => ({ c, a })));
    let done = 0;
    async function worker() {
        while (jobs.length > 0) {
            const { c, a } = jobs.shift();
            try {
                const cells = await fetchCells({ aa: catalog.aa, course: c.code, curriculum: a.value });
                a.disponibile = cells.some((cell) => cell.codice_insegnamento);
            } catch (err) {
                console.warn(`  ! ${c.label} ${a.value}: ${err.message} (lo considero disponibile)`);
                a.disponibile = true;
            }
            done += 1;
            if (done % 25 === 0) console.log(`  controllati ${done} percorsi...`);
        }
    }
    await Promise.all(Array.from({ length: CHECK_CONCURRENCY }, worker));
}

async function main() {
    const args = process.argv.slice(2);
    const yearArg = args.find((a) => /^\d{4}$/.test(a));
    const aa = yearArg ? Number(yearArg) : currentAcademicYear();
    console.log(`Scarico il catalogo UNIPR per l'a.a. ${aa}/${aa + 1}...`);

    const catalog = { ...buildCatalog(await fetchCombo(aa), aa), generato: new Date().toISOString() };
    if (catalog.corsi.length === 0) {
        throw new Error("Catalogo vuoto: il portale non ha ancora pubblicato i corsi per questo anno");
    }
    if (!args.includes("--skip-check")) {
        console.log("Controllo quali orari sono pubblicati...");
        await markAvailability(catalog);
    }

    await mkdir(dirname(OUT_FILE), { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(catalog));
    const anni = catalog.corsi.reduce((n, c) => n + c.anni.length, 0);
    const pubblicati = catalog.corsi.reduce((n, c) => n + c.anni.filter((a) => a.disponibile !== false).length, 0);
    console.log(`OK: ${catalog.dipartimenti.length} dipartimenti, ${catalog.corsi.length} corsi, ${pubblicati}/${anni} percorsi con orario -> ${OUT_FILE}`);
}

main().catch((err) => {
    console.error("Errore:", err.message);
    process.exit(1);
});
