import { useEffect, useRef, useState } from 'react';

export default function DraftInput({
    value,
    onCommit,
    label,
    multiline = false,
    maxLength = 500,
    disabled = false,
}: {
    value: string;
    onCommit: (value: string) => void;
    label: string;
    multiline?: boolean;
    maxLength?: number;
    disabled?: boolean;
}) {
    const [text, setText] = useState(value);
    const draft = useRef(value);
    const dirty = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const commit = useRef(onCommit);
    commit.current = onCommit;
    const editingCommit = useRef(onCommit);
    const flush = () => {
        if (timer.current) clearTimeout(timer.current);
        if (dirty.current) {
            dirty.current = false;
            editingCommit.current(draft.current);
        }
    };
    useEffect(() => {
        if (!dirty.current) {
            setText(value);
            draft.current = value;
        }
    }, [value]);
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
            if (dirty.current) editingCommit.current(draft.current);
        },
        [],
    );
    useEffect(() => {
        const leaving = (event: BeforeUnloadEvent) => {
            if (dirty.current) {
                event.preventDefault();
                if (timer.current) clearTimeout(timer.current);
                dirty.current = false;
                editingCommit.current(draft.current);
            }
        };
        window.addEventListener('beforeunload', leaving);
        return () => window.removeEventListener('beforeunload', leaving);
    }, []);
    const props = {
        value: text,
        'aria-label': label,
        maxLength,
        disabled,
        onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
            if (!dirty.current) editingCommit.current = commit.current;
            draft.current = event.target.value;
            dirty.current = true;
            setText(draft.current);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(flush, 500);
        },
        onBlur: flush,
    };
    return multiline ? (
        <textarea {...props} rows={5} />
    ) : (
        <input {...props} type="text" />
    );
}
