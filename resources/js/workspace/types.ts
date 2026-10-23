export type Person = { id: number; name: string };
export type Task = {
    deleted_at?: string | null;
    deleted_by?: number | null;
    id: string;
    title: string;
    notes: string | null;
    status: 'open' | 'done';
    due_on: string | null;
    project_id: string | null;
    assigned_to: number | null;
    created_by: number;
    completed_by: number | null;
    completed_at: string | null;
    snoozed_until: string | null;
    archived_at: string | null;
    version: number;
    created_at: string;
};
export type Project = {
    deleted_at?: string | null;
    deleted_by?: number | null;
    id: string;
    name: string;
    description: string | null;
    starts_on: string | null;
    ends_on: string | null;
    color: string | null;
    status: 'active' | 'completed' | 'archived';
    version: number;
    open_tasks?: number;
    done_tasks?: number;
};
export type Activity = {
    id: string;
    actor_id: number;
    event: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    occurred_at: string;
};
export type Page<T> = {
    data: T[];
    total: number;
    current_page: number;
    last_page: number;
};
export type Failure = {
    message: string;
    current?: Task | Project;
    deleted?: boolean;
};

export async function api<T>(
    path: string,
    method = 'GET',
    body?: unknown,
): Promise<T> {
    const response = await fetch(
        path.startsWith('/') ? path : `/api/workspace/${path}`,
        {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(
                    document.cookie
                        .split('; ')
                        .find((c) => c.startsWith('XSRF-TOKEN='))
                        ?.slice('XSRF-TOKEN='.length) ?? '',
                ),
            },
            ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
        },
    );
    const data = (await response.json().catch(() => ({}))) as Failure & {
        errors?: Record<string, string[]>;
    };
    if (!response.ok)
        throw {
            ...data,
            message: data.errors
                ? Object.values(data.errors).flat().join(' ')
                : data.message ||
                  `Speichern fehlgeschlagen (${response.status}).`,
        } satisfies Failure;
    return data as T;
}

export const todayBerlin = () =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(
        new Date(),
    );
