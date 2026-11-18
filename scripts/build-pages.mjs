// Generates SEO landing pages from public/data/catalog.json:
//   public/corsi/index.html        -> every course grouped by department
//   public/corsi/<slug>.html       -> one page per course ("orario lezioni <corso> unipr")
//   public/sitemap.xml             -> home + course pages
// Run after build-catalog.mjs:  node scripts/build-pages.mjs

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
export const SITE = "https://uniprcalendar.pages.dev";

export function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** "Analisi dei dati per l'economia (D.M. 270/04)" -> "analisi-dei-dati-per-l-economia" */
export function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/\(d\.? ?m\.? ?270\/04\)/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Readable course name: drops "(D.M. 270/04)" and fixes ALL CAPS labels. */
export function prettyCourseName(label) {
    const clean = String(label).replace(/\s*\(d\.? ?m\.? ?270\/04\)\s*/gi, " ").trim();
    if (clean === clean.toUpperCase()) {
        return clean.charAt(0) + clean.slice(1).toLowerCase();
    }
    return clean;
}

/** Unique slug per course; same-name courses get their type and code appended. */
export function assignSlugs(corsi) {
    const counts = {};
    for (const c of corsi) {
        const base = slugify(prettyCourseName(c.label));
        counts[base] = (counts[base] || 0) + 1;
    }
    const used = new Set();
    return corsi.map((c) => {
        const base = slugify(prettyCourseName(c.label));
        let slug = counts[base] > 1 ? `${base}-${slugify(c.tipo)}` : base;
        if (used.has(slug)) slug = `${slug}-${slugify(c.code)}`;
        used.add(slug);
        return { ...c, slug };
    });
}

function head({ title, description, path, extra = "" }) {
    return `<!doctype html>
<html lang="it">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${SITE}${path}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="UNIPR Calendar">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:locale" content="it_IT">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#005eb8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/calendar.png" type="image/png">
  <link rel="apple-touch-icon" href="/calendar.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="/css/bootstrap.css" rel="stylesheet">
  <link href="/css/template.css" rel="stylesheet">
  <link href="/css/theme.css" rel="stylesheet">
  <script src="/scripts/theme.js"></script>
${extra}</head>

<body>
<div class="container" id="main-container">
  <header class="mt-5 mb-4">
    <div class="topbar">
      <p class="brand mb-0"><a href="/"><img src="/favicon.svg" alt=""> UNIPR <span class="accent">Calendar</span></a></p>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Cambia tema">🌙</button>
    </div>
`;
}

async function footer() {
    const home = await readFile(join(ROOT, "index.html"), "utf8");
    const match = home.match(/<footer[\s\S]*<\/html>\s*$/);
    if (!match) throw new Error("index.html: footer non trovato");
    return match[0];
}

function breadcrumbLd(items) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: SITE + it.path })),
    };
}

function jsonLd(data) {
    return `  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>\n`;
}

const TYPE_HINT = {
    "Laurea Triennale": "corso di laurea triennale",
    "Laurea Magistrale": "corso di laurea magistrale",
    "Laurea magistrale": "corso di laurea magistrale",
    "Laurea Magistrale Ciclo Unico": "corso di laurea magistrale a ciclo unico",
    "Laurea": "corso di laurea triennale",
    "Laurea Magistrale Ciclo Unico 5 anni": "corso di laurea magistrale a ciclo unico (5 anni)",
    "Laurea Magistrale Ciclo Unico 6 anni": "corso di laurea magistrale a ciclo unico (6 anni)",
};

function teachersOf(course) {
    const names = new Set();
    for (const a of course.anni) {
        for (const l of a.lezioni) {
            for (const n of l.docente.split(",")) if (n.trim()) names.add(n.trim());
        }
    }
    return [...names].sort((x, y) => x.localeCompare(y, "it"));
}

function yearSection(course, a) {
    const link = `/corso?c=${encodeURIComponent(course.code)}&a=${encodeURIComponent(a.value)}`;
    const items = a.lezioni
        .map((l) => `        <li><strong>${escapeHtml(l.label)}</strong>${l.docente ? ` · ${escapeHtml(l.docente)}` : ""}</li>`)
        .join("\n");
    const action = a.disponibile === false
        ? `<p class="counter mb-0">Orario non ancora pubblicato da UNIPR per questo percorso.</p>`
        : `<a class="btn btn-primary" href="${link}">Aggiungi il ${a.year}° anno al calendario →</a>`;
    return `    <section class="mt-4">
      <h2 class="h5 fw-bold">${a.year}° anno · ${escapeHtml(a.label)}</h2>
      ${a.lezioni.length ? `<ul>\n${items}\n      </ul>` : `<p class="counter">Elenco insegnamenti non disponibile.</p>`}
      ${action}
    </section>`;
}

