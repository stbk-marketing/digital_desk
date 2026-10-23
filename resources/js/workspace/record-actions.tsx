import { useState } from 'react';
import { MoreHorizontal, Trash2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { api } from './types';
import type { Failure, Page, Project, Task } from './types';

export type RecordType = 'task' | 'project';
export type TrashResult = {
    record: Task | Project | null;
    restored_links: number;
    skipped_links: number;
};

export async function trashOperation(
    type: RecordType,
    record: Task | Project,
    operation: 'delete' | 'restore' | 'purge',
    refresh: () => Promise<void>,
    restoreLinks = true,
) {
    const result = await api<TrashResult>(
        `trash/${type}/${record.id}/${operation}`,
        'POST',
        {
            expected_version: record.version,
            ...(operation === 'purge' ? { confirmed: true } : {}),
            restore_links: restoreLinks,
        },
    );
    await refresh();
    if (operation === 'delete' && result.record) {
        const deleted = result.record;
        toast(
            type === 'task'
                ? 'Aufgabe im Papierkorb.'
                : 'Projekt im Papierkorb. Aufgaben bleiben erhalten.',
            {
                duration: 10000,
                action: {
                    label: 'Rückgängig',
                    onClick: () => {
                        void trashOperation(
                            type,
                            deleted,
                            'restore',
                            refresh,
                        ).catch((e: Failure) => toast.error(e.message));
                    },
                },
            },
        );
    } else if (operation === 'restore') {
        toast.success(
            `Wiederhergestellt.${type === 'project' ? ` ${result.restored_links} Zuordnungen wiederhergestellt, ${result.skipped_links} wegen zwischenzeitlicher Änderungen übersprungen.` : ''}`,
        );
    } else if (operation === 'purge') toast.success('Endgültig gelöscht.');
    return result;
}

export function RecoveryLinks({ id }: { id: string }) {
    const [result, setResult] = useState<Page<{
        id: string;
        title: string;
        recoverable: number;
        deleted_at: string | null;
        detached_at: string;
    }> | null>(null);
    const [open, setOpen] = useState(false);
    const load = async (page = 1) => {
        try {
            setResult(await api(`trash/links/${id}?page=${page}`));
        } catch (e) {
            toast.error((e as Failure).message);
        }
    };
    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    setOpen(true);
                    void load();
                }}
            >
                <Link2 />
                Frühere Zuordnungen
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Frühere Aufgabenzuordnungen</DialogTitle>
                        <DialogDescription>
                            Unveränderte, unzugeordnete Aufgaben können bei der
                            Projektwiederherstellung verbunden werden.
                            Zwischenzeitlich geänderte Aufgaben bleiben
                            unverändert; ordnen Sie diese bei Bedarf über die
                            Aufgabenverwaltung zu.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
                        {result?.data.map((link) => (
                            <div
                                key={link.id}
                                className="rounded-md border p-3 break-words"
                            >
                                <p>{link.title}</p>
                                <p className="text-muted-foreground">
                                    {link.deleted_at
                                        ? 'Aufgabe im Papierkorb'
                                        : link.recoverable
                                          ? 'Seit dem Lösen unverändert'
                                          : 'Zwischenzeitlich geändert – keine automatische Zuordnung'}
                                </p>
                            </div>
                        ))}
                        {result?.total === 0 && (
                            <p>Keine ausstehenden früheren Zuordnungen.</p>
                        )}
                    </div>
                    {result && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={result.current_page <= 1}
                                onClick={() =>
                                    void load(result.current_page - 1)
                                }
                            >
                                Zurück
                            </Button>
                            <Button
                                variant="outline"
                                disabled={
                                    result.current_page >= result.last_page
                                }
                                onClick={() =>
                                    void load(result.current_page + 1)
                                }
                            >
                                Weiter
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function RecordActions({
    type,
    record,
    disabled,
    refresh,
}: {
    type: RecordType;
    record: Task | Project;
    disabled?: boolean;
    refresh: () => Promise<void>;
}) {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const remove = async () => {
        setBusy(true);
        try {
            await trashOperation(type, record, 'delete', refresh);
            setConfirm(false);
        } catch (e) {
            toast.error((e as Failure).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled || busy}
                        aria-label={`Aktionen: ${'title' in record ? record.title : record.name}`}
                    >
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                            if (type === 'project') setConfirm(true);
                            else void remove();
                        }}
                    >
                        <Trash2 />
                        Löschen
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {type === 'project' && (
                <Dialog open={confirm} onOpenChange={setConfirm}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Projekt in den Papierkorb verschieben?
                            </DialogTitle>
                            <DialogDescription>
                                Zugehörige Aufgaben werden nicht gelöscht. Sie
                                werden aus dem Projekt gelöst und bleiben auf
                                dem Schreibtisch verfügbar. Frühere Zuordnungen
                                werden für eine sichere Wiederherstellung
                                vorgemerkt.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => setConfirm(false)}
                            >
                                Abbrechen
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={busy}
                                onClick={() => void remove()}
                            >
                                Projekt löschen
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
