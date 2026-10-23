import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
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
    useEffect(() => setOpen(!collapsed), [collapsed]);
    return (
        <Card className="task-group gap-0 overflow-hidden py-0 shadow-none">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none p-4"
                    >
                        <ChevronDown
                            className={`size-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
                        />
                        <span>{label}</span>
                        <Badge variant="secondary" className="ml-auto">
                            {count}
                        </Badge>
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>{children}</CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
