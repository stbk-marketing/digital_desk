import { Head, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Archive,
    ArrowDownToLine,
    CalendarDays,
    CheckCheck,
    ClipboardList,
    Folder,
    History,
    LogOut,
    Plus,
    Search,
    Settings,
    Snowflake,
} from 'lucide-react';
import DraftInput from '@/workspace/draft-input';
import { ActivityLog, ConflictSummary } from '@/workspace/activity-log';
import Projects from '@/workspace/projects';
import Calendar from '@/workspace/calendar';
import YearPlan from '@/workspace/year-plan';
import { api, todayBerlin } from '@/workspace/types';
import type {
    Activity,
    Failure,
    Page,
    Person,
    Project,
    Task,
} from '@/workspace/types';
import '../../css/workspace.css';

type View =
    | 'Schreibtisch'
    | 'Kalender'
    | 'Projekte'
    | 'Jahresplan'
    | 'Wochencheck';
type Draft = {
    data: Partial<Task>;
    error?: Failure;
    saving?: boolean;
    create?: boolean;
    base?: Task;
};
const views: { name: View; icon: typeof ClipboardList }[] = [
    { name: 'Schreibtisch', icon: ClipboardList },
    { name: 'Kalender', icon: CalendarDays },
    { name: 'Projekte', icon: Folder },
    { name: 'Jahresplan', icon: ArrowDownToLine },
    { name: 'Wochencheck', icon: CheckCheck },
];

