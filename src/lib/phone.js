// Indian mobile numbers. Shared by the browser and the server.
// Returns the 10-digit national number ("9876543210") or null if it isn't a valid mobile number.
export function normalizePhone(raw) {
    let d = String(raw ?? "").replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** The two ways a number can be stored on an account: "9876543210" or "+919876543210". */
export const phoneForms = (d10) => [d10, `+91${d10}`];
