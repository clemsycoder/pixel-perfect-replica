import { type ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  PieChart,
  Wallet,
  Eye,
  Receipt,
  Package,
  Settings,
  Sprout,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getWallet } from "@/lib/wallet.functions";
import { markNotificationsRead } from "@/lib/trading.functions";
import { notificationsQuery, profileQuery, walletQuery } from "@/lib/queries";
import { formatNaira, timeAgo } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: TrendingUp },
  { to: "/trade", label: "Trade", icon: ArrowLeftRight },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/physical-requests", label: "Physical Requests", icon: Package },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-accent"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 h-4.5 w-4.5 shrink-0" />
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
      <span className="gradient-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        <Sprout className="h-5 w-5 text-black" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">Lumora</span>
    </Link>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-4 py-5 lg:flex">
      <Brand />
      <div className="flex-1 overflow-y-auto">
        <NavLinks />
      </div>
      <div className="rounded-lg border bg-accent p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Prices are reference data.</span> Executions
        price at the latest stored observation.
      </div>
    </aside>
  );
}

function Topbar() {
  const navigate = useNavigate();
  const router = useRouterState();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document === "undefined" ? true : !document.documentElement.classList.contains("light"),
  );

  const wallet = useQuery({ ...walletQuery(), retry: 1 });
  const profile = useQuery({ ...profileQuery(), retry: 1 });
  const notifications = useQuery({ ...notificationsQuery(), retry: 1 });

  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("lumora-theme", next ? "dark" : "light");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const p = profile.data?.profile;
  const initials = (p?.fullName ?? "L U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const unread = notifications.data?.unread ?? 0;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-8">
      {/* Mobile nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-6">
            <Brand />
          </div>
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:hidden">
        <Brand compact />
      </div>

      {/* Wallet chip */}
      <Link
        to="/wallet"
        className="ml-auto flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-colors hover:border-primary/50 lg:ml-0"
      >
        <Wallet className="h-4 w-4 text-primary" />
        <span className="font-numeric font-semibold">
          {wallet.data ? formatNaira(wallet.data.balanceKobo) : "₦—"}
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4.5 w-4.5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {unread > 0 && (
                <button
                  className="text-xs font-normal text-primary hover:underline"
                  onClick={() => markRead.mutate()}
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.data?.items.length ? (
              <div className="max-h-80 overflow-y-auto">
                {notifications.data.items.slice(0, 10).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
                    <span className={`text-sm ${n.isRead ? "text-muted-foreground" : "font-medium"}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                    <span className="text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full outline-none ring-primary focus-visible:ring-2" aria-label="Account menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={p?.avatarUrl ?? undefined} alt={p?.fullName ?? "Account"} />
                <AvatarFallback className="gradient-primary text-xs font-bold text-black">
                  {initials || "LU"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{p?.fullName ?? "Lumora trader"}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{p?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.navigate({ to: "/settings" })}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
