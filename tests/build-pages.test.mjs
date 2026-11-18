import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSlugs, escapeHtml, prettyCourseName, slugify } from "../scripts/build-pages.mjs";

test("slugify strips accents, decree suffix and punctuation", () => {
    assert.equal(slugify("Sostenibilità integrata dei sistemi"), "sostenibilita-integrata-dei-sistemi");
    assert.equal(slugify("INFORMATICA (D.M. 270/04)"), "informatica");
    assert.equal(slugify("Analisi dei dati per l'economia"), "analisi-dei-dati-per-l-economia");
});

test("prettyCourseName fixes ALL CAPS and removes the decree note", () => {
    assert.equal(prettyCourseName("FISICA (D.M. 270/04)"), "Fisica");
    assert.equal(prettyCourseName("Digital Marketing"), "Digital Marketing");
});

test("assignSlugs keeps slugs unique for courses with the same name", () => {
    const slugs = assignSlugs([
        { label: "Economia aziendale e management", tipo: "Laurea Triennale", code: "50-213" },
        { label: "Economia aziendale e management", tipo: "Laurea Triennale", code: "50-313" },
        { label: "Filosofia", tipo: "Laurea Magistrale", code: "1" },
    ]).map((c) => c.slug);
    assert.equal(new Set(slugs).size, 3);
    assert.equal(slugs[2], "filosofia");
});

test("escapeHtml neutralises markup from portal data", () => {
    assert.equal(escapeHtml(`<b>"x"&'y'</b>`), "&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
});
