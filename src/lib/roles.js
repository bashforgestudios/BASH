// Server-only role guard for route handlers.
//   user        - books tickets, sees clubs
//   club_admin  - manages one club (events, bookings queue, gate accounts, scan logs)
//   gate        - scans tickets at one club's door
//   developer   - sees everything, manages clubs, users, payment gateways
//
// The JWT proves who the caller is; the role and club are then read from the database on every
// call, so a demoted account loses access immediately instead of when its token expires.
import { getUserFromRequest } from "@/lib/auth";
import { ALL_ROLES } from "@/lib/roleHome";
import { fail } from "@/lib/http";

/** Returns { user } when the caller has one of `roles`, otherwise { error: NextResponse }. */
export async function requireRole(req, roles) {
    const user = await getUserFromRequest(req);
    if (!user) return { error: fail("Sign in first", 401) };
    if (!roles.includes(user.role || "user")) return { error: fail("Your account cannot do this", 403) };
    if ((user.role === "club_admin" || user.role === "gate") && !user.club_id) {
        return { error: fail("Your account is not linked to a club yet. Ask a developer.", 403) };
    }
    return { user };
}

/** Any signed-in account (user, club_admin, gate, developer). */
export const requireUser = (req) => requireRole(req, ALL_ROLES);
