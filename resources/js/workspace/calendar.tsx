import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
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
            className="calendar-task relative z-10 my-1 flex min-w-0 items-start rounded-md border bg-muted/50 text-xs"
            ref={setNodeRef}
            style={{
                transform: transform
                    ? `translate(${transform.x}px,${transform.y}px)`
                    : undefined,
            }}
        >
            <Button
                variant="outline"
                className="drag-handle h-8 w-6 shrink-0 touch-none border-0 bg-transparent p-1 shadow-none"
                aria-label={`Verschieben: ${task.title}`}
                {...attributes}
                {...listeners}
            >
                <GripVertical className="size-3.5" />
            </Button>
            <Button
                variant="ghost"
                className="h-auto min-h-8 min-w-0 flex-1 justify-start p-1.5 text-left text-xs leading-relaxed whitespace-normal"
                onClick={open}
            >
                {task.status === 'done' ? '✓ ' : '○ '}
                {task.title}
            </Button>
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
            className={`calendar-day min-h-20 min-w-0 p-2 md:min-h-28 ${isOver ? 'drop-over bg-accent ring-2 ring-primary ring-inset' : ''} ${!isSameMonth(date, month) ? 'other-month hidden bg-muted/30 text-muted-foreground md:block' : ''}`}
        >
            <Button
                variant="outline"
                className={
                    day === todayBerlin()
                        ? 'day-number current size-8 border-0 bg-primary p-0 text-primary-foreground hover:bg-primary/90'
                        : 'day-number size-8 border-0 bg-transparent p-0 shadow-none hover:bg-accent'
                }
                aria-label={`Aufgabe am ${format(date, 'dd.MM.yyyy')} erfassen`}
                onClick={() => create(day)}
            >
                <span className="mobile-weekday mr-1 md:hidden">
                    {format(date, 'EEE', { locale: de })}{' '}
                </span>
                {format(date, 'd')}
            </Button>
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
        <section className="calendar-view space-y-4">
            <div className="calendar-toolbar flex flex-wrap items-center gap-3">
                <Button
                    variant="outline"
                    aria-label="Vorheriger Zeitraum"
                    onClick={() =>
                        setDate(
                            mode === 'month'
                                ? addMonths(date, -1)
                                : addWeeks(date, -1),
                        )
                    }
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <h2 className="text-base font-semibold">
                    {format(
                        date,
                        mode === 'month' ? 'MMMM yyyy' : "'Woche' w · yyyy",
                        { locale: de },
                    )}
                </h2>
                <Button
                    variant="outline"
                    aria-label="Nächster Zeitraum"
                    onClick={() =>
                        setDate(
                            mode === 'month'
                                ? addMonths(date, 1)
                                : addWeeks(date, 1),
                        )
                    }
                >
                    <ChevronRight className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    onClick={() => setDate(parseISO(todayBerlin()))}
                >
                    Heute
                </Button>
                <NativeSelect
                    aria-label="Kalenderansicht"
                    value={mode}
                    onChange={(e) =>
                        setMode(e.target.value as 'month' | 'week')
                    }
                >
                    <NativeSelectOption value="month">Monat</NativeSelectOption>
                    <NativeSelectOption value="week">Woche</NativeSelectOption>
                </NativeSelect>
                <Label className="flex items-center gap-2">
                    <Checkbox
                        checked={showTasks}
                        onCheckedChange={(checked) =>
                            setShowTasks(checked === true)
                        }
                    />{' '}
                    Aufgaben
                </Label>
                <Label className="flex items-center gap-2">
                    <Checkbox
                        checked={showProjects}
                        onCheckedChange={(checked) =>
                            setShowProjects(checked === true)
                        }
                    />{' '}
                    Projekte
                </Label>
            </div>
            <p className="text-sm text-muted-foreground">
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
                <div className="weekday-grid hidden grid-cols-7 text-center text-xs font-medium text-muted-foreground md:grid [&>span]:p-3">
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
                        <div
                            className="calendar-week overflow-hidden border-x border-t bg-card last:rounded-b-lg last:border-b"
                            key={first}
                        >
                            <div className="calendar-bars grid grid-cols-7 gap-1 p-1">
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
                                        <Button
                                            variant="outline"
                                            className="h-7 min-w-0 justify-start truncate rounded-md border-0 px-2 text-xs text-primary-foreground"
                                            title={`${p.name}: ${p.starts_on} – ${p.ends_on}`}
                                            onClick={() => openProject(p.id)}
                                            key={p.id}
                                            style={{
                                                gridColumn: `${start + 1} / ${end + 2}`,
                                                background:
                                                    p.color || 'var(--primary)',
                                            }}
                                        >
                                            {p.name}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="calendar-grid grid grid-cols-1 divide-y md:grid-cols-7 md:divide-x md:divide-y-0">
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
