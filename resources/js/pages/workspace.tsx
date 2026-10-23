import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkspaceNavigation from '@/workspace/navigation';
import TaskSection from '@/workspace/task-section';
import RecordActions from '@/workspace/record-actions';
import Trash from '@/workspace/trash';
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
    Plus,
    Search,
    Trash2,
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

type View =
    | 'Schreibtisch'
    | 'Kalender'
    | 'Projekte'
    | 'Jahresplan'
    | 'Wochencheck'
    | 'Papierkorb';
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
    { name: 'Papierkorb', icon: Trash2 },
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
    const removedIds = useRef(new Set<string>());
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
            for (const task of result.tasks.data)
                removedIds.current.delete(task.id);
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
                let more = true;
                let changed = force;
                while (more) {
                    const result = await api<{
                        cursor: number;
                        changed: boolean;
                        more: boolean;
                        removed: { type: string; id: string }[];
                    }>(`changes?since=${cursor.current}`);
                    for (const removed of result.removed ?? []) {
                        if (removed.type === 'task')
                            removedIds.current.add(removed.id);
                        if (
                            removed.type === 'project' &&
                            project === removed.id
                        )
                            setProject('');
                    }
                    if (result.removed?.some((item) => item.id === selected))
                        setSelected(null);
                    changed ||= result.changed;
                    more = result.more;
                    cursor.current = result.cursor;
                }
                if (changed) {
                    await Promise.all([load(), loadProjects()]);
                    setRevision((r) => r + 1);
                }
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
    }, [load, loadProjects, project, selected]);
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
                if (failure.deleted || failure.current?.deleted_at)
                    removedIds.current.add(task.id);
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
    ].filter((t) => !removedIds.current.has(t.id));
    // A failing draft stays visible even after a filter or team refresh.
    for (const [id, draft] of Object.entries(drafts))
        if (
            !draft.create &&
            !removedIds.current.has(id) &&
            !displayed.some((t) => t.id === id)
        ) {
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
    const refreshWorkspace = async () => {
        await Promise.all([load(), loadProjects()]);
        setSelected(null);
        setRevision((r) => r + 1);
    };
    const afterTaskDelete = async (id: string) => {
        removedIds.current.add(id);
        await refreshWorkspace();
    };
    const row = (t: Task) => (
        <div
            className={`task-row flex flex-wrap items-center gap-3 border-t p-4 ${t.status === 'done' ? 'is-done' : ''}`}
            key={t.id}
        >
            <Checkbox
                aria-label={`${t.title}: ${t.status === 'done' ? 'wieder öffnen' : 'erledigen'}`}
                checked={t.status === 'done'}
                disabled={t.id.startsWith('local-')}
                onCheckedChange={() => toggle(t)}
            />
            <div className="task-title min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-[14rem]">
                <DraftInput
                    value={t.title}
                    label="Aufgabentitel"
                    className={
                        t.status === 'done'
                            ? 'text-muted-foreground line-through'
                            : undefined
                    }
                    disabled={t.id.startsWith('local-')}
                    onCommit={(title) => mutate(t, { title })}
                />
                <span className="task-sub mt-1 block truncate text-xs text-muted-foreground">
                    {t.archived_at && 'Archiviert · '}
                    {projects.find((p) => p.id === t.project_id)?.name}
                </span>
            </div>
            <Input
                className={
                    t.due_on && t.due_on < todayBerlin() && t.status === 'open'
                        ? 'w-[9rem] text-destructive'
                        : 'w-[9rem]'
                }
                aria-label="Frist"
                type="date"
                value={t.due_on ?? ''}
                onChange={(e) => mutate(t, { due_on: e.target.value || null })}
                disabled={t.id.startsWith('local-')}
            />
            <NativeSelect
                aria-label="Zuständig"
                className="w-32 truncate"
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
                <NativeSelectOption value="">Niemand</NativeSelectOption>
                {t.assigned_to &&
                    !members.some((p) => p.id === t.assigned_to) && (
                        <NativeSelectOption value={t.assigned_to} disabled>
                            {name(t.assigned_to)} (inaktiv)
                        </NativeSelectOption>
                    )}
                {members.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                        {p.name}
                    </NativeSelectOption>
                ))}
            </NativeSelect>
            <NativeSelect
                aria-label="Projekt zuordnen"
                className="w-36 truncate"
                disabled={t.id.startsWith('local-')}
                value={t.project_id ?? ''}
                onChange={(e) =>
                    mutate(t, { project_id: e.target.value || null })
                }
            >
                <NativeSelectOption value="">Ohne Projekt</NativeSelectOption>
                {projects.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                        {p.name}
                    </NativeSelectOption>
                ))}
            </NativeSelect>
            <Button
                variant="outline"
                size="icon"
                aria-label={`Details: ${t.title}`}
                disabled={t.id.startsWith('local-')}
                onClick={() => openDetail(t.id)}
            >
                <History size={17} />
            </Button>
            {drafts[t.id] && (
                <div
                    className="sync-state basis-full space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground"
                    role="status"
                >
                    {drafts[t.id].error ? (
                        <>
                            <strong>Nicht synchronisiert.</strong>{' '}
                            {drafts[t.id].error?.message}{' '}
                            <Button
                                variant="outline"
                                onClick={() =>
                                    drafts[t.id].create
                                        ? void create(t.id, drafts[t.id].data)
                                        : mutate(t, {}, true)
                                }
                            >
                                Erneut versuchen
                            </Button>
                            {drafts[t.id].error?.current && (
                                <>
                                    <ConflictSummary
                                        record={
                                            drafts[t.id].error?.current as Task
                                        }
                                        people={people}
                                        projects={projects}
                                    />
                                    <Button
                                        variant="outline"
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
                                    </Button>
                                    <Button
                                        variant="outline"
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
                                    </Button>
                                </>
                            )}
                        </>
                    ) : (
                        'Wird gespeichert …'
                    )}
                </div>
            )}
            <RecordActions
                type="task"
                record={t}
                disabled={t.id.startsWith('local-') || !!drafts[t.id]}
                refresh={() => afterTaskDelete(t.id)}
            />
        </div>
    );
    const group = (label: string, items: Task[], collapsed = false) => (
        <TaskSection
            key={label}
            label={label}
            count={items.length}
            collapsed={collapsed}
        >
            {items.map(row)}
            {!items.length && (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Hier ist alles aufgeräumt.
                </p>
            )}
        </TaskSection>
    );

    return (
        <SidebarProvider className="workspace-shell">
            <Head title={view} />
            <WorkspaceNavigation
                view={view}
                user={auth.user}
                logout={() => router.post('/logout')}
                onView={(next) => {
                    setView(next);
                    localStorage.setItem('workspace-view', next);
                    setPage(1);
                }}
            />
            <SidebarInset className="min-w-0">
                <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-4 md:px-6">
                    <SidebarTrigger aria-label="Navigation umschalten" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <span className="text-sm text-muted-foreground">
                        {view}
                    </span>
                </div>
                <main className="workspace-main flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
                    <header className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="mt-1 text-xl font-semibold">
                                {view}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {view === 'Schreibtisch'
                                    ? 'Gedanken festhalten. Gemeinsam Dinge erledigen.'
                                    : 'Alles im Blick, Schritt für Schritt.'}
                            </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {new Intl.DateTimeFormat('de-DE', {
                                dateStyle: 'full',
                                timeZone: 'Europe/Berlin',
                            }).format(new Date())}
                        </span>
                    </header>
                    <form
                        className="quick-capture sticky top-0 z-20 flex items-center gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
                        onSubmit={(e) => {
                            e.preventDefault();
                            quickCreate();
                        }}
                    >
                        <Plus size={23} />
                        <Input
                            ref={input}
                            className="min-w-0 flex-1"
                            aria-label="Neue Aufgabe"
                            placeholder="Was gibt es zu tun? Einfach schreiben …"
                            maxLength={500}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
                            Enter ↵
                        </kbd>
                        <Button type="submit" aria-label="Aufgabe hinzufügen">
                            Hinzufügen
                        </Button>
                    </form>
                    <div className="filter-bar flex min-w-0 flex-wrap items-center gap-3">
                        <Label className="relative min-w-0 basis-full sm:flex-1 sm:basis-64 [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:top-2.5 [&>svg]:left-3 [&>svg]:text-muted-foreground">
                            <Search size={17} />
                            <Input
                                aria-label="Alle Aufgaben durchsuchen"
                                className="pl-9"
                                placeholder="Suchen, auch in erledigten Aufgaben …"
                                value={query}
                                onChange={(e) => {
                                    if (!query && e.target.value)
                                        setArchive('all');
                                    setQuery(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </Label>
                        <NativeSelect
                            aria-label="Statusfilter"
                            className="max-w-[min(11rem,42vw)] truncate"
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(1);
                            }}
                        >
                            <NativeSelectOption value="all">
                                Alle Status
                            </NativeSelectOption>
                            <NativeSelectOption value="open">
                                Offen
                            </NativeSelectOption>
                            <NativeSelectOption value="done">
                                Erledigt
                            </NativeSelectOption>
                            <NativeSelectOption value="overdue">
                                Überfällig
                            </NativeSelectOption>
                        </NativeSelect>
                        <NativeSelect
                            aria-label="Projektfilter"
                            className="max-w-[min(11rem,42vw)] truncate"
                            value={project}
                            onChange={(e) => {
                                setProject(e.target.value);
                                setPage(1);
                            }}
                        >
                            <NativeSelectOption value="">
                                Alle Projekte
                            </NativeSelectOption>
                            {projects.map((p) => (
                                <NativeSelectOption value={p.id} key={p.id}>
                                    {p.name}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                        <NativeSelect
                            aria-label="Personenfilter"
                            className="max-w-[min(11rem,42vw)] truncate"
                            value={person}
                            onChange={(e) => {
                                setPerson(e.target.value);
                                setPage(1);
                            }}
                        >
                            <NativeSelectOption value="">
                                Alle Personen
                            </NativeSelectOption>
                            {members.map((p) => (
                                <NativeSelectOption key={p.id} value={p.id}>
                                    {p.name}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                        <NativeSelect
                            aria-label="Archivfilter"
                            className="max-w-[min(11rem,42vw)] truncate"
                            value={archive}
                            onChange={(e) => {
                                setArchive(e.target.value);
                                setPage(1);
                            }}
                        >
                            <NativeSelectOption value="current">
                                Aktueller Schreibtisch
                            </NativeSelectOption>
                            <NativeSelectOption value="all">
                                Alle inkl. Archiv
                            </NativeSelectOption>
                            <NativeSelectOption value="archived">
                                Archiv
                            </NativeSelectOption>
                        </NativeSelect>
                    </div>
                    {captureDate && (
                        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            Neue Aufgabe am {captureDate}{' '}
                            <Button
                                variant="outline"
                                onClick={() => setCaptureDate(null)}
                            >
                                Datum entfernen ×
                            </Button>
                        </p>
                    )}
                    {notice && (
                        <Alert variant="destructive">
                            <AlertDescription className="flex flex-wrap items-center gap-2">
                                {notice}{' '}
                                <Button
                                    variant="outline"
                                    onClick={() => void load()}
                                >
                                    Erneut laden
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {Object.entries(drafts)
                        .filter(([id]) => removedIds.current.has(id))
                        .map(([id, draft]) => (
                            <Alert
                                key={id}
                                variant="destructive"
                                aria-label="Lokaler Entwurf eines gelöschten Eintrags"
                            >
                                <AlertDescription className="space-y-3">
                                    <p>
                                        Diese Aufgabe wurde gelöscht. Ihr
                                        lokaler Entwurf wurde nicht gesendet.
                                        Sie können den Text hier kopieren oder
                                        den Entwurf verwerfen.
                                    </p>
                                    <Textarea
                                        aria-label="Erhaltener lokaler Entwurf"
                                        readOnly
                                        value={[
                                            draft.data.title ??
                                            draft.base?.title,
                                            draft.data.notes ??
                                            draft.base?.notes,
                                            ...Object.entries(draft.data)
                                                .filter(
                                                    ([key]) =>
                                                        ![
                                                            'title',
                                                            'notes',
                                                        ].includes(key),
                                                )
                                                .map(
                                                    ([key, value]) =>
                                                        `${({ due_on: 'Frist', project_id: 'Projekt', assigned_to: 'Zuständig', status: 'Status', snoozed_until: 'Zurückgestellt bis', archived: 'Archiviert' } as Record<string, string>)[key] ?? key}: ${value ?? 'Leer'}`,
                                                ),
                                        ]
                                            .filter(Boolean)
                                            .join('\n\n')}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const next = {
                                                ...draftRef.current,
                                            };
                                            delete next[id];
                                            updateDrafts(next);
                                        }}
                                    >
                                        Lokalen Entwurf verwerfen
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ))}
                    {view === 'Jahresplan' && <YearPlan revision={revision} />}
                    {view === 'Papierkorb' && (
                        <Trash
                            revision={revision}
                            people={people}
                            projects={projects}
                            refresh={refreshWorkspace}
                        />
                    )}
                    {query && view === 'Schreibtisch' && (
                        <section
                            className="flex flex-wrap gap-2"
                            aria-label="Gefundene Projekte"
                        >
                            {projects
                                .filter((p) =>
                                    `${p.name} ${p.description ?? ''}`
                                        .toLocaleLowerCase('de-DE')
                                        .includes(
                                            query.toLocaleLowerCase('de-DE'),
                                        ),
                                )
                                .map((p) => (
                                    <Button
                                        variant="outline"
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
                                    </Button>
                                ))}
                        </section>
                    )}
                    {view === 'Wochencheck' && summary && (
                        <p className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
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
                            deleted={async (id) => {
                                if (project === id) setProject('');
                                await refreshWorkspace();
                            }}
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
                        <Tabs
                            value={check}
                            onValueChange={(value) => {
                                setCheck(value);
                                setPage(1);
                            }}
                        >
                            <TabsList className="h-auto w-full flex-wrap justify-start">
                                {[
                                    ['overdue', 'Überfällig'],
                                    ['undated', 'Ohne Termin seit > 7 Tagen'],
                                    [
                                        'unassigned',
                                        'Ohne Projekt seit > 7 Tagen',
                                    ],
                                    ['recent', 'Diese Woche erledigt'],
                                ].map(([value, label]) => (
                                    <TabsTrigger
                                        className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground dark:data-[state=active]:bg-accent dark:data-[state=active]:text-accent-foreground"
                                        key={value}
                                        value={value}
                                    >
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
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
                                !query &&
                                status !== 'done' &&
                                check !== 'recent',
                            )}
                            <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground [&>span]:mr-auto">
                                <span>
                                    {pagination.total} Treffer · Seite {page} /{' '}
                                    {pagination.last_page} (Abschnittszahlen auf
                                    dieser Seite)
                                </span>
                                <Button
                                    variant="outline"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    Zurück
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={page >= pagination.last_page}
                                    onClick={() => setPage(page + 1)}
                                >
                                    Weiter
                                </Button>
                            </div>
                        </>
                    )}
                    {undo && (
                        <div
                            className="fixed right-4 bottom-4 z-50 flex flex-wrap items-center gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md"
                            role="status"
                        >
                            Status geändert.{' '}
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const current = tasksRef.current.find(
                                        (t) => t.id === undo.id,
                                    );
                                    if (current)
                                        mutate(current, {
                                            status: undo.status,
                                        });
                                    setUndo(null);
                                }}
                            >
                                Rückgängig
                            </Button>
                        </div>
                    )}
                </main>
            </SidebarInset>
            {task && (
                <Sheet
                    open={!!task}
                    modal={false}
                    onOpenChange={(open) => {
                        if (!open) setSelected(null);
                    }}
                >
                    <SheetContent
                        className="w-full overflow-y-auto p-0 sm:max-w-md"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                        <SheetHeader className="border-b p-6">
                            <SheetTitle>Aufgabendetails</SheetTitle>
                            <SheetDescription>
                                Titel, Zuordnung, Notizen und Verlauf.
                            </SheetDescription>
                        </SheetHeader>
                        <aside
                            className="detail-panel space-y-6 p-6"
                            aria-label="Aufgabendetails"
                        >
                            <RecordActions
                                type="task"
                                record={task}
                                disabled={!!drafts[task.id]}
                                refresh={() => afterTaskDelete(task.id)}
                            />
                            <Button
                                variant="outline"
                                className="close"
                                onClick={() => setSelected(null)}
                            >
                                Schließen ×
                            </Button>
                            <p className="text-xs font-medium text-muted-foreground">
                                AUFGABENDETAILS
                            </p>
                            <Label className="grid gap-2">
                                Frist
                                <Input
                                    type="date"
                                    value={task.due_on ?? ''}
                                    onChange={(e) =>
                                        mutate(task, {
                                            due_on: e.target.value || null,
                                        })
                                    }
                                />
                            </Label>
                            <DraftInput
                                value={task.title}
                                label="Titel im Detail"
                                onCommit={(title) => mutate(task, { title })}
                            />
                            <Label className="grid gap-2">
                                Projekt
                                <NativeSelect
                                    value={task.project_id ?? ''}
                                    onChange={(e) =>
                                        mutate(task, {
                                            project_id: e.target.value || null,
                                        })
                                    }
                                >
                                    <NativeSelectOption value="">
                                        Ohne Projekt
                                    </NativeSelectOption>
                                    {projects.map((p) => (
                                        <NativeSelectOption
                                            key={p.id}
                                            value={p.id}
                                        >
                                            {p.name}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </Label>
                            <Label className="grid gap-2">
                                Zurückstellen bis
                                <Input
                                    type="date"
                                    value={task.snoozed_until ?? ''}
                                    onChange={(e) =>
                                        mutate(task, {
                                            snoozed_until:
                                                e.target.value || null,
                                        })
                                    }
                                />
                            </Label>
                            <Label className="grid gap-2">
                                Notizen
                                <DraftInput
                                    multiline
                                    maxLength={50000}
                                    value={task.notes ?? ''}
                                    label="Notizen"
                                    onCommit={(notes) =>
                                        mutate(task, { notes })
                                    }
                                />
                            </Label>
                            <p>
                                Angelegt von{' '}
                                <strong>{name(task.created_by)}</strong>
                            </p>
                            <p>
                                Zugewiesen an{' '}
                                <strong>{name(task.assigned_to)}</strong>
                            </p>
                            <p>
                                Erledigt markiert von{' '}
                                <strong>{name(task.completed_by)}</strong>
                            </p>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    mutate(task, {
                                        archived: !task.archived_at,
                                    } as Partial<Task>)
                                }
                            >
                                <Archive size={16} />{' '}
                                {task.archived_at
                                    ? 'Wiederherstellen'
                                    : 'Archivieren'}
                            </Button>
                            <Separator />
                            <h2 className="text-base font-semibold">Verlauf</h2>
                            <p className="text-sm text-muted-foreground">
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
                            <Button
                                variant="outline"
                                disabled={historyPage <= 1}
                                onClick={() => setHistoryPage(historyPage - 1)}
                            >
                                Neuer
                            </Button>
                            <Button
                                variant="outline"
                                disabled={historyPage >= historyLast}
                                onClick={() => setHistoryPage(historyPage + 1)}
                            >
                                Älter
                            </Button>
                        </aside>
                    </SheetContent>
                </Sheet>
            )}
        </SidebarProvider>
    );
}
