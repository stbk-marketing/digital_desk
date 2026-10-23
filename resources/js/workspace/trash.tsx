import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { ActivityLog } from './activity-log';
import { RecoveryLinks, trashOperation } from './record-actions';
import type { RecordType } from './record-actions';
import { api } from './types';
import type { Activity, Failure, Page, Person, Project, Task } from './types';

export default function Trash({
    revision,
    refresh,
    people,
    projects,
}: {
    revision: number;
    refresh: () => Promise<void>;
    people: Person[];
    projects: Project[];
}) {
    const [data, setData] = useState<{
        tasks: Page<Task>;
        projects: Page<Project>;
    } | null>(null);
    const [tasksPage, setTasksPage] = useState(1);
    const [projectsPage, setProjectsPage] = useState(1);
    const [selection, setSelection] = useState<{
        type: RecordType;
        record: Task | Project;
        operation: 'restore' | 'purge';
    } | null>(null);
    const [links, setLinks] = useState(true);
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState<{
        id: string;
        page: Page<Activity>;
    } | null>(null);
    const load = useCallback(async () => {
        try {
            setData(
                await api(
                    `trash?tasks_page=${tasksPage}&projects_page=${projectsPage}`,
                ),
            );
        } catch (e) {
            toast.error((e as Failure).message);
        }
    }, [tasksPage, projectsPage]);
    useEffect(() => {
        void load();
    }, [load, revision]);
    const execute = async () => {
        if (!selection) return;
        setBusy(true);
        try {
            await trashOperation(
                selection.type,
                selection.record,
                selection.operation,
                async () => {
                    await Promise.all([load(), refresh()]);
                },
                links,
            );
            setSelection(null);
            setHistory(null);
        } catch (e) {
            toast.error((e as Failure).message);
            await load();
            setSelection(null);
        } finally {
            setBusy(false);
        }
    };
    const showHistory = async (id: string, page = 1) => {
        try {
            setHistory({
                id,
                page: await api(`activities?subject_id=${id}&page=${page}`),
            });
        } catch (e) {
            toast.error((e as Failure).message);
        }
    };
    return (
        <section className="space-y-6" aria-label="Papierkorbinhalt">
            <p className="text-sm text-muted-foreground">
                Gelöschte Einträge bleiben hier bis zur Wiederherstellung oder
                zum bestätigten endgültigen Löschen. Es gibt keine automatische
                Leerung.
            </p>
            {(['task', 'project'] as const).map((type) => {
                const page = type === 'task' ? data?.tasks : data?.projects;
                const setPage =
                    type === 'task' ? setTasksPage : setProjectsPage;
                return (
                    <Card key={type}>
                        <CardHeader>
                            <CardTitle>
                                {type === 'task'
                                    ? 'Gelöschte Aufgaben'
                                    : 'Gelöschte Projekte'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {page?.data.map((record) => (
                                <article
                                    key={record.id}
                                    className="trash-record space-y-3 rounded-md border p-4 break-words"
                                >
                                    <h3 className="font-medium">
                                        {'title' in record
                                            ? record.title
                                            : record.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Gelöscht am{' '}
                                        {new Date(
                                            record.deleted_at!,
                                        ).toLocaleString('de-DE', {
                                            timeZone: 'Europe/Berlin',
                                        })}{' '}
                                        von{' '}
                                        {people.find(
                                            (p) => p.id === record.deleted_by,
                                        )?.name ?? 'Ehemalige Person'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setLinks(true);
                                                setSelection({
                                                    type,
                                                    record,
                                                    operation: 'restore',
                                                });
                                            }}
                                        >
                                            <RotateCcw />
                                            Wiederherstellen
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() =>
                                                setSelection({
                                                    type,
                                                    record,
                                                    operation: 'purge',
                                                })
                                            }
                                        >
                                            <Trash2 />
                                            Endgültig löschen
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                void showHistory(record.id)
                                            }
                                        >
                                            Verlauf
                                        </Button>
                                        {type === 'project' && (
                                            <RecoveryLinks id={record.id} />
                                        )}
                                    </div>
                                </article>
                            ))}
                            {page?.total === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Keine gelöschten{' '}
                                    {type === 'task' ? 'Aufgaben' : 'Projekte'}.
                                </p>
                            )}
                            {page && page.last_page > 1 && (
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        disabled={page.current_page <= 1}
                                        onClick={() =>
                                            setPage(page.current_page - 1)
                                        }
                                    >
                                        Zurück
                                    </Button>
                                    <span className="text-sm">
                                        Seite {page.current_page} /{' '}
                                        {page.last_page}
                                    </span>
                                    <Button
                                        variant="outline"
                                        disabled={
                                            page.current_page >= page.last_page
                                        }
                                        onClick={() =>
                                            setPage(page.current_page + 1)
                                        }
                                    >
                                        Weiter
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
            <Dialog
                open={!!selection}
                onOpenChange={(open) => {
                    if (!open && !busy) setSelection(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selection?.operation === 'purge'
                                ? 'Endgültig löschen?'
                                : 'Eintrag wiederherstellen?'}
                        </DialogTitle>
                        <DialogDescription>
                            {selection?.operation === 'purge'
                                ? 'Dieser Vorgang kann nicht rückgängig gemacht werden. Der Eintrag und seine Inhaltsdaten in der aktiven Audit-Historie werden endgültig entfernt. Vorhandene Sicherungen unterliegen ihrer getrennten Aufbewahrung.'
                                : 'Der Eintrag wird mit seinem bisherigen Archivierungsstatus wiederhergestellt.'}
                        </DialogDescription>
                    </DialogHeader>
                    {selection?.operation === 'restore' &&
                        selection.type === 'project' && (
                            <Label className="flex items-start gap-3">
                                <Checkbox
                                    checked={links}
                                    onCheckedChange={(value) =>
                                        setLinks(value === true)
                                    }
                                />
                                Unveränderte, noch unzugeordnete Aufgaben wieder
                                verbinden. Zwischenzeitliche Änderungen werden
                                nicht überschrieben.
                            </Label>
                        )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setSelection(null)}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            variant={
                                selection?.operation === 'purge'
                                    ? 'destructive'
                                    : 'default'
                            }
                            disabled={busy}
                            onClick={() => void execute()}
                        >
                            {selection?.operation === 'purge'
                                ? 'Jetzt endgültig löschen'
                                : 'Jetzt wiederherstellen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!history}
                onOpenChange={(open) => {
                    if (!open) setHistory(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Verlauf im Papierkorb</DialogTitle>
                        <DialogDescription>
                            Lösch- und Wiederherstellungsvorgänge mit Person und
                            Zeitpunkt.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-80 space-y-4 overflow-y-auto">
                        {history?.page.data.map((activity) => (
                            <ActivityLog
                                key={activity.id}
                                activity={activity}
                                people={people}
                                projects={projects}
                            />
                        ))}
                    </div>
                    {history && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={history.page.current_page <= 1}
                                onClick={() =>
                                    void showHistory(
                                        history.id,
                                        history.page.current_page - 1,
                                    )
                                }
                            >
                                Neuer
                            </Button>
                            <Button
                                variant="outline"
                                disabled={
                                    history.page.current_page >=
                                    history.page.last_page
                                }
                                onClick={() =>
                                    void showHistory(
                                        history.id,
                                        history.page.current_page + 1,
                                    )
                                }
                            >
                                Älter
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
