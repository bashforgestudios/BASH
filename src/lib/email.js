// Server-only ticket email via Resend (https://resend.com).
// Set RESEND_API_KEY and EMAIL_FROM in the environment. Without a key nothing is sent,
// but the attempt is still logged so the club can see it was not delivered.
import crypto from "crypto";
import { col } from "@/lib/db";

const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function sendTicketEmail(booking) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Bash Tickets <onboarding@resend.dev>";
    const subject = `Your Bash ticket: ${booking.event_title}`;
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px">
          <h2>${esc(booking.event_title)}</h2>
          <p>Hi ${esc(booking.attendee_name)}, here is your ticket.</p>
          <ul>
            <li>Venue: ${esc(booking.event_venue)}, ${esc(booking.event_city)}</li>
            <li>Date: ${esc(booking.event_date)} at ${esc(booking.event_time)}</li>
            <li>Category: ${esc(booking.tier)} × ${esc(booking.quantity)}</li>
          </ul>
          <p style="font-size:20px"><strong>Ticket code: ${esc(booking.ticket_code)}</strong></p>
          <p>Show this code and your ID at the gate. Each ticket is admitted once.</p>
        </div>`;

    let status = "sent";
    let error = null;
    if (!key) {
        status = "not_configured";
        error = "RESEND_API_KEY is not set";
    } else {
        try {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from, to: [booking.attendee_email], subject, html }),
                cache: "no-store",
            });
            if (!res.ok) {
                status = "failed";
                error = `${res.status} ${(await res.text()).slice(0, 300)}`;
            }
        } catch (e) {
            status = "failed";
            error = e.message;
        }
    }

    const logs = await col("email_logs");
    await logs.insertOne({
        id: crypto.randomBytes(12).toString("hex"),
        booking_id: booking.id,
        to_email: booking.attendee_email,
        subject,
        status,
        error,
        created_at: new Date(),
    });
    return { status, error };
}

/**
 * Tells the Bash team a club asked to join. Set LEADS_NOTIFY_EMAIL (comma separated) to turn it on.
 * Never throws: the club's request is already saved, the email is only a nudge.
 */
export async function notifyNewLead(lead) {
    const to = String(process.env.LEADS_NOTIFY_EMAIL || "").split(",").map((x) => x.trim()).filter(Boolean);
    const key = process.env.RESEND_API_KEY;
    if (!to.length || !key) return;
    try {
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || "Bash Tickets <onboarding@resend.dev>",
                to,
                subject: `New club lead: ${lead.club_name} (${lead.city_name})`,
                html: `<div style="font-family:Arial,sans-serif">
                  <p><strong>${esc(lead.club_name)}</strong>, ${esc(lead.city_name)}</p>
                  <p>${esc(lead.contact_name)} · ${esc(lead.phone)} · ${esc(lead.email)}</p>
                  <p>Prefers: ${esc(lead.contact_pref)}</p>
                  ${lead.message ? `<p>${esc(lead.message)}</p>` : ""}
                  <p>Open the Developer panel, Leads tab, to follow up.</p></div>`,
            }),
            cache: "no-store",
        });
    } catch (e) {
        console.error("notifyNewLead failed:", e.message);
    }
}
