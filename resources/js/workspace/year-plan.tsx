import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
import { useEffect, useState } from 'react';
import { api, todayBerlin } from './types';
import type { Project } from './types';

type Row = Project & { left: number; width: number };
type Report = {
    months: { name: string; width: number }[];
    scheduled: Row[];
    unscheduled: Project[];
};
export default function YearPlan({ revision }: { revision: number }) {
    const [year, setYear] = useState(Number(todayBerlin().slice(0, 4)));
    const [yearInput, setYearInput] = useState(String(year));
    const [status, setStatus] = useState('');
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        void api<Report>(`year/${year}?status=${status}`)
            .then((data) => {
                if (!cancelled) {
                    setReport(data);
                    setError('');
                }
            })
            .catch(() => setError('Jahresplan konnte nicht geladen werden.'));
        return () => {
            cancelled = true;
        };
    }, [year, status, revision]);
    return (
        <section className="year-view min-w-0 space-y-6">
            <div className="calendar-toolbar flex flex-wrap items-end gap-3">
                <Label className="grid gap-2">
                    Jahr{' '}
                    <Input
                        className="w-24"
                        aria-label="Jahr"
                        type="number"
                        min={1900}
                        max={2200}
                        value={yearInput}
                        onChange={(e) => {
                            setYearInput(e.target.value);
                            const n = Number(e.target.value);
                            if (n >= 1900 && n <= 2200) setYear(n);
                        }}
                        onBlur={() => setYearInput(String(year))}
                    />
                </Label>
                <NativeSelect
                    aria-label="Jahresplanstatus"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <NativeSelectOption value="">
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
                <Button variant="outline" asChild>
                    <a
                        target="_blank"
                        rel="noreferrer"
                        href={`/reports/year/${year}/print?status=${status}`}
                    >
                        Druckansicht / Als PDF speichern ↗
                    </a>
                </Button>
                <Button variant="outline" asChild>
                    <a href={`/reports/year/${year}.csv?status=${status}`}>
                        CSV für Excel
                    </a>
                </Button>
                <Button variant="outline" asChild>
                    <a href="/reports/activities.csv">Bedienhistorie CSV</a>
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                Geplante Zeiträume, keine Arbeitszeitnachweise. Die Balken
                bilden Start- und Endtage einschließlich taggenau ab.
            </p>
            {error && <p role="alert">{error}</p>}
            {report && (
                <>
                    <div className="year-table-wrap min-w-0 overflow-hidden rounded-lg border bg-card">
                        <Table className="year-table min-w-[650px] table-fixed [&_td]:break-words [&_td]:whitespace-normal [&_td:nth-child(2)]:p-0 [&_th:first-child]:w-[27%] [&_th:nth-child(2)]:w-[73%]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-normal">
                                        Projekt / geplanter Zeitraum
                                    </TableHead>
                                    <TableHead>
                                        <div className="year-months flex h-10 w-full text-center [&>span]:border-l [&>span]:leading-10">
                                            {report.months.map((m) => (
                                                <span
                                                    style={{
                                                        width: `${m.width}%`,
                                                    }}
                                                    key={m.name}
                                                >
                                                    {m.name}
                                                </span>
                                            ))}
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.scheduled.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <strong>{p.name}</strong>
                                            <small className="mt-1 block text-xs text-muted-foreground">
                                                {p.starts_on} – {p.ends_on} ·{' '}
                                                {p.status === 'active'
                                                    ? 'Aktiv'
                                                    : p.status === 'completed'
                                                      ? 'Abgeschlossen'
                                                      : 'Archiviert'}
                                            </small>
                                        </TableCell>
                                        <TableCell>
                                            <div className="year-track relative h-14 w-full">
                                                <div className="year-grid absolute inset-0 flex [&>span]:h-full [&>span]:border-l">
                                                    {report.months.map((m) => (
                                                        <span
                                                            style={{
                                                                width: `${m.width}%`,
                                                            }}
                                                            key={m.name}
                                                        />
                                                    ))}
                                                </div>
                                                <span
                                                    title={`${p.name}: ${p.starts_on} – ${p.ends_on}`}
                                                    className="year-bar absolute top-5 h-3.5 min-w-px rounded-sm"
                                                    style={{
                                                        left: `${p.left}%`,
                                                        width: `${p.width}%`,
                                                        background:
                                                            p.color ||
                                                            'var(--primary)',
                                                    }}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                        Noch nicht terminiert{' '}
                        <Badge variant="secondary">
                            {report.unscheduled.length}
                        </Badge>
                    </h2>
                    {report.unscheduled.map((p) => (
                        <Card
                            className="unscheduled py-4 shadow-none"
                            key={p.id}
                        >
                            <CardContent className="text-sm">
                                {p.name}
                                <small className="mt-1 block text-xs text-muted-foreground">
                                    Start {p.starts_on || 'offen'} · Ende{' '}
                                    {p.ends_on || 'offen'}
                                </small>
                            </CardContent>
                        </Card>
                    ))}
                </>
            )}
        </section>
    );
}
