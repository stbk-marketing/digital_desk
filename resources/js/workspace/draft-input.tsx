import { useEffect, useRef, useState } from 'react';

export default function DraftInput({ value, onCommit, label, multiline = false, maxLength = 500 }: { value: string; onCommit: (value: string) => void; label: string; multiline?: boolean; maxLength?: number }) {
    const [text, setText] = useState(value);
    const draft = useRef(value);
    const dirty = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const commit = useRef(onCommit);
    commit.current = onCommit;
    const flush = () => {
        if (timer.current) clearTimeout(timer.current);
        if (dirty.current) { dirty.current = false; commit.current(draft.current); }
    };
    useEffect(() => { if (!dirty.current) { setText(value); draft.current = value; } }, [value]);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (dirty.current) commit.current(draft.current); }, []);
    const props = {
        value: text, 'aria-label': label, maxLength,
        onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            draft.current = event.target.value; dirty.current = true; setText(draft.current);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(flush, 500);
        }, onBlur: flush,
    };
    return multiline ? <textarea {...props} rows={5} /> : <input {...props} type="text" />;
}
