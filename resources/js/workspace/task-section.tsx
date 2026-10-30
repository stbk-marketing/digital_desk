import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    CalendarDays,
    Check,
    ChevronRight,
    Clock3,
    Inbox,
    TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function TaskSection({
    label,
    count,
    collapsed,
    children,
}: {
    label: string;
    count: number;
    collapsed: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(!collapsed);
    const Icon =
        label === 'Heute'
            ? CalendarDays
            : label === 'Demnächst'
              ? Clock3
              : label === 'Erledigt'
                ? Check
                : label === 'Überfällig'
                  ? TriangleAlert
                  : Inbox;
    useEffect(() => setOpen(!collapsed), [collapsed]);
    return (
        <Card className="task-group gap-0 overflow-hidden py-0 shadow-sm">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className="task-group-heading h-auto w-full justify-start px-4 py-3 text-card-foreground"
                    >
                        <span className="section-icon">
                            <Icon className="size-5" />
                        </span>
                        <span className="font-semibold">{label}</span>
                        <Badge
                            variant="outline"
                            className="section-count text-xs text-foreground"
                        >
                            {count}
                        </Badge>
                        <ChevronRight
                            className={`ml-auto size-5 transition-transform ${open ? 'rotate-90' : ''}`}
                        />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="task-grid">
                    {children}
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
