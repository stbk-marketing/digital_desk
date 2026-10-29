import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
import { useEffect, useRef, useState } from 'react';
import DraftInput from './draft-input';
import { ActivityLog, ConflictSummary } from './activity-log';
import { api } from './types';
import type { Activity, Failure, Page, Person, Project } from './types';
import RecordActions, { RecoveryLinks } from './record-actions';

export default function Projects({
    projects,
    people,
    refresh,
    deleted,
    openTasks,
    projectId = '',
    query = '',
}: {
    projects: Project[];
    people: Person[];
    refresh: () => Promise<void>;
    deleted: (id: string) => Promise<void>;
    openTasks: (id: string) => void;
    projectId?: string;
    query?: string;
}) {
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
    const requestId = useRef(crypto.randomUUID());
    useEffect(() => {
        const leave = (event: BeforeUnloadEvent) => {
            if (
                Object.values(draftRef.current).some(
                    (d) => Object.keys(d).length,
                )
            )
                event.preventDefault();
        };
        window.addEventListener('beforeunload', leave);
        return () => window.removeEventListener('beforeunload', leave);
    }, []);
    const update = (p: Project, patch: Partial<Project>, expected?: number) => {
        if (!Object.keys(draftRef.current[p.id] ?? {}).length)
            versions.current[p.id] = p.version;
        draftRef.current = {
            ...draftRef.current,
            [p.id]: { ...draftRef.current[p.id], ...patch },
        };
        setDrafts(draftRef.current);
        chains.current[p.id] = (chains.current[p.id] ?? Promise.resolve()).then(
            async () => {
                const data = { ...draftRef.current[p.id] };
                if (!Object.keys(data).length) return;
                try {
                    const result = await api<Project>(
                        `projects/${p.id}`,
                        'PATCH',
                        {
                            ...data,
                            expected_version:
                                expected ?? versions.current[p.id] ?? p.version,
                        },
                    );
                    versions.current[p.id] = result.version;
                    const rest = { ...draftRef.current[p.id] };
                    for (const key of Object.keys(data) as (keyof Project)[])
                        if (rest[key] === data[key]) delete rest[key];
                    draftRef.current = { ...draftRef.current, [p.id]: rest };
                    setDrafts(draftRef.current);
                    setErrors((old) => {
                        const next = { ...old };
                        delete next[p.id];
                        return next;
                    });
                    await refresh();
                } catch (error) {
                    setErrors((old) => ({ ...old, [p.id]: error as Failure }));
                }
            },
        );
    };
    const create = async () => {
        if (!name.trim()) return;
        setCreating(true);
        try {
            const p = await api<Project>('projects', 'POST', {
                name: name.trim(),
                request_id: requestId.current,
            });
            requestId.current = crypto.randomUUID();
            setName('');
            setCreateError('');
            await refresh();
            setSelected(p.id);
        } catch (error) {
            setCreateError((error as Failure).message);
        } finally {
            setCreating(false);
        }
    };
    useEffect(() => {
        if (selected)
            void api<Page<Activity>>(
                `activities?subject_id=${selected}&page=${historyPage}`,
            ).then((result) => {
                setEvents(result.data);
                setLastPage(result.last_page);
            });
    }, [selected, projects, historyPage]);
    return (
        <section className="projects-view space-y-6">
            <form
                className="project-create flex flex-wrap gap-3 [&>input]:min-w-0 [&>input]:flex-1"
                onSubmit={(e) => {
                    e.preventDefault();
                    void create();
                }}
            >
                <Input
                    aria-label="Neues Projekt"
                    placeholder="Neues Projekt – nur ein Titel genügt"
                    maxLength={160}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Button disabled={creating} type="submit">
                    Projekt anlegen
                </Button>
            </form>
            {createError && (
                <p role="alert">
                    Nicht synchronisiert: {createError}. Titel bleibt erhalten;
                    erneut mit Enter versuchen.
                </p>
            )}
            {Object.entries(drafts)
                .filter(
                    ([id, draft]) =>
                        Object.keys(draft).length > 0 &&
                        !projects.some((project) => project.id === id),
                )
                .map(([id, draft]) => (
                    <Alert key={id} variant="destructive">
                        <AlertDescription className="space-y-3">
                            <p>
                                Dieses Projekt wurde gelöscht. Ihr lokaler
                                Entwurf wurde nicht gesendet. Sie können den
                                Text hier kopieren oder den Entwurf verwerfen.
                            </p>
                            <Textarea
                                aria-label="Erhaltener lokaler Projektentwurf"
                                readOnly
                                value={Object.entries(draft)
                                    .map(
                                        ([key, value]) =>
                                            `${({ name: 'Name', description: 'Beschreibung', starts_on: 'Start', ends_on: 'Ende', status: 'Status', color: 'Farbe' } as Record<string, string>)[key] ?? key}: ${value ?? 'Leer'}`,
                                    )
                                    .join('\n')}
                            />
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const next = { ...draftRef.current };
                                    delete next[id];
                                    draftRef.current = next;
                                    setDrafts(next);
                                }}
                            >
                                Lokalen Projektentwurf verwerfen
                            </Button>
                        </AlertDescription>
                    </Alert>
                ))}
            <Label className="project-status-filter flex flex-wrap items-center gap-3">
                Projektstatus{' '}
                <NativeSelect
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <NativeSelectOption value="all">
                        Alle inkl. Archiv
                    </NativeSelectOption>
                    <NativeSelectOption value="active">
                        Aktiv
                    </NativeSelectOption>
                    <NativeSelectOption value="completed">
                        Abgeschlossen
                    </NativeSelectOption>
                    <NativeSelectOption value="archived">
                        Archiviert
                    </NativeSelectOption>
                </NativeSelect>
            </Label>
            <div className="project-grid grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {projects
                    .filter(
                        (p) =>
                            (drafts[p.id] &&
                                Object.keys(drafts[p.id]).length > 0) ||
                            ((!projectId || p.id === projectId) &&
                                (filter === 'all' || p.status === filter) &&
                                `${p.name} ${p.description ?? ''}`
                                    .toLocaleLowerCase('de-DE')
                                    .includes(
                                        query.toLocaleLowerCase('de-DE'),
                                    )),
                    )
                    .map((server) => {
                        const p = { ...server, ...drafts[server.id] };
                        return (
                            <Card className="project-card min-w-0" key={p.id}>
                                <CardHeader>
                                    <div className="flex justify-end">
                                        <RecordActions
                                            type="project"
                                            record={server}
                                            disabled={
                                                Object.keys(drafts[p.id] ?? {})
                                                    .length > 0
                                            }
                                            refresh={() => deleted(p.id)}
                                        />
                                    </div>
                                    <DraftInput
                                        label="Projektname"
                                        maxLength={160}
                                        value={p.name}
                                        onCommit={(name) =>
                                            update(server, { name })
                                        }
                                    />
                                    <Badge
                                        variant="secondary"
                                        className="project-count w-fit"
                                    >
                                        {p.open_tasks ?? 0} offen ·{' '}
                                        {p.done_tasks ?? 0} erledigt
                                    </Badge>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="project-dates grid gap-4 sm:grid-cols-2">
                                        <Label className="grid min-w-0 gap-2">
                                            Geplanter Start
                                            <Input
                                                aria-label="Projektstart"
                                                type="date"
                                                value={p.starts_on ?? ''}
                                                onChange={(e) =>
                                                    update(server, {
                                                        starts_on:
                                                            e.target.value ||
                                                            null,
                                                    })
                                                }
                                            />
                                        </Label>
                                        <Label className="grid min-w-0 gap-2">
                                            Geplantes Ende
                                            <Input
                                                aria-label="Projektende"
                                                type="date"
                                                value={p.ends_on ?? ''}
                                                onChange={(e) =>
                                                    update(server, {
                                                        ends_on:
                                                            e.target.value ||
                                                            null,
                                                    })
                                                }
                                            />
                                        </Label>
                                    </div>
                                    <Label className="grid min-w-0 gap-2">
                                        Status
                                        <NativeSelect
                                            aria-label="Projektstatus"
                                            value={p.status}
                                            onChange={(e) =>
                                                update(server, {
                                                    status: e.target
                                                        .value as Project['status'],
                                                })
                                            }
                                        >
                                            <NativeSelectOption value="active">
                                                Aktiv
                                            </NativeSelectOption>
                                            <NativeSelectOption value="completed">
                                                Abgeschlossen
                                            </NativeSelectOption>
                                            <NativeSelectOption value="archived">
                                                Archiviert
                                            </NativeSelectOption>
                                        </NativeSelect>
                                    </Label>
                                    <Label className="grid min-w-0 gap-2">
                                        Farbe
                                        <Input
                                            aria-label="Projektfarbe"
                                            className="w-14 p-1"
                                            type="color"
                                            value={p.color || '#d33682'}
                                            onChange={(e) =>
                                                update(server, {
                                                    color: e.target.value,
                                                })
                                            }
                                        />
                                    </Label>
                                    <DraftInput
                                        multiline
                                        label="Projektbeschreibung"
                                        maxLength={50000}
                                        value={p.description ?? ''}
                                        onCommit={(description) =>
                                            update(server, { description })
                                        }
                                    />
                                </CardContent>
                                <CardFooter className="project-actions flex-wrap gap-2">
                                    <RecoveryLinks id={p.id} />
                                    <Button
                                        className="h-auto whitespace-normal"
                                        onClick={() => openTasks(p.id)}
                                    >
                                        Aufgaben öffnen / erfassen →
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelected(
                                                selected === p.id ? null : p.id,
                                            );
                                            setHistoryPage(1);
                                        }}
                                    >
                                        Chronik
                                    </Button>
                                </CardFooter>
                                {Object.keys(drafts[p.id] ?? {}).length > 0 && (
                                    <div
                                        className="sync-state mx-6 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                                        role="status"
                                    >
                                        {errors[p.id] ? (
                                            <>
                                                Nicht synchronisiert:{' '}
                                                {errors[p.id].message}{' '}
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        update(
                                                            server,
                                                            {},
                                                            errors[p.id].current
                                                                ?.version,
                                                        )
                                                    }
                                                >
                                                    Entwurf erneut senden
                                                    {errors[p.id].current
                                                        ? ' auf Basis der aktuellen Serverversion'
                                                        : ''}
                                                </Button>
                                                {errors[p.id].current && (
                                                    <ConflictSummary
                                                        record={
                                                            errors[p.id]
                                                                .current as Project
                                                        }
                                                        people={people}
                                                        projects={projects}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            'Wird gespeichert …'
                                        )}
                                    </div>
                                )}
                                {selected === p.id && (
                                    <div className="project-history mx-6 space-y-4 border-t pt-6">
                                        <p className="text-sm text-muted-foreground">
                                            Bedienaktionen, keine tatsächliche
                                            Arbeitsdauer.
                                        </p>
                                        {events.map((a) => (
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
                                            onClick={() =>
                                                setHistoryPage(historyPage - 1)
                                            }
                                        >
                                            Neuer
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={historyPage >= lastPage}
                                            onClick={() =>
                                                setHistoryPage(historyPage + 1)
                                            }
                                        >
                                            Älter
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
            </div>
            {!projects.length && (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Ein Projekt beginnt mit einer Idee. Lege oben das erste an.
                </p>
            )}
        </section>
    );
}