export default function Workspace({
    members,
    people,
}: {
    members: Person[];
    people: Person[];
}) {
    const { auth } = usePage<{ auth: { user: Person } }>().props;
    const [view, setView] = useState<View>(
        () =>
            (typeof window !== 'undefined'
                ? views.find(
                      (v) => v.name === localStorage.getItem('workspace-view'),
                  )?.name
                : undefined) || 'Schreibtisch',
    );
    const [tasks, setTasks] = useState<Task[]>([]);
    const tasksRef = useRef<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const draftRef = useRef<Record<string, Draft>>({});
    const chains = useRef<Record<string, Promise<void>>>({});
    const [title, setTitle] = useState('');
    const [captureDate, setCaptureDate] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [project, setProject] = useState('');
    const [person, setPerson] = useState('');
    const [archive, setArchive] = useState('current');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, last_page: 1 });
    const [summary, setSummary] = useState<{
        overdue: number;
        unorganized: number;
        done: number;
    } | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLast, setHistoryLast] = useState(1);
    const [notice, setNotice] = useState('');
    const [undo, setUndo] = useState<{
        id: string;
        status: 'open' | 'done';
    } | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const cursor = useRef(0);
    const loadSequence = useRef(0);
    const [check, setCheck] = useState('overdue');
    const updateDrafts = (next: Record<string, Draft>) => {
        draftRef.current = next;
        setDrafts(next);
    };
    const accept = (task: Task) => {
        tasksRef.current = [
            task,
            ...tasksRef.current.filter((t) => t.id !== task.id),
        ];
        setTasks(tasksRef.current);
    };
    const load = useCallback(async () => {
        const sequence = ++loadSequence.current;
        try {
            const params = new URLSearchParams({
                q: query,
                status,
                project_id: project,
                assigned_to: person,
                archive,
                page: String(page),
                ...(view === 'Wochencheck' ? { check } : {}),
            });
            const result = await api<{
                tasks: Page<Task>;
                cursor: number;
                summary: {
                    overdue: number;
                    unorganized: number;
                    done: number;
                } | null;
            }>(`tasks?${params}`);
            if (sequence !== loadSequence.current) return;
            tasksRef.current = result.tasks.data;
            setTasks(result.tasks.data);
            setPagination(result.tasks);
            setSummary(result.summary);
            setNotice('');
        } catch {
            setNotice(
                'Verbindung unterbrochen. Angezeigte Daten bleiben erhalten.',
            );
        }
    }, [query, status, project, person, archive, page, view, check]);
    const loadProjects = useCallback(async () => {
        try {
            setProjects(await api<Project[]>('projects'));
        } catch {
            setNotice('Projekte konnten nicht geladen werden.');
        }
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => void load(), 180);
        return () => clearTimeout(timer);
    }, [load]);
    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);
    useEffect(() => {
        let busy = false;
        const poll = async (force = false) => {
            if (document.visibilityState !== 'visible' || busy) return;
            busy = true;
            try {
                const result = await api<{ cursor: number; changed: boolean }>(
                    `changes?since=${cursor.current}`,
                );
                if (force || result.changed) {
                    await Promise.all([load(), loadProjects()]);
                    setRevision((r) => r + 1);
                }
                cursor.current = result.cursor;
            } catch {
                setNotice(
                    'Offline / nicht synchronisiert. Lokale Entwürfe bleiben erhalten.',
                );
            } finally {
                busy = false;
            }
        };
        const refresh = () => void poll(true);
        const interval = setInterval(() => void poll(), 7000);
        window.addEventListener('focus', refresh);
        window.addEventListener('online', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('online', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [load, loadProjects]);
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const editing = (event.target as HTMLElement)?.closest(
                'input,textarea,select,[contenteditable]',
            );
            if (
                ((event.ctrlKey || event.metaKey) && event.key === 'k') ||
                (!editing && event.key.toLowerCase() === 'n')
            ) {
                event.preventDefault();
                input.current?.focus();
            }
            if (event.key === 'Escape') setSelected(null);
        };
        const leave = (event: BeforeUnloadEvent) => {
            if (Object.keys(draftRef.current).length) event.preventDefault();
        };
        window.addEventListener('keydown', handler);
        window.addEventListener('beforeunload', leave);
        return () => {
            window.removeEventListener('keydown', handler);
            window.removeEventListener('beforeunload', leave);
        };
    }, []);
    useEffect(() => {
        if (!selected) return;
        void api<Page<Activity>>(
            `activities?subject_id=${selected}&page=${historyPage}`,
        )
            .then((result) => {
                setActivities(result.data);
                setHistoryLast(result.last_page);
            })
            .catch(() => setNotice('Verlauf nicht erreichbar.'));
    }, [selected, tasks, historyPage]);
    const mutate = (task: Task, data: Partial<Task>, retry = false) => {
        const old = draftRef.current[task.id];
        updateDrafts({
            ...draftRef.current,
            [task.id]: {
                data: { ...old?.data, ...data },
                saving: true,
                base: old?.base ?? task,
            },
        });
        chains.current[task.id] = (
            chains.current[task.id] ?? Promise.resolve()
        ).then(async () => {
            const draft = draftRef.current[task.id];
            if (!draft || (draft.error && !retry)) return;
            const payload = { ...draft.data };
            const current = draft.base ?? task;
            try {
                const result = await api<Task>(`tasks/${task.id}`, 'PATCH', {
                    ...payload,
                    expected_version: current.version,
                });
                accept(result);
                const remaining = { ...draftRef.current[task.id]?.data };
                for (const key of Object.keys(payload) as (keyof Task)[])
                    if (remaining[key] === payload[key]) delete remaining[key];
                const next = { ...draftRef.current };
                if (Object.keys(remaining).length)
                    next[task.id] = {
                        data: remaining,
                        saving: true,
                        base: result,
                    };
                else delete next[task.id];
                updateDrafts(next);
                setRevision((r) => r + 1);
                void loadProjects();
            } catch (error) {
                const failure = error as Failure;
                updateDrafts({
                    ...draftRef.current,
                    [task.id]: {
                        data: draftRef.current[task.id]?.data ?? payload,
                        error: failure,
                        base: task,
                    },
                });
            }
        });
    };
    const create = async (id: string, data: Partial<Task>) => {
        updateDrafts({
            ...draftRef.current,
            [id]: { data, create: true, saving: true },
        });
        try {
            const task = await api<Task>('tasks', 'POST', {
                ...data,
                request_id: id.replace('local-', ''),
            });
            const next = { ...draftRef.current };
            delete next[id];
            updateDrafts(next);
            accept(task);
            setRevision((r) => r + 1);
            void loadProjects();
        } catch (error) {
            updateDrafts({
                ...draftRef.current,
                [id]: { data, create: true, error: error as Failure },
            });
        }
    };
    const quickCreate = (due_on: string | null = captureDate) => {
        if (!title.trim()) {
            input.current?.focus();
            return;
        }
        void create(`local-${crypto.randomUUID()}`, {
            title: title.trim(),
            due_on,
            project_id: project || null,
        });
        setTitle('');
        input.current?.focus();
    };
    const displayed: Task[] = [
        ...Object.entries(drafts)
            .filter(([, d]) => d.create)
            .map(
                ([id, d]) =>
                    ({
                        id,
                        title: '',
                        status: 'open',
                        version: 0,
                        created_by: auth.user.id,
                        created_at: new Date().toISOString(),
                        ...d.data,
                    }) as Task,
            ),
        ...tasks.map((t) => ({ ...t, ...drafts[t.id]?.data })),
    ];
    // A failing draft stays visible even after a filter or team refresh.
    for (const [id, draft] of Object.entries(drafts))
        if (!draft.create && !displayed.some((t) => t.id === id)) {
            const base = draft.base;
            if (base) displayed.unshift({ ...base, ...draft.data });
        }
    const task = displayed.find((t) => t.id === selected);
    const name = (id: number | null) =>
        people.find((p) => p.id === id)?.name ?? '—';
    const openDetail = (id: string) => {
        setSelected(id);
        setActivities([]);
        setHistoryPage(1);
    };
    const toggle = (t: Task) => {
        const next = t.status === 'open' ? 'done' : 'open';
        mutate(t, { status: next });
        setUndo({ id: t.id, status: t.status });
        setTimeout(() => setUndo(null), 7000);
    };
    const row = (t: Task) => (
        <div
            className={`task-row ${t.status === 'done' ? 'is-done' : ''}`}
            key={t.id}
        >
            <input
                aria-label={`${t.title}: ${t.status === 'done' ? 'wieder öffnen' : 'erledigen'}`}
                type="checkbox"
                checked={t.status === 'done'}
                disabled={t.id.startsWith('local-')}
                onChange={() => toggle(t)}
            />
            <div className="task-title">
                <DraftInput
                    value={t.title}
                    label="Aufgabentitel"
                    disabled={t.id.startsWith('local-')}
                    onCommit={(title) => mutate(t, { title })}
                />
                <span className="task-sub">
                    {t.archived_at && 'Archiviert · '}
                    {projects.find((p) => p.id === t.project_id)?.name}
                </span>
            </div>
            <input
                className={
                    t.due_on && t.due_on < todayBerlin() && t.status === 'open'
                        ? 'overdue'
                        : ''
                }
                aria-label="Frist"
                type="date"
                value={t.due_on ?? ''}
                onChange={(e) => mutate(t, { due_on: e.target.value || null })}
                disabled={t.id.startsWith('local-')}
            />
            <select
                aria-label="Zuständig"
                disabled={t.id.startsWith('local-')}
                value={t.assigned_to ?? ''}
                onChange={(e) =>
                    mutate(t, {
                        assigned_to: e.target.value
                            ? Number(e.target.value)
                            : null,
                    })
                }
            >
                <option value="">Niemand</option>
                {t.assigned_to &&
                    !members.some((p) => p.id === t.assigned_to) && (
                        <option value={t.assigned_to} disabled>
                            {name(t.assigned_to)} (inaktiv)
                        </option>
                    )}
                {members.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>
            <select
                aria-label="Projekt zuordnen"
                disabled={t.id.startsWith('local-')}
                value={t.project_id ?? ''}
                onChange={(e) =>
                    mutate(t, { project_id: e.target.value || null })
                }
            >
                <option value="">Ohne Projekt</option>
                {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>
            <button
                aria-label={`Details: ${t.title}`}
                disabled={t.id.startsWith('local-')}
                onClick={() => openDetail(t.id)}
            >
                <History size={17} />
            </button>
            {drafts[t.id] && (
                <div className="sync-state" role="status">
                    {drafts[t.id].error ? (
                        <>
                            <strong>Nicht synchronisiert.</strong>{' '}
                            {drafts[t.id].error?.message}{' '}
                            <button
                                onClick={() =>
                                    drafts[t.id].create
                                        ? void create(t.id, drafts[t.id].data)
                                        : mutate(t, {}, true)
                                }
                            >
                                Erneut versuchen
                            </button>
                            {drafts[t.id].error?.current && (
                                <>
                                    <ConflictSummary
                                        record={
                                            drafts[t.id].error?.current as Task
                                        }
                                        people={people}
                                        projects={projects}
                                    />
                                    <button
                                        onClick={() => {
                                            accept(
                                                drafts[t.id].error
                                                    ?.current as Task,
                                            );
                                            updateDrafts({
                                                ...draftRef.current,
                                                [t.id]: {
                                                    ...draftRef.current[t.id],
                                                    error: undefined,
                                                    base: drafts[t.id].error
                                                        ?.current as Task,
                                                },
                                            });
                                            mutate(t, {}, true);
                                        }}
                                    >
                                        Entwurf auf aktueller Serverversion
                                        erneut senden
                                    </button>
                                    <button
                                        onClick={() => {
                                            accept(
                                                drafts[t.id].error
                                                    ?.current as Task,
                                            );
                                            const next = {
                                                ...draftRef.current,
                                            };
                                            delete next[t.id];
                                            updateDrafts(next);
                                        }}
                                    >
                                        Entwurf verwerfen, Serverstand verwenden
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        'Wird gespeichert …'
                    )}
                </div>
            )}
        </div>
    );
    const group = (label: string, items: Task[], collapsed = false) => (
        <details className="task-group" key={label} open={!collapsed}>
            <summary>
                {label}
                <span>{items.length}</span>
            </summary>
            {items.map(row)}
            {!items.length && (
                <p className="empty-small">Hier ist alles aufgeräumt.</p>
            )}
        </details>
    );

    return (
        <div className="workspace-shell">
            <Head title={view} />
            <aside className="workspace-nav">
                <a href="/workspace" className="brand">
                    <Snowflake />{' '}
                    <span>
                        KÜHL<small>WORKSPACE</small>
                    </span>
                </a>
                <p className="nav-caption">DEIN DIGITALER SCHREIBTISCH</p>
                <nav>
                    {views.map((v) => (
                        <button
                            key={v.name}
                            className={view === v.name ? 'active' : ''}
                            onClick={() => {
                                setView(v.name);
                                localStorage.setItem('workspace-view', v.name);
                                setPage(1);
                            }}
                        >
                            <v.icon size={19} />
                            {v.name}
                        </button>
                    ))}
                </nav>
                <div className="nav-bottom">
                    <span className="avatar">{auth.user.name.slice(0, 1)}</span>
                    <span>
                        {auth.user.name}
                        <small>Gemeinsamer Workspace</small>
                    </span>
                    <a
                        aria-label="Profil und Passwort"
                        href="/settings/profile"
                    >
                        <Settings size={17} />
                    </a>
                    <button
                        aria-label="Abmelden"
                        onClick={() => router.post('/logout')}
                    >
                        <LogOut size={17} />
                    </button>
                </div>
            </aside>
            <main className="workspace-main">
                <header>
                    <div>
                        <p className="eyebrow">
                            STADTBÄCKEREI KÜHL · GEMEINSAM GUT ORGANISIERT
                        </p>
                        <h1>{view}</h1>
                        <p className="subtitle">
                            {view === 'Schreibtisch'
                                ? 'Gedanken festhalten. Gemeinsam Dinge erledigen.'
                                : 'Alles im Blick, Schritt für Schritt.'}
                        </p>
                    </div>
                    <span className="today">
                        {new Intl.DateTimeFormat('de-DE', {
                            dateStyle: 'full',
                            timeZone: 'Europe/Berlin',
                        }).format(new Date())}
                    </span>
                </header>
                <form
                    className="quick-capture"
                    onSubmit={(e) => {
                        e.preventDefault();
                        quickCreate();
                    }}
                >
                    <Plus size={23} />
                    <input
                        ref={input}
                        aria-label="Neue Aufgabe"
                        placeholder="Was gibt es zu tun? Einfach schreiben …"
                        maxLength={500}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <kbd>Enter ↵</kbd>
                    <button type="submit" aria-label="Aufgabe hinzufügen">
                        Hinzufügen
                    </button>
                </form>
                <div className="filter-bar">
                    <label className="search">
                        <Search size={17} />
                        <input
                            aria-label="Alle Aufgaben durchsuchen"
                            placeholder="Suchen, auch in erledigten Aufgaben …"
                            value={query}
                            onChange={(e) => {
                                if (!query && e.target.value) setArchive('all');
                                setQuery(e.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                    <select
                        aria-label="Statusfilter"
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="all">Alle Status</option>
                        <option value="open">Offen</option>
                        <option value="done">Erledigt</option>
                        <option value="overdue">Überfällig</option>
                    </select>
                    <select
                        aria-label="Projektfilter"
                        value={project}
                        onChange={(e) => {
                            setProject(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">Alle Projekte</option>
                        {projects.map((p) => (
                            <option value={p.id} key={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Personenfilter"
                        value={person}
                        onChange={(e) => {
                            setPerson(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">Alle Personen</option>
                        {members.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Archivfilter"
                        value={archive}
                        onChange={(e) => {
                            setArchive(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="current">Aktueller Schreibtisch</option>
                        <option value="all">Alle inkl. Archiv</option>
                        <option value="archived">Archiv</option>
                    </select>
                </div>
                {captureDate && (
                    <p className="capture-date">
                        Neue Aufgabe am {captureDate}{' '}
                        <button onClick={() => setCaptureDate(null)}>
                            Datum entfernen ×
                        </button>
                    </p>
                )}
                {notice && (
                    <p className="notice" role="alert">
                        {notice}{' '}
                        <button onClick={() => void load()}>
                            Erneut laden
                        </button>
                    </p>
                )}
                {view === 'Jahresplan' && <YearPlan revision={revision} />}
                {query && view === 'Schreibtisch' && (
                    <section
                        className="project-search-results"
                        aria-label="Gefundene Projekte"
                    >
                        {projects
                            .filter((p) =>
                                `${p.name} ${p.description ?? ''}`
                                    .toLocaleLowerCase('de-DE')
                                    .includes(query.toLocaleLowerCase('de-DE')),
                            )
                            .map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setProject(p.id);
                                        setView('Projekte');
                                    }}
                                >
                                    {p.status === 'archived'
                                        ? 'Archiviertes Projekt: '
                                        : 'Projekt: '}
                                    {p.name}
                                </button>
                            ))}
                    </section>
                )}
                {view === 'Wochencheck' && summary && (
                    <p className="weekly-summary">
                        {summary.overdue} überfällig · {summary.unorganized}{' '}
                        ungeordnet · {summary.done} diese Woche erledigt
                    </p>
                )}
                {view !== 'Schreibtisch' &&
                    view !== 'Wochencheck' &&
                    Object.keys(drafts).length > 0 && (
                        <section aria-label="Noch nicht synchronisierte Aufgaben">
                            {displayed.filter((t) => drafts[t.id]).map(row)}
                        </section>
                    )}
                <div hidden={view !== 'Projekte'}>
                    <Projects
                        projects={projects}
                        projectId={project}
                        query={query}
                        people={people}
                        refresh={loadProjects}
                        openTasks={(id) => {
                            setProject(id);
                            setView('Schreibtisch');
                            setPage(1);
                            input.current?.focus();
                        }}
                    />
                </div>
                {view === 'Kalender' && (
                    <Calendar
                        projects={projects}
                        person={person}
                        project={project}
                        revision={revision}
                        create={(date) => {
                            setCaptureDate(date);
                            input.current?.focus();
                        }}
                        openTask={(t) => {
                            accept(t);
                            openDetail(t.id);
                        }}
                        openProject={(id) => {
                            setProject(id);
                            setView('Projekte');
                        }}
                        mutate={mutate}
                    />
                )}
                {view === 'Wochencheck' && (
                    <div className="check-tabs">
                        {[
                            ['overdue', 'Überfällig'],
                            ['undated', 'Ohne Termin seit > 7 Tagen'],
                            ['unassigned', 'Ohne Projekt seit > 7 Tagen'],
                            ['recent', 'Diese Woche erledigt'],
                        ].map(([value, label]) => (
                            <button
                                className={check === value ? 'active' : ''}
                                key={value}
                                onClick={() => {
                                    setCheck(value);
                                    setPage(1);
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {(view === 'Schreibtisch' || view === 'Wochencheck') && (
                    <>
                        {group(
                            'Überfällig',
                            displayed.filter(
                                (t) =>
                                    t.status === 'open' &&
                                    t.due_on &&
                                    t.due_on < todayBerlin(),
                            ),
                        )}
                        {group(
                            'Heute',
                            displayed.filter(
                                (t) =>
                                    t.status === 'open' &&
                                    t.due_on === todayBerlin(),
                            ),
                        )}
                        {group(
                            'Demnächst',
                            displayed.filter(
                                (t) =>
                                    t.status === 'open' &&
                                    t.due_on &&
                                    t.due_on > todayBerlin(),
                            ),
                        )}
                        {group(
                            'Eingang / ohne Termin',
                            displayed.filter(
                                (t) => t.status === 'open' && !t.due_on,
                            ),
                        )}
                        {group(
                            'Erledigt',
                            displayed.filter((t) => t.status === 'done'),
                            !query && status !== 'done' && check !== 'recent',
                        )}
                        <div className="pagination">
                            <span>
                                {pagination.total} Treffer · Seite {page} /{' '}
                                {pagination.last_page} (Abschnittszahlen auf
                                dieser Seite)
                            </span>
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Zurück
                            </button>
                            <button
                                disabled={page >= pagination.last_page}
                                onClick={() => setPage(page + 1)}
                            >
                                Weiter
                            </button>
                        </div>
                    </>
                )}
                {undo && (
                    <div className="undo" role="status">
                        Status geändert.{' '}
                        <button
                            onClick={() => {
                                const current = tasksRef.current.find(
                                    (t) => t.id === undo.id,
                                );
                                if (current)
                                    mutate(current, { status: undo.status });
                                setUndo(null);
                            }}
                        >
                            Rückgängig
                        </button>
                    </div>
                )}
            </main>
            {task && (
                <aside className="detail-panel" aria-label="Aufgabendetails">
                    <button className="close" onClick={() => setSelected(null)}>
                        Schließen ×
                    </button>
                    <p className="eyebrow">AUFGABENDETAILS</p>
                    <label>
                        Frist
                        <input
                            type="date"
                            value={task.due_on ?? ''}
                            onChange={(e) =>
                                mutate(task, { due_on: e.target.value || null })
                            }
                        />
                    </label>
                    <DraftInput
                        value={task.title}
                        label="Titel im Detail"
                        onCommit={(title) => mutate(task, { title })}
                    />
                    <label>
                        Projekt
                        <select
                            value={task.project_id ?? ''}
                            onChange={(e) =>
                                mutate(task, {
                                    project_id: e.target.value || null,
                                })
                            }
                        >
                            <option value="">Ohne Projekt</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Zurückstellen bis
                        <input
                            type="date"
                            value={task.snoozed_until ?? ''}
                            onChange={(e) =>
                                mutate(task, {
                                    snoozed_until: e.target.value || null,
                                })
                            }
                        />
                    </label>
                    <label>
                        Notizen
                        <DraftInput
                            multiline
                            maxLength={50000}
                            value={task.notes ?? ''}
                            label="Notizen"
                            onCommit={(notes) => mutate(task, { notes })}
                        />
                    </label>
                    <p>
                        Angelegt von <strong>{name(task.created_by)}</strong>
                    </p>
                    <p>
                        Zugewiesen an <strong>{name(task.assigned_to)}</strong>
                    </p>
                    <p>
                        Erledigt markiert von{' '}
                        <strong>{name(task.completed_by)}</strong>
                    </p>
                    <button
                        onClick={() =>
                            mutate(task, {
                                archived: !task.archived_at,
                            } as Partial<Task>)
                        }
                    >
                        <Archive size={16} />{' '}
                        {task.archived_at ? 'Wiederherstellen' : 'Archivieren'}
                    </button>
                    <h2>Verlauf</h2>
                    <p className="muted">
                        Bedienaktionen, keine Arbeitszeitnachweise.
                    </p>
                    {activities.map((a) => (
                        <ActivityLog
                            key={a.id}
                            activity={a}
                            people={people}
                            projects={projects}
                        />
                    ))}
                    <button
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage(historyPage - 1)}
                    >
                        Neuer
                    </button>
                    <button
                        disabled={historyPage >= historyLast}
                        onClick={() => setHistoryPage(historyPage + 1)}
                    >
                        Älter
                    </button>
                </aside>
            )}
        </div>
    );
}
