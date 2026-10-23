import { useEffect, useRef, useState } from 'react';
import DraftInput from './draft-input';
import { api } from './types';
import type { Activity, Failure, Page, Person, Project } from './types';

export default function Projects({ projects, people, refresh, openTasks }: { projects: Project[]; people: Person[]; refresh: () => Promise<void>; openTasks: (id: string) => void }) {
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Partial<Project>>>({});
    const draftRef = useRef(drafts);
    const [errors, setErrors] = useState<Record<string, Failure>>({});
    const [events, setEvents] = useState<Activity[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [filter, setFilter] = useState('all');
    const chains = useRef<Record<string, Promise<void>>>({});
    const versions = useRef<Record<string, number>>({});
    const [createError, setCreateError] = useState('');
    const [creating, setCreating] = useState(false);
    const update = (p: Project, patch: Partial<Project>, expected?: number) => {
        draftRef.current = { ...draftRef.current, [p.id]: { ...draftRef.current[p.id], ...patch } }; setDrafts(draftRef.current);
        chains.current[p.id] = (chains.current[p.id] ?? Promise.resolve()).then(async () => {
            const data = { ...draftRef.current[p.id] };
            if (!Object.keys(data).length) return;
            try {
                const result = await api<Project>(`projects/${p.id}`, 'PATCH', { ...data, expected_version: expected ?? versions.current[p.id] ?? p.version });
                versions.current[p.id] = result.version;
                const rest = { ...draftRef.current[p.id] };
                for (const key of Object.keys(data) as (keyof Project)[]) if (rest[key] === data[key]) delete rest[key];
                draftRef.current = { ...draftRef.current, [p.id]: rest }; setDrafts(draftRef.current);
                setErrors(old => { const next = { ...old }; delete next[p.id]; return next; });
                await refresh();
            } catch (error) { setErrors(old => ({ ...old, [p.id]: error as Failure })); }
        });
    };
    const create = async () => {
        if (!name.trim()) return;
        setCreating(true);
        try { const p = await api<Project>('projects', 'POST', { name: name.trim() }); setName(''); setCreateError(''); await refresh(); setSelected(p.id); }
        catch (error) { setCreateError((error as Failure).message); }
        finally { setCreating(false); }
    };
    useEffect(() => {
        if (selected) void api<Page<Activity>>(`activities?subject_id=${selected}&page=${historyPage}`).then(result => { setEvents(result.data); setLastPage(result.last_page); });
    }, [selected, projects, historyPage]);
    return <section className="projects-view"><form className="project-create" onSubmit={e => { e.preventDefault(); void create(); }}><input aria-label="Neues Projekt" placeholder="Neues Projekt – nur ein Titel genügt" maxLength={160} value={name} onChange={e => setName(e.target.value)} /><button disabled={creating} type="submit">Projekt anlegen</button></form>{createError && <p role="alert">Nicht synchronisiert: {createError}. Titel bleibt erhalten; erneut mit Enter versuchen.</p>}<label className="project-status-filter">Projektstatus <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Alle inkl. Archiv</option><option value="active">Aktiv</option><option value="completed">Abgeschlossen</option><option value="archived">Archiviert</option></select></label>
        <div className="project-grid">{projects.filter(p => filter === 'all' || p.status === filter).map(server => {
            const p = { ...server, ...drafts[server.id] };
            return <article className="project-card" key={p.id} style={{ borderTopColor: p.color || '#42684c' }}><DraftInput label="Projektname" maxLength={160} value={p.name} onCommit={name => update(server, { name })} /><span className="project-count">{p.open_tasks ?? 0} offen · {p.done_tasks ?? 0} erledigt</span><div className="project-dates"><label>Geplanter Start<input aria-label="Projektstart" type="date" value={p.starts_on ?? ''} onChange={e => update(server, { starts_on: e.target.value || null })} /></label><label>Geplantes Ende<input aria-label="Projektende" type="date" value={p.ends_on ?? ''} onChange={e => update(server, { ends_on: e.target.value || null })} /></label></div><label>Status<select aria-label="Projektstatus" value={p.status} onChange={e => update(server, { status: e.target.value as Project['status'] })}><option value="active">Aktiv</option><option value="completed">Abgeschlossen</option><option value="archived">Archiviert</option></select></label><label>Farbe<input aria-label="Projektfarbe" type="color" value={p.color || '#42684c'} onChange={e => update(server, { color: e.target.value })} /></label><DraftInput multiline label="Projektbeschreibung" maxLength={50000} value={p.description ?? ''} onCommit={description => update(server, { description })} /><div className="project-actions"><button onClick={() => openTasks(p.id)}>Aufgaben öffnen / erfassen →</button><button onClick={() => { setSelected(selected === p.id ? null : p.id); setHistoryPage(1); }}>Chronik</button></div>{Object.keys(drafts[p.id] ?? {}).length > 0 && <p className="sync-state" role="status">{errors[p.id] ? <>Nicht synchronisiert: {errors[p.id].message} <button onClick={() => update(server, {}, errors[p.id].current?.version)}>Entwurf erneut senden{errors[p.id].current ? ' auf Basis der aktuellen Serverversion' : ''}</button>{errors[p.id].current && <pre>{JSON.stringify(errors[p.id].current, null, 2)}</pre>}</> : 'Wird gespeichert …'}</p>}{selected === p.id && <div className="project-history"><p className="muted">Bedienaktionen, keine tatsächliche Arbeitsdauer.</p>{events.map(a => <p key={a.id}>{people.find(u => u.id === a.actor_id)?.name} · {new Date(a.occurred_at.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}<br />{a.event === 'created' ? 'Projekt angelegt' : a.event === 'completed' ? 'Abgeschlossen' : 'Projekt geändert'}<br /><small>{JSON.stringify(a.before)} → {JSON.stringify(a.after)}</small></p>)}<button disabled={historyPage <= 1} onClick={() => setHistoryPage(historyPage - 1)}>Neuer</button><button disabled={historyPage >= lastPage} onClick={() => setHistoryPage(historyPage + 1)}>Älter</button></div>}</article>;
        })}</div>{!projects.length && <p className="empty-small">Ein Projekt beginnt mit einer Idee. Lege oben das erste an.</p>}</section>;
}
