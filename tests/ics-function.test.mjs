import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeedParams, onRequestGet } from "../functions/ics.js";

const ok = new URLSearchParams({ aa: "2026", c: "50-367", a: "PDS0-2026|1", l: "EC-1,EC-2", alert: "15" });

test("accepts valid feed parameters", () => {
    assert.deepEqual(parseFeedParams(ok), {
        aa: "2026", course: "50-367", curriculum: "PDS0-2026|1", lectures: ["EC-1", "EC-2"], alarmMinutes: 15,
    });
});

test("rejects malformed or injected parameters", () => {
    for (const [k, v] of [["aa", "20x6"], ["c", "50 367"], ["a", "PDS0"], ["l", "EC-1,<script>"]]) {
        const p = new URLSearchParams(ok);
        p.set(k, v);
        assert.ok(parseFeedParams(p).error, `${k}=${v} dovrebbe essere rifiutato`);
    }
});

test("returns 400 without calling UNIPR for bad input", async () => {
    const res = await onRequestGet({ request: new Request("https://x.test/ics?aa=bad"), waitUntil() {} });
    assert.equal(res.status, 400);
});

test("serves an .ics with Cache-Control and returns 503 when the portal fails", async (t) => {
    const cell = {
        id: "9", codice_insegnamento: "EC-1", titolo_lezione: "Analisi", timestamp: 1790683200,
        ora_inizio: "14:00", ora_fine: "15:30", aula: "Aula 1", Annullato: "0",
    };
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ celle: [cell] })));
    const res = await onRequestGet({ request: new Request("https://x.test/ics?" + ok), waitUntil() {} });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Content-Type"), /text\/calendar/);
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=7200, s-maxage=7200");
    assert.match(await res.text(), /SUMMARY:Analisi/);

    globalThis.fetch.mock.mockImplementation(async () => new Response("boom", { status: 500 }));
    const down = await onRequestGet({ request: new Request("https://x.test/ics?" + ok), waitUntil() {} });
    assert.equal(down.status, 503);
});
