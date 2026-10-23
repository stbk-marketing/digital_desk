import type { Activity, Person, Project, Task } from './types';

export function ConflictSummary({
    record,
    people,
    projects,
}: {
    record: Task | Project;
    people: Person[];
    projects: Project[];
}) {
    return (
        <div className="conflict-summary">
            <strong>Aktueller Serverstand</strong>
            {Object.entries(record)
                .filter(([key]) => key in labels)
                .map(([key, value]) => (
                    <p key={key}>
                        {labels[key]}:{' '}
                        <Value
                            field={key}
                            value={value}
                            people={people}
                            projects={projects}
                        />
                    </p>
                ))}
        </div>
    );
}

const labels: Record<string, string> = {
    title: 'Titel',
    notes: 'Notizen',
    status: 'Status',
    due_on: 'Frist',
    project_id: 'Projekt',
    assigned_to: 'Zugewiesen an',
    snoozed_until: 'Zurückgestellt bis',
    archived_at: 'Archiviert am',
    name: 'Projektname',
    description: 'Beschreibung',
    starts_on: 'Geplanter Start',
    ends_on: 'Geplantes Ende',
    color: 'Farbe',
};
const status: Record<string, string> = {
    open: 'Offen',
    done: 'Erledigt',
    active: 'Aktiv',
    completed: 'Abgeschlossen',
    archived: 'Archiviert',
};

export function Value({
    field,
    value,
    people,
    projects,
}: {
    field: string;
    value: unknown;
    people: Person[];
    projects: Project[];
}) {
    if (value === null || value === undefined || value === '') return <>—</>;
    if (field === 'assigned_to')
        return (
            <>
                {people.find((p) => p.id === Number(value))?.name ??
                    'Ehemalige Person'}
            </>
        );
    if (field === 'project_id')
        return <>{projects.find((p) => p.id === value)?.name ?? 'Projekt'}</>;
    if (typeof value !== 'string' && typeof value !== 'number')
        return <>{JSON.stringify(value)}</>;
    return <>{field === 'status' ? (status[String(value)] ?? value) : value}</>;
}
export function ActivityLog({
    activity: a,
    people,
    projects,
}: {
    activity: Activity;
    people: Person[];
    projects: Project[];
}) {
    const event =
        a.event === 'created'
            ? 'Angelegt'
            : a.event === 'done'
              ? 'Als erledigt markiert'
              : a.event === 'open'
                ? 'Wieder geöffnet'
                : a.event === 'completed'
                  ? 'Projekt abgeschlossen'
                  : a.event === 'archived'
                    ? 'Projekt archiviert'
                    : Object.hasOwn(a.after, 'archived_at')
                      ? a.after.archived_at
                          ? 'Archiviert'
                          : 'Wiederhergestellt'
                      : 'Geändert';
    return (
        <article className="activity">
            <strong>
                {people.find((p) => p.id === a.actor_id)?.name ??
                    'Ehemalige Person'}
            </strong>{' '}
            ·{' '}
            {new Intl.DateTimeFormat('de-DE', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'Europe/Berlin',
            }).format(
                new Date(
                    a.occurred_at.replace(' ', 'T') +
                        (/[Z+]\d*:?\d*$/.test(a.occurred_at) ? '' : 'Z'),
                ),
            )}
            <p>{event}</p>
            {Object.entries(a.after)
                .filter(([key]) => key in labels)
                .map(([key, value]) => (
                    <small key={key}>
                        {labels[key]}:{' '}
                        <Value
                            field={key}
                            value={a.before?.[key]}
                            people={people}
                            projects={projects}
                        />{' '}
                        →{' '}
                        <Value
                            field={key}
                            value={value}
                            people={people}
                            projects={projects}
                        />
                        <br />
                    </small>
                ))}
        </article>
    );
}
