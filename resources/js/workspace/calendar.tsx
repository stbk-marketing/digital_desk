import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    addMonths,
    addWeeks,
    differenceInCalendarDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    parseISO,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { api, todayBerlin } from './types';
import type { Page, Project, Task } from './types';

function CalendarTask({ task, open }: { task: Task; open: () => void }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: task.id,
    });
    return (
        <div
            className="calendar-task"
            ref={setNodeRef}
            style={{
                transform: transform
                    ? `translate(${transform.x}px,${transform.y}px)`
                    : undefined,
            }}
        >
            <button
                className="drag-handle"
                aria-label={`Verschieben: ${task.title}`}
                {...attributes}
                {...listeners}
            >
                ⠿
            </button>
            <button onClick={open}>
                {task.status === 'done' ? '✓ ' : '○ '}
                {task.title}
            </button>
        </div>
    );
}
function Day({
    date,
    tasks,
    create,
    open,
    month,
}: {
    date: Date;
    tasks: Task[];
    create: (date: string) => void;
    open: (task: Task) => void;
    month: Date;
}) {
    const day = format(date, 'yyyy-MM-dd');
    const { isOver, setNodeRef } = useDroppable({ id: day });
    return (
        <div
            ref={setNodeRef}
            className={`calendar-day ${isOver ? 'drop-over' : ''} ${!isSameMonth(date, month) ? 'other-month' : ''}`}
        >
            <button
                className={
                    day === todayBerlin() ? 'day-number current' : 'day-number'
                }
                aria-label={`Aufgabe am ${format(date, 'dd.MM.yyyy')} erfassen`}
                onClick={() => create(day)}
            >
                <span className="mobile-weekday">
                    {format(date, 'EEE', { locale: de })}{' '}
                </span>
                {format(date, 'd')}
            </button>
            {tasks.map((t) => (
                <CalendarTask key={t.id} task={t} open={() => open(t)} />
            ))}
        </div>
    );
}

