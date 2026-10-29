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
        <Card className="task-group gap-0 overflow-hidden py-0 shadow-sm">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none bg-card px-4 py-3 text-card-foreground hover:bg-card/80"
                    >
                        <ChevronDown
                            className={`size-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
                        />
                        <span className="font-semibold">{label}</span>
                        <Badge
                            variant="outline"
                            className="ml-auto bg-background font-mono text-xs text-foreground"
                        >
                            {count}
                        </Badge>
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 border-t bg-background/60 p-2">
                    {children}
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