function coursePage(course, depName, aa, foot) {
    const name = prettyCourseName(course.label);
    const path = `/corsi/${course.slug}`;
    const kind = TYPE_HINT[course.tipo] || course.tipo.toLowerCase();
    const anni = course.anni.slice().sort((a, b) => a.year - b.year || a.label.localeCompare(b.label, "it"));
    const years = [...new Set(anni.map((a) => a.year))];
    const curricula = [...new Set(anni.map((a) => a.label))];
    const teachings = new Set(anni.flatMap((a) => a.lezioni.map((l) => l.label)));
    const teachers = teachersOf(course);
    const sample = [...teachings].slice(0, 3).join(", ");
    const title = `Orario lezioni ${name} UNIPR ${aa}/${aa + 1} su Google Calendar`;
    const description = `Orario ${name} (${course.tipo}) UNIPR ${aa}/${aa + 1}: ${teachings.size} insegnamenti${sample ? " tra cui " + sample : ""}. Aggiungilo a Google o Apple Calendar.`.slice(0, 300);
    const available = anni.some((a) => a.disponibile !== false);

    const intro = `<p><strong>${escapeHtml(name)}</strong> è un ${escapeHtml(kind)} dell'Università di Parma (${escapeHtml(depName)}).
    Per l'a.a. ${aa}/${aa + 1} il portale orari UNIPR elenca ${teachings.size} insegnamenti su ${years.length === 1 ? "1 anno" : `${years.length} anni`}${curricula.length > 1 ? ` e ${curricula.length} curricula (${curricula.map(escapeHtml).join(", ")})` : ""}${teachers.length ? `, tenuti da ${teachers.length} docenti` : ""}.
    Scegli il tuo anno qui sotto: potrai togliere gli insegnamenti che non segui e ricevere l'orario aggiornato su Google Calendar, Apple Calendar o Outlook.</p>`;

    const ld = jsonLd(breadcrumbLd([
        { name: "UNIPR Calendar", path: "/" },
        { name: "Corsi", path: "/corsi/" },
        { name, path },
    ]));

    return head({ title, description, path, extra: ld }) + `    <h1 class="h2 fw-bold mt-3">Orario lezioni ${escapeHtml(name)}</h1>
    <p class="subtitle">${escapeHtml(course.tipo)} · ${escapeHtml(depName)} · UNIPR · a.a. ${aa}/${aa + 1}</p>
  </header>

  <main id="box">
    ${intro}
    ${available ? "" : `<p id="not-available" style="display:block">UNIPR al momento non pubblica l'orario di questo corso sul portale pubblico.</p>`}
${anni.map((a) => yearSection(course, a)).join("\n")}
  </main>
  <p class="mt-3"><a href="/corsi/">← Tutti i corsi UNIPR</a></p>
</div>
` + foot;
}

function indexPage(corsi, dipartimenti, aa, foot) {
    const title = `Orario lezioni di tutti i corsi UNIPR ${aa}/${aa + 1} · Google e Apple Calendar`;
    const description = `Elenco di tutti i corsi di laurea UNIPR (Università di Parma) per dipartimento: aggiungi l'orario delle lezioni a Google Calendar, Apple Calendar o Outlook.`;
    const sections = dipartimenti
        .map((d) => {
            const list = corsi
                .filter((c) => c.dip === d.id)
                .sort((a, b) => prettyCourseName(a.label).localeCompare(prettyCourseName(b.label), "it"))
                .map((c) => `        <li><a href="/corsi/${c.slug}">${escapeHtml(prettyCourseName(c.label))}</a> <span class="counter">· ${escapeHtml(c.tipo)}</span></li>`)
                .join("\n");
            return list ? `    <h2 class="h5 fw-bold mt-4">${escapeHtml(d.label)}</h2>\n      <ul>\n${list}\n      </ul>` : "";
        })
        .join("\n");
    return head({ title, description, path: "/corsi/", extra: jsonLd(breadcrumbLd([{ name: "UNIPR Calendar", path: "/" }, { name: "Corsi", path: "/corsi/" }])) }) +
        `    <h1 class="h2 fw-bold mt-3">Tutti i corsi UNIPR</h1>
    <p class="subtitle">Orario delle lezioni a.a. ${aa}/${aa + 1} per dipartimento: scegli il tuo corso e aggiungilo al calendario.</p>
  </header>

  <main id="box">
${sections}
  </main>
</div>
` + foot;
}

function sitemap(corsi, today) {
    const urls = ["/", "/corsi/", ...corsi.map((c) => `/corsi/${c.slug}`)];
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
}

async function main() {
    const catalog = JSON.parse(await readFile(join(ROOT, "data", "catalog.json"), "utf8"));
    const foot = await footer();
    const corsi = assignSlugs(catalog.corsi);
    const depNames = Object.fromEntries(catalog.dipartimenti.map((d) => [d.id, d.label]));

    // Overwrite in place and remove only stale files: deleting the whole folder
    // makes synced folders (iCloud) create "name 2.html" conflict copies.
    const dir = join(ROOT, "corsi");
    await mkdir(dir, { recursive: true });
    const wanted = new Set(["index.html", ...corsi.map((c) => `${c.slug}.html`)]);
    for (const c of corsi) {
        await writeFile(join(dir, `${c.slug}.html`), coursePage(c, depNames[c.dip] || c.dip, catalog.aa, foot));
    }
    await writeFile(join(dir, "index.html"), indexPage(corsi, catalog.dipartimenti, catalog.aa, foot));
    for (const name of await readdir(dir)) {
        if (!wanted.has(name)) await unlink(join(dir, name));
    }
    await writeFile(join(ROOT, "sitemap.xml"), sitemap(corsi, new Date().toISOString().slice(0, 10)));
    console.log(`OK: ${corsi.length} pagine corso + indice + sitemap`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error("Errore:", err.message);
        process.exit(1);
    });
}
