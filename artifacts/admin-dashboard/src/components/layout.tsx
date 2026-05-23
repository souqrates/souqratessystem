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
  SidebarFooter,
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
  Zap,
  Activity,
} from "lucide-react";
import { useGetStatsOverview } from "@workspace/api-client-react";

const navigation = [
  { name: "Dashboard", nameAr: "الرئيسية", href: "/", icon: LayoutDashboard, color: "text-indigo-400" },
  { name: "Users", nameAr: "المستخدمون", href: "/users", icon: Users, color: "text-sky-400" },
  { name: "Wallets", nameAr: "المحافظ", href: "/wallets", icon: Wallet, color: "text-emerald-400" },
  { name: "Transactions", nameAr: "المعاملات", href: "/transactions", icon: ArrowRightLeft, color: "text-violet-400" },
  { name: "Bots", nameAr: "البوتات", href: "/bots", icon: Bot, color: "text-blue-400" },
  { name: "Commissions", nameAr: "العمولات", href: "/commissions", icon: Percent, color: "text-amber-400" },
  { name: "Withdrawals", nameAr: "السحوبات", href: "/withdrawals", icon: ArrowUpFromLine, color: "text-rose-400" },
];

const adminNav = [
  { name: "Settings", nameAr: "الإعدادات", href: "/settings", icon: Settings, color: "text-slate-400" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: stats } = useGetStatsOverview();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          {/* Logo */}
          <SidebarHeader className="h-16 flex items-center px-5 border-b border-sidebar-border/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Zap size={15} className="text-white fill-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight gradient-text-violet">Mother Bot</h1>
                <p className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">Admin Console</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="py-3">
            {/* Platform nav */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase px-4 mb-1">
                المنصة
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5 px-2">
                  {navigation.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.name}
                          className={`h-9 rounded-lg text-sm transition-all duration-150 ${
                            isActive
                              ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/[0.04]"
                          }`}
                        >
                          <Link href={item.href} className="flex items-center gap-3 px-3">
                            <item.icon
                              className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-violet-400" : item.color}`}
                            />
                            <span className="font-medium">{item.nameAr}</span>
                            {isActive && (
                              <div className="ml-auto w-1 h-1 rounded-full bg-violet-400" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin nav */}
            <SidebarGroup className="mt-2">
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase px-4 mb-1">
                الإدارة
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5 px-2">
                  {adminNav.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.name}
                          className={`h-9 rounded-lg text-sm transition-all duration-150 ${
                            isActive
                              ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/[0.04]"
                          }`}
                        >
                          <Link href={item.href} className="flex items-center gap-3 px-3">
                            <item.icon
                              className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-violet-400" : item.color}`}
                            />
                            <span className="font-medium">{item.nameAr}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer with platform health */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/60">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-soft" />
                  <span className="text-[11px] text-muted-foreground/70 font-medium">النظام يعمل</span>
                </div>
                <Activity size={12} className="text-muted-foreground/40" />
              </div>
              {stats && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground/50">{stats.totalUsers} مستخدم</span>
                  <span className="text-violet-400/70 font-mono">{stats.activeBots} بوت نشط</span>
                </div>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 p-6 lg:p-8 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
