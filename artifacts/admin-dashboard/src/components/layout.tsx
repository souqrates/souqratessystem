import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowRightLeft,
  Bot,
  Percent,
  ArrowUpFromLine,
  Settings,
} from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Users", href: "/users", icon: Users },
    { name: "Wallets", href: "/wallets", icon: Wallet },
    { name: "Transactions", href: "/transactions", icon: ArrowRightLeft },
    { name: "Bots", href: "/bots", icon: Bot },
    { name: "Commissions", href: "/commissions", icon: Percent },
    { name: "Withdrawals", href: "/withdrawals", icon: ArrowUpFromLine },
  ];

  const settingsNav = [
    { name: "الإعدادات", href: "/settings", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="h-16 flex items-center justify-center border-b border-border px-6">
            <h1 className="text-xl font-bold text-primary tracking-tight">Mother Bot</h1>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-muted-foreground">Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                          <Link href={item.href} className="flex items-center gap-3">
                            <item.icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-muted-foreground">إدارة</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsNav.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                          <Link href={item.href} className="flex items-center gap-3">
                            <item.icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-6 lg:p-8 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
