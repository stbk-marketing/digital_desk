import {
    ClipboardList,
    CalendarDays,
    Folder,
    ArrowDownToLine,
    CheckCheck,
    LogOut,
    Settings,
    Trash2,
    BookHeart,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import type { Person } from './types';

const items = [
    { name: 'Schreibtisch', icon: ClipboardList },
    { name: 'Kalender', icon: CalendarDays },
    { name: 'Projekte', icon: Folder },
    { name: 'Jahresplan', icon: ArrowDownToLine },
    { name: 'Wochencheck', icon: CheckCheck },
    { name: 'Papierkorb', icon: Trash2 },
] as const;

export default function WorkspaceNavigation({
    view,
    onView,
    user,
    logout,
}: {
    view: string;
    onView: (view: (typeof items)[number]['name']) => void;
    user: Person;
    logout: () => void;
}) {
    const { setOpenMobile } = useSidebar();
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <a href="/workspace">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                                    <BookHeart className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        Workspace
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Stadtbäckerei Kühl
                                    </span>
                                </div>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                    <SidebarMenu>
                        {items.map((item) => (
                            <SidebarMenuItem key={item.name}>
                                <SidebarMenuButton
                                    tooltip={item.name}
                                    isActive={view === item.name}
                                    onClick={() => {
                                        onView(item.name);
                                        setOpenMobile(false);
                                    }}
                                >
                                    <item.icon />
                                    <span>{item.name}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            tooltip="Profil und Passwort"
                        >
                            <a
                                href="/settings/profile"
                                aria-label="Profil und Passwort"
                            >
                                <Settings />
                                <span>Profil und Passwort</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Abmelden"
                            aria-label="Abmelden"
                            onClick={logout}
                        >
                            <LogOut />
                            <span>Abmelden</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <div>
                                <Avatar className="size-8 rounded-lg">
                                    <AvatarFallback className="rounded-lg">
                                        {user.name.slice(0, 1)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">
                                        {user.name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Gemeinsamer Workspace
                                    </span>
                                </div>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
