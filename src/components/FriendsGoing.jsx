"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Loader2, Lock, Plus, Users } from "lucide-react";
import Modal from "@/components/Modal";
import { Btn, inputCls } from "@/components/PanelUI";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { clearSaved, loadSaved, parseNumbers, pickContacts, pickerSupported, saveContacts } from "@/lib/contacts";

const errText = (e) => formatErr(e?.response?.data?.detail) || e?.message || "Something went wrong";
const initials = (n) => (n || "?").trim().slice(0, 1).toUpperCase();

// "Who from my contacts is going": a row on the event page with a popup to add contacts.
export default function FriendsGoing({ eventId, nextPath }) {
    const { user } = useAuth();
    const [saved, setSaved] = useState([]); // [{ name, phone }] stored in this browser only
    const [friends, setFriends] = useState(null); // null = not checked yet
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    const nameByPhone = useMemo(() => new Map(saved.map((c) => [c.phone, c.name])), [saved]);

    const check = useCallback(
        async (list) => {
            if (!list.length) return setFriends(null);
            setBusy(true);
            try {
                const { data } = await api.post(`/events/${eventId}/friends`, { phones: list.map((c) => c.phone) });
                setFriends(data.friends);
            } catch (e) {
                if (e?.response?.status !== 401) toast.error(errText(e));
            } finally {
                setBusy(false);
            }
        },
        [eventId],
    );

    // contacts chosen earlier on this device are re-checked automatically for each event
    useEffect(() => {
        const list = loadSaved();
        setSaved(list);
        if (user && list.length) check(list);
    }, [user, check]);

    const add = async (incoming) => {
        const list = saveContacts([...saved, ...incoming]);
        setSaved(list);
        setOpen(false);
        await check(list);
    };

    const remove = () => {
        clearSaved();
        setSaved([]);
        setFriends(null);
        setOpen(false);
        toast.success("Contacts removed from this device");
    };

    const names = (friends || []).map((f) => nameByPhone.get(f.phone) || f.name);
    const line =
        friends === null
            ? "See who you know is going"
            : names.length === 0
              ? "None of your contacts are going yet"
              : names.length <= 2
                ? `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} going`
                : `${names[0]}, ${names[1]} and ${names.length - 2} more going`;

    return (
        <>
            <div className="flex items-center justify-between gap-3" data-testid="friends-going">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex -space-x-2 shrink-0">
                        {names.slice(0, 3).map((n, i) => (
                            <span key={i} className="w-9 h-9 rounded-full bg-brand text-brand-fg border-2 border-canvas flex items-center justify-center font-display text-sm font-semibold">
                                {initials(n)}
                            </span>
                        ))}
                        {names.length === 0 && (
                            <span className="w-9 h-9 rounded-full bg-fg/10 flex items-center justify-center">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin text-fg/60" /> : <Users className="w-4 h-4 text-fg/60" />}
                            </span>
                        )}
                    </div>
                    <span className="font-body text-sm text-fg/80 truncate" data-testid="friends-line">{line}</span>
                </div>
                <button
                    type="button"
                    onClick={() => (user ? setOpen(true) : (window.location.href = `/login?next=${encodeURIComponent(nextPath)}`))}
                    data-testid="add-contacts"
                    className="inline-flex items-center gap-1 font-body text-sm font-medium text-brand-ink shrink-0 hover:opacity-80"
                >
                    {saved.length ? "Update" : <><Plus className="w-4 h-4" /> Add contacts</>}
                </button>
            </div>

            <ContactsModal open={open} onClose={() => setOpen(false)} onAdd={add} onRemove={remove} hasSaved={saved.length > 0} />
        </>
    );
}

function ContactsModal({ open, onClose, onAdd, onRemove, hasSaved }) {
    const supported = pickerSupported();
    const [text, setText] = useState("");
    const [picking, setPicking] = useState(false);

    useEffect(() => {
        if (open) setText("");
    }, [open]);

    const choose = async () => {
        setPicking(true);
        try {
            const list = await pickContacts();
            if (list === null) return; // closed the sheet
            if (!list.length) return toast.error("No valid mobile numbers in the contacts you chose");
            await onAdd(list);
        } catch (e) {
            toast.error(errText(e));
        } finally {
            setPicking(false);
        }
    };

    const paste = async () => {
        const list = parseNumbers(text);
        if (!list.length) return toast.error("Enter at least one valid 10-digit mobile number");
        await onAdd(list);
    };

    return (
        <Modal open={open} onClose={onClose} title="See who's going" subtitle="Find friends from your phone contacts who are going to this event." busy={picking}>
            <ul className="space-y-2 font-body text-xs text-fg/60 mb-4">
                <li className="flex gap-2"><Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Your contacts stay on this device. We use them only for this check and never save them.</li>
                <li className="flex gap-2"><Users className="w-3.5 h-3.5 mt-0.5 shrink-0" /> You only see people who chose &ldquo;Let contacts find me&rdquo; in their settings.</li>
            </ul>

            {supported ? (
                <Btn variant="primary" onClick={choose} disabled={picking} className="w-full justify-center" data-testid="choose-contacts">
                    {picking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Choose contacts
                </Btn>
            ) : (
                <div className="space-y-2">
                    <p className="font-body text-xs text-fg/60">
                        Your browser can&apos;t open the contact list (this works in Chrome on Android). Paste mobile numbers instead, separated by commas or new lines.
                    </p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={4}
                        placeholder="98xxxxxxxx, 99xxxxxxxx"
                        className={inputCls}
                        data-testid="paste-numbers"
                    />
                    <Btn variant="primary" onClick={paste} className="w-full justify-center" data-testid="check-numbers">Check</Btn>
                </div>
            )}

            <div className="flex items-center justify-between mt-4">
                <Link href="/profile" className="inline-flex items-center gap-1 font-body text-xs text-fg/50 hover:text-fg">
                    Let friends see you too <ChevronRight className="w-3 h-3" />
                </Link>
                <div className="flex gap-2">
                    {hasSaved && <Btn onClick={onRemove} data-testid="remove-contacts">Remove saved</Btn>}
                    <Btn onClick={onClose} data-testid="cancel-contacts">Cancel</Btn>
                </div>
            </div>
        </Modal>
    );
}
