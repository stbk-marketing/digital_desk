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
        <section className="year-view">
            <div className="calendar-toolbar">
                <label>
                    Jahr{' '}
                    <input
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
                </label>
                <select
                    aria-label="Jahresplanstatus"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="">Alle inkl. Archiv</option>
                    <option value="active">Aktiv</option>
                    <option value="completed">Abgeschlossen</option>
                    <option value="archived">Archiviert</option>
                </select>
                <a
                    target="_blank"
                    rel="noreferrer"
                    href={`/reports/year/${year}/print?status=${status}`}
                >
                    Druckansicht / Als PDF speichern ↗
                </a>
                <a href={`/reports/year/${year}.csv?status=${status}`}>
                    CSV für Excel
                </a>
                <a href="/reports/activities.csv">Bedienhistorie CSV</a>
            </div>
            <p className="muted">
                Geplante Zeiträume, keine Arbeitszeitnachweise. Die Balken
                bilden Start- und Endtage einschließlich taggenau ab.
            </p>
            {error && <p role="alert">{error}</p>}
            {report && (
                <>
                    <div className="year-table-wrap">
                        <table className="year-table">
                            <thead>
                                <tr>
                                    <th>Projekt / geplanter Zeitraum</th>
                                    <th>
                                        <div className="year-months">
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
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.scheduled.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <strong>{p.name}</strong>
                                            <small>
                                                {p.starts_on} – {p.ends_on} ·{' '}
                                                {p.status === 'active'
                                                    ? 'Aktiv'
                                                    : p.status === 'completed'
                                                      ? 'Abgeschlossen'
                                                      : 'Archiviert'}
                                            </small>
                                        </td>
                                        <td>
                                            <div className="year-track">
                                                <div className="year-grid">
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
                                                    className="year-bar"
                                                    style={{
                                                        left: `${p.left}%`,
                                                        width: `${p.width}%`,
                                                        background:
                                                            p.color ||
                                                            '#52764b',
                                                    }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <h2>
                        Noch nicht terminiert{' '}
                        <small>{report.unscheduled.length}</small>
                    </h2>
                    {report.unscheduled.map((p) => (
                        <p className="unscheduled" key={p.id}>
                            {p.name}
                            <small>
                                Start {p.starts_on || 'offen'} · Ende{' '}
                                {p.ends_on || 'offen'}
                            </small>
                        </p>
                    ))}
                </>
            )}
        </section>
    );
}