export default function Calendar({
    projects,
    person,
    project,
    revision,
    create,
    openTask,
    openProject,
    mutate,
}: {
    projects: Project[];
    person: string;
    project: string;
    revision: number;
    create: (date: string) => void;
    openTask: (task: Task) => void;
    openProject: (id: string) => void;
    mutate: (task: Task, data: Partial<Task>) => void;
}) {
    const [date, setDate] = useState(parseISO(todayBerlin()));
    const [mode, setMode] = useState<'month' | 'week'>('month');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [showTasks, setShowTasks] = useState(true);
    const [showProjects, setShowProjects] = useState(true);
    const [error, setError] = useState('');
    const from = format(
        startOfWeek(mode === 'month' ? startOfMonth(date) : date, {
            weekStartsOn: 1,
        }),
        'yyyy-MM-dd',
    );
    const to = format(
        endOfWeek(mode === 'month' ? endOfMonth(date) : date, {
            weekStartsOn: 1,
        }),
        'yyyy-MM-dd',
    );
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor),
    );
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                let page = 1;
                let last = 1;
                const all: Task[] = [];
                do {
                    const params = new URLSearchParams({
                        from,
                        to,
                        assigned_to: person,
                        project_id: project,
                        archive: 'current',
                        page: String(page),
                    });
                    const result = await api<{ tasks: Page<Task> }>(
                        `tasks?${params}`,
                    );
                    all.push(...result.tasks.data);
                    last = result.tasks.last_page;
                    page++;
                } while (page <= last);
                if (!cancelled) {
                    setTasks(all);
                    setError('');
                }
            } catch {
                if (!cancelled)
                    setError('Kalender konnte nicht aktualisiert werden.');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [from, to, person, project, revision]);
    const days = eachDayOfInterval({
        start: parseISO(from),
        end: parseISO(to),
    });
    const weeks = Array.from({ length: days.length / 7 }, (_, i) =>
        days.slice(i * 7, i * 7 + 7),
    );
    return (
        <section className="calendar-view">
            <div className="calendar-toolbar">
                <button
                    aria-label="Vorheriger Zeitraum"
                    onClick={() =>
                        setDate(
                            mode === 'month'
                                ? addMonths(date, -1)
                                : addWeeks(date, -1),
                        )
                    }
                >
                    ←
                </button>
                <h2>
                    {format(
                        date,
                        mode === 'month' ? 'MMMM yyyy' : "'Woche' w · yyyy",
                        { locale: de },
                    )}
                </h2>
                <button
                    aria-label="Nächster Zeitraum"
                    onClick={() =>
                        setDate(
                            mode === 'month'
                                ? addMonths(date, 1)
                                : addWeeks(date, 1),
                        )
                    }
                >
                    →
                </button>
                <button onClick={() => setDate(parseISO(todayBerlin()))}>
                    Heute
                </button>
                <select
                    aria-label="Kalenderansicht"
                    value={mode}
                    onChange={(e) =>
                        setMode(e.target.value as 'month' | 'week')
                    }
                >
                    <option value="month">Monat</option>
                    <option value="week">Woche</option>
                </select>
                <label>
                    <input
                        type="checkbox"
                        checked={showTasks}
                        onChange={(e) => setShowTasks(e.target.checked)}
                    />{' '}
                    Aufgaben
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showProjects}
                        onChange={(e) => setShowProjects(e.target.checked)}
                    />{' '}
                    Projekte
                </label>
            </div>
            <p className="muted">
                Aufgaben am Griff verschieben oder im Detail über das
                Datumsfeld. Ein Tag öffnet die Schnellerfassung für dieses
                Datum.
            </p>
            {error && <p role="alert">{error}</p>}
            <DndContext
                sensors={sensors}
                onDragEnd={(event) => {
                    const task = tasks.find((t) => t.id === event.active.id);
                    const day = event.over?.id as string | undefined;
                    if (task && day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
                        setTasks((old) =>
                            old.map((t) =>
                                t.id === task.id ? { ...t, due_on: day } : t,
                            ),
                        );
                        mutate(task, { due_on: day });
                    }
                }}
            >
                <div className="weekday-grid">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                        <span key={d}>{d}</span>
                    ))}
                </div>
                {weeks.map((week) => {
                    const first = format(week[0], 'yyyy-MM-dd');
                    const last = format(week[6], 'yyyy-MM-dd');
                    const bars = showProjects
                        ? projects.filter(
                              (p) =>
                                  p.starts_on &&
                                  p.ends_on &&
                                  p.starts_on <= last &&
                                  p.ends_on >= first &&
                                  p.status !== 'archived' &&
                                  (!project || p.id === project) &&
                                  (!person ||
                                      tasks.some(
                                          (t) =>
                                              t.project_id === p.id &&
                                              String(t.assigned_to) === person,
                                      )),
                          )
                        : [];
                    return (
                        <div className="calendar-week" key={first}>
                            <div className="calendar-bars">
                                {bars.map((p) => {
                                    const start =
                                        p.starts_on! < first
                                            ? 0
                                            : differenceInCalendarDays(
                                                  parseISO(p.starts_on!),
                                                  week[0],
                                              );
                                    const end =
                                        p.ends_on! > last
                                            ? 6
                                            : differenceInCalendarDays(
                                                  parseISO(p.ends_on!),
                                                  week[0],
                                              );
                                    return (
                                        <button
                                            title={`${p.name}: ${p.starts_on} – ${p.ends_on}`}
                                            onClick={() => openProject(p.id)}
                                            key={p.id}
                                            style={{
                                                gridColumn: `${start + 1} / ${end + 2}`,
                                                background:
                                                    p.color || '#52764b',
                                            }}
                                        >
                                            {p.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="calendar-grid">
                                {week.map((day) => (
                                    <Day
                                        key={format(day, 'yyyy-MM-dd')}
                                        date={day}
                                        month={date}
                                        tasks={
                                            showTasks
                                                ? tasks.filter(
                                                      (t) =>
                                                          t.due_on ===
                                                          format(
                                                              day,
                                                              'yyyy-MM-dd',
                                                          ),
                                                  )
                                                : []
                                        }
                                        create={create}
                                        open={openTask}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </DndContext>
        </section>
    );
}
