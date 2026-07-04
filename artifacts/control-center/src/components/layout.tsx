import React from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Activity, Box, Database, FileCode2, LayoutDashboard, Settings, TerminalSquare, Search as SearchIcon, ShieldAlert, LogOut, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "./auth-context";
import { useAuthLogout } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Commands", href: "/commands", icon: TerminalSquare },
  { name: "Embeds", href: "/embeds", icon: Box },
  { name: "Modules", href: "/modules", icon: Activity },
  { name: "Bot Control", href: "/bot-control", icon: Settings },
  { name: "Files", href: "/files", icon: FileCode2 },
  { name: "Database", href: "/database", icon: Database },
  { name: "Audit Logs", href: "/audit-logs", icon: ShieldAlert },
  { name: "Search", href: "/search", icon: SearchIcon },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const logout = useAuthLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/login";
      }
    });
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
          <SidebarHeader className="h-16 flex items-center px-6 border-b border-border/50">
            <div className="flex items-center gap-3 w-full">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight">LOWO CC</span>
                <span className="text-[10px] font-mono text-muted-foreground">v2.4.1_STABLE</span>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.href}
                        className="group relative transition-all duration-200 hover:bg-white/5 active:scale-95"
                      >
                        <Link href={item.href} className="flex items-center gap-3 w-full">
                          <item.icon className={`w-4 h-4 transition-colors ${location === item.href ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                          <span className={`text-sm font-medium ${location === item.href ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                            {item.name}
                          </span>
                          {location === item.href && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border/50 bg-sidebar/80 backdrop-blur-md">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 rounded-md border border-white/10 ring-1 ring-black/20">
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="rounded-md bg-white/5 text-xs font-mono">{user?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-foreground truncate">{user?.globalName || user?.username}</span>
                  <span className="text-[10px] font-mono text-primary truncate uppercase tracking-wider">{user?.accessLevel}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <header className="h-16 flex-none flex items-center justify-between px-6 border-b border-border/50 bg-background/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="h-4 w-[1px] bg-border" />
              <div className="flex items-center text-sm font-mono text-muted-foreground">
                <span className="text-primary mr-2">~/</span>
                {location === "/" ? "dashboard" : location.replace("/", "")}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="font-mono text-xs text-muted-foreground bg-black/20 border-white/5 h-8 px-3" asChild>
                <Link href="/search">
                  <SearchIcon className="w-3 h-3 mr-2" />
                  <span>Search</span>
                  <kbd className="ml-4 rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] font-sans">⌘K</kbd>
                </Link>
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-background/50">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
