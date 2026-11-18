import { test } from "node:test";
import assert from "node:assert/strict";
import { buildICalendar, escapeText, foldLine } from "../functions/_lib/icalendar.js";

const EVENT = {
    uid: "1@uniprcalendar", title: "Analisi; dati, base", location: "Aula 1", description: "Riga 1\nRiga 2",
    start: new Date("2026-09-29T12:00:00Z"), end: new Date("2026-09-29T13:30:00Z"), url: null, cancelled: false,
};

test("escapes RFC 5545 special characters", () => {
    assert.equal(escapeText("a;b,c\\d\ne"), "a\\;b\\,c\\\\d\\ne");
});

test("folds long lines at 75 octets without breaking UTF-8", () => {
    const folded = foldLine("SUMMARY:" + "è".repeat(80));
    for (const line of folded.split("\r\n")) {
        assert.ok(new TextEncoder().encode(line).length <= 75);
    }
    assert.equal(folded.replace(/\r\n /g, ""), "SUMMARY:" + "è".repeat(80));
});

test("builds a calendar with CRLF, event fields and optional alarm", () => {
    const ics = buildICalendar([EVENT], { alarmMinutes: 15, now: new Date("2026-01-01T00:00:00Z") });
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.match(ics, /DTSTART:20260929T120000Z\r\n/);
    assert.match(ics, /DTEND:20260929T133000Z\r\n/);
    assert.match(ics, /SUMMARY:Analisi\\; dati\\, base\r\n/);
    assert.match(ics, /TRIGGER:-PT15M/);
});

test("omits the alarm when not requested", () => {
    assert.doesNotMatch(buildICalendar([EVENT]), /VALARM/);
});
