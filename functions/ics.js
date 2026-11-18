// GET /ics?aa=2026&c=50-367&a=PDS0-2026|1&l=CODE1,CODE2&alert=15
// Stateless iCalendar feed: every parameter lives in the subscription URL.

import { fetchCells, cellsToEvents } from "./_lib/easyacademy.js";
import { buildICalendar } from "./_lib/icalendar.js";

const FEED_TTL_SECONDS = 2 * 3600; // calendar refreshes hit the cache, not UNIPR
const EMPTY_TTL_SECONDS = 30 * 60;
const MAX_LECTURES = 100;
const MAX_ALERT_MINUTES = 24 * 60;

const RE_AA = /^\d{4}$/;
const RE_COURSE = /^[A-Za-z0-9._-]{1,40}$/;
const RE_CURRICULUM = /^[A-Za-z0-9._-]{1,40}\|\d{1,2}$/;
const RE_LECTURE = /^[A-Za-z0-9._-]{1,80}$/;

export function parseFeedParams(searchParams) {
    const aa = searchParams.get("aa") || "";
    const course = searchParams.get("c") || "";
    const curriculum = searchParams.get("a") || "";
    const lectures = (searchParams.get("l") || "").split(",").filter(Boolean);
    const alert = Number.parseInt(searchParams.get("alert") || "0", 10);

    if (!RE_AA.test(aa)) return { error: "Parametro aa non valido" };
    if (!RE_COURSE.test(course)) return { error: "Parametro c non valido" };
    if (!RE_CURRICULUM.test(curriculum)) return { error: "Parametro a non valido" };
    if (lectures.length > MAX_LECTURES || !lectures.every((l) => RE_LECTURE.test(l))) {
        return { error: "Parametro l non valido" };
    }
    const alarmMinutes = Number.isInteger(alert) && alert > 0 ? Math.min(alert, MAX_ALERT_MINUTES) : 0;
    return { aa, course, curriculum, lectures, alarmMinutes };
}

function icsResponse(body, ttl) {
    return new Response(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="unipr.ics"',
            "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}`,
            "X-Content-Type-Options": "nosniff",
        },
    });
}

function placeholderEvent(title, url) {
    const start = new Date();
    return {
        uid: `placeholder-${start.toISOString().slice(0, 10)}@uniprcalendar`,
        title,
        start,
        end: new Date(start.getTime() + 3600 * 1000),
        location: null,
        description: url,
        url,
        cancelled: false,
    };
}

export async function onRequestGet(context) {
    const requestUrl = new URL(context.request.url);
    const params = parseFeedParams(requestUrl.searchParams);
    if (params.error) {
        return new Response(params.error, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // Edge cache (free): same URL within the TTL never reaches UNIPR.
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const cacheKey = new Request(requestUrl.toString(), { method: "GET" });
    if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
    }

    let cells;
    try {
        cells = await fetchCells(params);
    } catch (err) {
        console.error("Errore portale UNIPR:", err);
        // 503 keeps the events already in the user's calendar instead of wiping them.
        return new Response("Portale UNIPR non raggiungibile, riprova più tardi", {
            status: 503,
            headers: { "Retry-After": "1800", "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
    }

    const events = cellsToEvents(cells, params.lectures);
    const empty = events.length === 0;
    const body = buildICalendar(
        empty ? [placeholderEvent("Non ho trovato lezioni, riprova più tardi!", requestUrl.origin)] : events,
        { alarmMinutes: params.alarmMinutes },
    );
    const response = icsResponse(body, empty ? EMPTY_TTL_SECONDS : FEED_TTL_SECONDS);
    if (cache) {
        context.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
}
