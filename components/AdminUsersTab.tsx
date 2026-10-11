import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient.ts';

/** Owner-only user management (the server allows only the owner's email; see api/admin.ts). */
export const ADMIN_EMAILS = ['ngohueminh@gmail.com'];
export const isOwnerEmail = (email?: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());

type PlanStatus = 'trial' | 'paid' | 'expired';

interface AdminUser {
    id: string;
    email: string;
    fullName: string;
    role: string;
    planStatus: PlanStatus;
    creditsRemaining: number | null;
    trialArticlesCreated: number;
    subscriptionStartDate: string | null;
    subscriptionEndDate: string | null;
    trialEndDate: string | null;
    stripeCustomer: boolean;
    createdAt: string;
    lastSignInAt: string | null;
    businesses: { name: string; url: string }[];
    publishedArticles: number;
    hasProfile: boolean;
}

interface Draft {
    planStatus: PlanStatus;
    creditsRemaining: string;
    trialArticlesCreated: string;
    subscriptionStartDate: string;
    subscriptionEndDate: string;
    trialEndDate: string;
    note: string;
}

const api = async (method: 'GET' | 'PATCH', body?: unknown) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in again.');
    const res = await fetch('/api/admin', {
        method,
        headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
    return data;
};

// dates: stored as timestamps, edited as YYYY-MM-DD (local day)
const toInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fromInput = (day: string, endOfDay: boolean) => (day ? new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString() : null);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const addDays = (day: string, n: number) => { const d = day ? new Date(`${day}T12:00:00`) : new Date(); d.setDate(d.getDate() + n); return toInput(d.toISOString()); };
const today = () => toInput(new Date().toISOString());

const draftOf = (u: AdminUser): Draft => ({
    planStatus: u.planStatus,
    creditsRemaining: u.creditsRemaining == null ? '' : String(u.creditsRemaining),
    trialArticlesCreated: String(u.trialArticlesCreated ?? 0),
    subscriptionStartDate: toInput(u.subscriptionStartDate),
    subscriptionEndDate: toInput(u.subscriptionEndDate),
    trialEndDate: toInput(u.trialEndDate),
    note: '',
});

const STATUS_STYLE: Record<PlanStatus, string> = {
    paid: 'bg-green-100 text-green-800',
    trial: 'bg-amber-100 text-amber-800',
    expired: 'bg-stone-200 text-stone-700',
};

const isLapsed = (u: AdminUser) => u.planStatus === 'paid' && !!u.subscriptionEndDate && new Date(u.subscriptionEndDate) < new Date();

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{label}</span>
        <div className="mt-1">{children}</div>
        {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
    </label>
);

const inputCls = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

const EditPanel: React.FC<{ user: AdminUser; onClose: () => void; onSaved: (msg: string) => void }> = ({ user, onClose, onSaved }) => {
    const [d, setD] = useState<Draft>(draftOf(user));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (patch: Partial<Draft>) => setD(prev => ({ ...prev, ...patch }));

    const changes = useMemo(() => {
        const o = draftOf(user);
        const c: Record<string, unknown> = {};
        if (d.planStatus !== o.planStatus) c.planStatus = d.planStatus;
        if (d.creditsRemaining !== o.creditsRemaining) c.creditsRemaining = d.creditsRemaining === '' ? null : Number(d.creditsRemaining);
        if (d.trialArticlesCreated !== o.trialArticlesCreated) c.trialArticlesCreated = Number(d.trialArticlesCreated || 0);
        if (d.subscriptionStartDate !== o.subscriptionStartDate) c.subscriptionStartDate = fromInput(d.subscriptionStartDate, false);
        if (d.subscriptionEndDate !== o.subscriptionEndDate) c.subscriptionEndDate = fromInput(d.subscriptionEndDate, true);
        if (d.trialEndDate !== o.trialEndDate) c.trialEndDate = fromInput(d.trialEndDate, true);
        return c;
    }, [d, user]);

    const save = async () => {
        if (!Object.keys(changes).length) { onClose(); return; }
        setSaving(true); setError('');
        try {
            const res = await api('PATCH', { id: user.id, changes, note: d.note });
            onSaved(res.changed?.length ? `Saved ${user.email}: ${res.changed.length} field(s) changed.` : 'Nothing changed.');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
            <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-stone-900 break-all">{user.email}</h3>
                        <p className="text-sm text-stone-500">{user.fullName || 'No name'} · joined {fmt(user.createdAt)}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close">✕</button>
                </div>

                <div className="mt-5 rounded-xl bg-stone-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Quick actions</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                            onClick={() => set({ planStatus: 'paid', subscriptionStartDate: today(), subscriptionEndDate: addDays(today(), 30), creditsRemaining: '30' })}>
                            Paid: 30 days + 30 credits
                        </button>
                        <button className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                            onClick={() => set({ planStatus: 'paid', subscriptionEndDate: addDays(d.subscriptionEndDate && d.subscriptionEndDate > today() ? d.subscriptionEndDate : today(), 30) })}>
                            Extend 30 days
                        </button>
                        <button className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                            onClick={() => set({ creditsRemaining: String(Number(d.creditsRemaining || 0) + 10) })}>
                            +10 credits
                        </button>
                        <button className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                            onClick={() => set({ planStatus: 'expired' })}>
                            Expire
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-stone-400">Quick actions only fill the form. Nothing is saved until you press Save.</p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <Field label="Plan status">
                            <select className={inputCls} value={d.planStatus} onChange={e => set({ planStatus: e.target.value as PlanStatus })}>
                                <option value="trial">Trial</option>
                                <option value="paid">Paid</option>
                                <option value="expired">Expired</option>
                            </select>
                        </Field>
                    </div>
                    <Field label="Credits left" hint="Articles a paid user can still create">
                        <input type="number" min={0} className={inputCls} value={d.creditsRemaining} onChange={e => set({ creditsRemaining: e.target.value })} />
                    </Field>
                    <Field label="Trial articles used" hint="Trial users get 3">
                        <input type="number" min={0} className={inputCls} value={d.trialArticlesCreated} onChange={e => set({ trialArticlesCreated: e.target.value })} />
                    </Field>
                    <Field label="Subscription start" hint="Changing it alone resets end +30 days and credits to 30">
                        <input type="date" className={inputCls} value={d.subscriptionStartDate} onChange={e => set({ subscriptionStartDate: e.target.value })} />
                    </Field>
                    <Field label="Subscription end">
                        <input type="date" className={inputCls} value={d.subscriptionEndDate} onChange={e => set({ subscriptionEndDate: e.target.value })} />
                    </Field>
                    <Field label="Trial end">
                        <input type="date" className={inputCls} value={d.trialEndDate} onChange={e => set({ trialEndDate: e.target.value })} />
                    </Field>
                    <div className="col-span-2">
                        <Field label="Note (saved in the log)">
                            <input className={inputCls} placeholder="e.g. Paid by Zelle, Oct 2026" value={d.note} onChange={e => set({ note: e.target.value })} />
                        </Field>
                    </div>
                </div>

                {Object.keys(changes).length > 0 && (
                    <div className="mt-5 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
                        Will change: {Object.keys(changes).join(', ')}
                    </div>
                )}
                {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                <div className="mt-6 flex gap-3">
                    <button disabled={saving} onClick={save} className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2.5 font-semibold text-stone-700 hover:bg-stone-100">Cancel</button>
                </div>

                {user.businesses.length > 0 && (
                    <div className="mt-8">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Businesses</p>
                        <ul className="mt-2 space-y-1 text-sm text-stone-600">
                            {user.businesses.map(b => <li key={b.url + b.name}>{b.name} <span className="text-stone-400">{b.url}</span></li>)}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export const AdminUsersTab: React.FC = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all' | PlanStatus>('all');
    const [editing, setEditing] = useState<AdminUser | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setUsers((await api('GET')).users || []); }
        catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter(u => (status === 'all' || u.planStatus === status) &&
            (!q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q) || u.businesses.some(b => `${b.name} ${b.url}`.toLowerCase().includes(q))));
    }, [users, search, status]);

    const counts = useMemo(() => ({
        all: users.length,
        paid: users.filter(u => u.planStatus === 'paid').length,
        trial: users.filter(u => u.planStatus === 'trial').length,
        expired: users.filter(u => u.planStatus === 'expired').length,
    }), [users]);

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">Users</h1>
                    <p className="mt-1 text-stone-500">Change plans, credits and dates by hand. Every change is recorded in the activity log.</p>
                </div>
                <button onClick={load} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">Refresh</button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
                {(['all', 'paid', 'trial', 'expired'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${status === s ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'}`}>
                        {s} <span className="opacity-60">{counts[s]}</span>
                    </button>
                ))}
                <input className="ml-auto w-full rounded-lg border border-stone-300 px-3 py-2 text-sm sm:w-72" placeholder="Search email, name or business" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {notice && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-stone-50 text-left text-xs font-bold uppercase tracking-wider text-stone-500">
                        <tr>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Plan</th>
                            <th className="px-4 py-3">Credits</th>
                            <th className="px-4 py-3">Trial used</th>
                            <th className="px-4 py-3">Subscription</th>
                            <th className="px-4 py-3">Published</th>
                            <th className="px-4 py-3">Last sign-in</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-400">Loading users...</td></tr>}
                        {!loading && shown.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-400">No users match.</td></tr>}
                        {!loading && shown.map(u => (
                            <tr key={u.id} className="hover:bg-stone-50">
                                <td className="px-4 py-3">
                                    <p className="font-semibold text-stone-900">{u.email}</p>
                                    <p className="text-xs text-stone-500">{[u.fullName, u.businesses[0]?.name, u.role === 'admin' ? 'admin' : ''].filter(Boolean).join(' · ') || '—'}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[u.planStatus] || STATUS_STYLE.expired}`}>{u.planStatus}</span>
                                    {u.stripeCustomer && <span className="ml-1 text-xs text-stone-400">Stripe</span>}
                                </td>
                                <td className="px-4 py-3 font-semibold text-stone-800">{u.creditsRemaining ?? '—'}</td>
                                <td className="px-4 py-3 text-stone-600">{u.trialArticlesCreated}/3</td>
                                <td className="px-4 py-3 text-stone-600">
                                    {u.subscriptionEndDate ? <>until {fmt(u.subscriptionEndDate)}</> : u.trialEndDate ? <>trial until {fmt(u.trialEndDate)}</> : '—'}
                                    {isLapsed(u) && <p className="text-xs font-semibold text-red-600">End date passed</p>}
                                </td>
                                <td className="px-4 py-3 text-stone-600">{u.publishedArticles}</td>
                                <td className="px-4 py-3 text-stone-500">{fmt(u.lastSignInAt)}</td>
                                <td className="px-4 py-3 text-right">
                                    {u.hasProfile
                                        ? <button onClick={() => { setNotice(''); setEditing(u); }} className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700">Edit</button>
                                        : <span className="text-xs text-stone-400">No profile</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editing && (
                <EditPanel user={editing} onClose={() => setEditing(null)} onSaved={msg => { setEditing(null); setNotice(msg); load(); }} />
            )}
        </div>
    );
};
