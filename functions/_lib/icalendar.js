// Minimal RFC 5545 writer (VCALENDAR with VEVENT + optional VALARM).

const PRODID = "-//UNIPR Calendar//IT";
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

export function formatUtc(date) {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function escapeText(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets without splitting UTF-8 characters. */
export function foldLine(line) {
    const out = [];
    let current = "";
    let size = 0;
    for (const ch of line) {
        const chSize = encoder.encode(ch).length;
        const limit = out.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
        if (size + chSize > limit) {
            out.push(current);
            current = "";
            size = 0;
        }
        current += ch;
        size += chSize;
    }
    out.push(current);
    return out.join("\r\n ");
}

function alarmTrigger(minutes) {
    return `-PT${minutes}M`;
}

function eventLines(event, now, alarmMinutes) {
    const lines = [
        "BEGIN:VEVENT",
        `UID:${event.uid}`,
        `DTSTAMP:${formatUtc(now)}`,
        `DTSTART:${formatUtc(event.start)}`,
        `DTEND:${formatUtc(event.end)}`,
        `SUMMARY:${escapeText(event.title)}`,
    ];
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.cancelled) lines.push("STATUS:CANCELLED");
    if (alarmMinutes && !event.cancelled) {
        lines.push(
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${escapeText(event.title)}`,
            `TRIGGER:${alarmTrigger(alarmMinutes)}`,
            "END:VALARM",
        );
    }
    lines.push("END:VEVENT");
    return lines;
}

export function buildICalendar(events, { name = "UNIPR Calendar", alarmMinutes = 0, now = new Date() } = {}) {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:${PRODID}`,
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${escapeText(name)}`,
        "X-WR-TIMEZONE:Europe/Rome",
        "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
        "X-PUBLISHED-TTL:PT2H",
        ...events.flatMap((e) => eventLines(e, now, alarmMinutes)),
        "END:VCALENDAR",
    ];
    return lines.map(foldLine).join("\r\n") + "\r\n";
}
