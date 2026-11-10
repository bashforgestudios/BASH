// Calendar helpers shared by the Events Calendar, the ticket cards and the calendar launcher.

/** "30 March 2026" + "9:30 PM" -> Date (or null when the text can't be read). */
export function ticketDate(t) {
    const d = new Date(`${t.event_date} ${t.event_time || ""}`.trim());
    if (!Number.isNaN(d.getTime())) return d;
    const d2 = new Date(t.event_date);
    return Number.isNaN(d2.getTime()) ? null : d2;
}

const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

/** Google Calendar "add event" link for a ticket (4 hour slot), or null when the date can't be read. */
export function googleCalendarUrl(t) {
    const d = ticketDate(t);
    if (!d) return null;
    const end = new Date(d.getTime() + 4 * 3600 * 1000);
    return (
        "https://calendar.google.com/calendar/render?action=TEMPLATE" +
        `&text=${encodeURIComponent(t.event_title)}` +
        `&location=${encodeURIComponent(`${t.event_venue}, ${t.event_city}`)}` +
        `&dates=${stamp(d)}/${stamp(end)}`
    );
}

export function openGoogleCalendar(t) {
    const url = googleCalendarUrl(t);
    if (!url) {
        alert("Could not read this event's date for the calendar.");
        return;
    }
    window.open(url, "_blank", "noopener");
}
