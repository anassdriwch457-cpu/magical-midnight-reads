import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { setUserBan } from "@/server/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Plus, Pencil, Trash2, Upload, ArrowLeft, BookOpen, Image as ImageIcon,
  BarChart3, Library, Users as UsersIcon, Coins, TrendingUp, Crown, Ban, CheckCircle2,
  Receipt, ArrowDownRight, ArrowUpRight, Settings as SettingsIcon, LayoutGrid, Rows3,
  Sparkles, Flame, Save,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import JSZip from "jszip";

type Series = Tables<"series">;
type Chapter = Tables<"chapters">;

const ALL_GENRES = ["Action","Adventure","Comedy","Drama","Fantasy","Josei","Magic","Mystery","Romance","School Life","Shoujo","Shounen Ai","Supernatural","Yaoi","Yuri"];

type Tab = "analytics" | "content" | "users" | "finance" | "settings";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Nuvia Toon" }] }),
});

function AdminPage() {
  const auth = useAuth();
  const { user, loading, isSuperAdmin, isManager, isUploader, canManageContent, canManageUsers, canViewAnalytics } = auth;
  const navigate = useNavigate();

  const allowedTabs: Tab[] = useMemo(() => {
    const t: Tab[] = [];
    if (canViewAnalytics) t.push("analytics");
    if (canManageContent) t.push("content");
    if (canManageUsers) t.push("users");
    if (canViewAnalytics) t.push("finance");
    if (isSuperAdmin || isManager) t.push("settings");
    return t;
  }, [canViewAnalytics, canManageContent, canManageUsers, isSuperAdmin, isManager]);

  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user && allowedTabs.length === 0) {
      toast.error("Admin access required");
      navigate({ to: "/" });
    } else if (allowedTabs.length > 0 && (tab === null || !allowedTabs.includes(tab))) {
      setTab(allowedTabs[0]);
    }
  }, [user, loading, allowedTabs, tab, navigate]);

  if (loading) return <div className="pt-24 text-center text-muted-foreground">Loading…</div>;

  if (!user) return (
    <div className="container mx-auto px-4 pt-24 pb-20 text-center">
      <p>Please <Link to="/auth" className="text-primary underline">sign in</Link> first.</p>
    </div>
  );

  if (allowedTabs.length === 0) return (
    <div className="container mx-auto px-4 pt-24 pb-20 max-w-xl text-center">
      <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <h1 className="text-2xl font-bold mb-2">Admin access required</h1>
      <p className="text-muted-foreground mb-6">Your account has no staff role yet.</p>
      <div className="rounded-md border border-border bg-card p-5 text-left text-sm space-y-2">
        <p className="font-semibold">To bootstrap the first super-admin, run this SQL once:</p>
        <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto"><code>{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user.id}', 'super_admin')
ON CONFLICT DO NOTHING;`}</code></pre>
        <p className="text-muted-foreground">Then refresh this page.</p>
      </div>
    </div>
  );

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex">
        <AdminSidebar
          tab={tab}
          setTab={setTab}
          allowedTabs={allowedTabs}
          roleLabel={isSuperAdmin ? "Super-Admin" : isManager ? "Manager" : isUploader ? "Uploader" : "Staff"}
        />
        <div className="flex-1 min-w-0 p-6 md:p-10">
          <MobileTabs tab={tab} setTab={setTab} allowedTabs={allowedTabs} />
          {tab === "analytics" && <AnalyticsView />}
          {tab === "content" && <ContentView />}
          {tab === "users" && <UsersView canEditRoles={isSuperAdmin} />}
          {tab === "finance" && <FinanceView />}
          {tab === "settings" && <SettingsView />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- SIDEBAR ---------------------- */
function AdminSidebar({ tab, setTab, allowedTabs, roleLabel }: {
  tab: Tab | null;
  setTab: (t: Tab) => void;
  allowedTabs: Tab[];
  roleLabel: string;
}) {
  const items: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: "analytics", label: "Dashboard", icon: BarChart3 },
    { key: "content", label: "Library", icon: Library },
    { key: "users", label: "Users", icon: UsersIcon },
    { key: "finance", label: "Finance", icon: Receipt },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl min-h-[calc(100vh-5rem)] p-4 gap-1 supports-[backdrop-filter]:bg-card/20">
      <div className="px-3 py-4 mb-2 border-b border-border/40">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Crown className="h-3.5 w-3.5 text-primary" /> {roleLabel}
        </div>
        <div className="mt-1 text-lg font-extrabold tracking-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Control Center</div>
      </div>
      {items.filter(i => allowedTabs.includes(i.key)).map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all text-left ${
              active
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </aside>
  );
}

/* Mobile tab row */
function MobileTabs({ tab, setTab, allowedTabs }: { tab: Tab | null; setTab: (t: Tab) => void; allowedTabs: Tab[] }) {
  return (
    <div className="md:hidden flex gap-2 mb-6 overflow-x-auto">
      {allowedTabs.map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase ${tab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
        >{t}</button>
      ))}
    </div>
  );
}

/* ---------------------- ANALYTICS / DASHBOARD ---------------------- */
type RevenueDay = { day: string; revenue: number; unlocks: number };
type GrowthDay = { day: string; signups: number };

function AnalyticsView() {
  const [totalSales, setTotalSales] = useState<number | null>(null);
  const [topSeries, setTopSeries] = useState<{ series_id: string; title: string; cover_url: string | null; unlocks: number; revenue: number }[]>([]);
  const [growth7, setGrowth7] = useState(0);
  const [growth30, setGrowth30] = useState(0);
  const [growthSeries, setGrowthSeries] = useState<GrowthDay[]>([]);
  const [revenueSeries, setRevenueSeries] = useState<RevenueDay[]>([]);
  const [revenue7, setRevenue7] = useState(0);
  const [unlocks7, setUnlocks7] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sales, top, growth, revenue] = await Promise.all([
        supabase.rpc("admin_total_sales"),
        supabase.rpc("admin_top_series", { _limit: 10 }),
        supabase.rpc("admin_user_growth", { _days: 30 }),
        supabase.rpc("admin_revenue_daily", { _days: 30 }),
      ]);
      if (sales.error) toast.error(sales.error.message); else setTotalSales(Number(sales.data ?? 0));
      if (top.error) toast.error(top.error.message); else setTopSeries((top.data ?? []) as never);
      if (growth.error) toast.error(growth.error.message);
      else {
        const days = ((growth.data ?? []) as GrowthDay[]).map(d => ({ ...d, signups: Number(d.signups) }));
        setGrowthSeries(days);
        setGrowth30(days.reduce((a, d) => a + d.signups, 0));
        setGrowth7(days.slice(-7).reduce((a, d) => a + d.signups, 0));
      }
      if (revenue.error) toast.error(revenue.error.message);
      else {
        const days = ((revenue.data ?? []) as RevenueDay[]).map(d => ({
          ...d,
          revenue: Number(d.revenue),
          unlocks: Number(d.unlocks),
        }));
        setRevenueSeries(days);
        const last7 = days.slice(-7);
        setRevenue7(last7.reduce((a, d) => a + d.revenue, 0));
        setUnlocks7(last7.reduce((a, d) => a + d.unlocks, 0));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading dashboard…</p>;

  // merge growth & revenue by day for combined chart
  const combined = revenueSeries.map((r) => {
    const g = growthSeries.find((s) => s.day === r.day);
    return {
      day: r.day.slice(5), // MM-DD
      revenue: r.revenue,
      unlocks: r.unlocks,
      signups: g ? g.signups : 0,
    };
  });

  return (
    <div>
      <SectionHeader icon={BarChart3} title="Dashboard" subtitle="Real-time revenue, growth, and engagement" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Coins} label="Revenue (7d)" value={`${revenue7.toLocaleString()} ¢`} accent />
        <StatCard icon={BookOpen} label="Unlocks (7d)" value={unlocks7.toLocaleString()} />
        <StatCard icon={UsersIcon} label="New Users (7d)" value={growth7.toLocaleString()} />
        <StatCard icon={TrendingUp} label="All-time Coins" value={totalSales?.toLocaleString() ?? "0"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <GlassCard title="Revenue (last 30 days)" subtitle={`${revenue30Total(revenueSeries).toLocaleString()} coins total`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={combined} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={chartTooltip} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard title="Growth & Unlocks (30d)" subtitle="Signups vs chapter unlocks">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={combined} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={chartTooltip} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="unlocks" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary inline-block" /> Signups</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground inline-block" /> Unlocks</span>
          </div>
        </GlassCard>
      </div>

      <GlassCard title="Top Series by Unlocks">
        {topSeries.length === 0 ? <p className="text-sm text-muted-foreground">No unlocks yet.</p> :
          <ol className="space-y-3">
            {topSeries.map((s, i) => (
              <li key={s.series_id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                {s.cover_url
                  ? <img src={s.cover_url} alt="" className="h-10 w-7 object-cover rounded-sm" />
                  : <div className="h-10 w-7 rounded-sm bg-muted" />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{Number(s.unlocks)} unlocks · {Number(s.revenue).toLocaleString()} coins</div>
                </div>
              </li>
            ))}
          </ol>
        }
      </GlassCard>
    </div>
  );
}

const chartTooltip = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
};

function revenue30Total(days: RevenueDay[]) {
  return days.reduce((a, d) => a + Number(d.revenue), 0);
}

function GlassCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-xl p-5 shadow-xl shadow-black/5">
      <div className="mb-4">
        <h3 className="font-bold uppercase tracking-wider text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Coins; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border backdrop-blur-xl p-5 shadow-lg transition-all hover:scale-[1.02] ${accent ? "border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 shadow-primary/10" : "border-border/50 bg-card/40 shadow-black/5"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 text-2xl font-extrabold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof BarChart3; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Icon className="h-6 w-6 text-primary" />
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold uppercase tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ---------------------- CONTENT ---------------------- */
function ContentView() {
  const [view, setView] = useState<{ kind: "list" } | { kind: "edit"; id: string | null } | { kind: "chapters"; id: string }>({ kind: "list" });
  return (
    <div>
      {view.kind === "list" && <SeriesList onEdit={(id) => setView({ kind: "edit", id })} onChapters={(id) => setView({ kind: "chapters", id })} onNew={() => setView({ kind: "edit", id: null })} />}
      {view.kind === "edit" && <SeriesForm id={view.id} onBack={() => setView({ kind: "list" })} />}
      {view.kind === "chapters" && <ChapterManager seriesId={view.id} onBack={() => setView({ kind: "list" })} />}
    </div>
  );
}

/* SERIES LIST */
function SeriesList({ onEdit, onChapters, onNew }: { onEdit: (id: string) => void; onChapters: (id: string) => void; onNew: () => void }) {
  const [items, setItems] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("series").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and all its chapters? This cannot be undone.`)) return;
    const { error } = await supabase.from("series").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = items.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id));
  const toggleAllVisible = () => {
    setSelected(s => {
      const next = new Set(s);
      if (allVisibleSelected) filtered.forEach(f => next.delete(f.id));
      else filtered.forEach(f => next.add(f.id));
      return next;
    });
  };

  const bulkFlag = async (field: "is_trending" | "is_popular", value: boolean) => {
    if (selected.size === 0) return toast.error("Nothing selected");
    setBulkBusy(true);
    const ids = Array.from(selected);
    const { data, error } = await supabase.rpc("admin_bulk_update_series_flags", {
      _ids: ids,
      _is_trending: field === "is_trending" ? value : undefined,
      _is_popular: field === "is_popular" ? value : undefined,
    });
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { success: boolean; updated?: number; error?: string };
    if (!res.success) return toast.error(res.error ?? "Failed");
    toast.success(`Updated ${res.updated} series`);
    load();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return toast.error("Nothing selected");
    if (!confirm(`Delete ${selected.size} series and all their chapters? This cannot be undone.`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("series").delete().in("id", Array.from(selected));
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${selected.size}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <SectionHeader icon={Library} title="Series Library" subtitle={`${items.length} title${items.length === 1 ? "" : "s"}`} />
        <Button onClick={onNew} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          <Plus className="h-4 w-4" /> New Series
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input placeholder="Search title or slug…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1 rounded-md border border-border/50 bg-card/40 backdrop-blur-xl p-1 ml-auto">
          <button onClick={() => setView("grid")} className={`p-1.5 rounded ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} title="Grid view"><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`p-1.5 rounded ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} title="List view"><Rows3 className="h-4 w-4" /></button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 to-primary/5 backdrop-blur-xl p-3 mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold mr-2">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkFlag("is_trending", true)}><Flame className="h-3.5 w-3.5" /> Mark Trending</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkFlag("is_trending", false)}>Untrending</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkFlag("is_popular", true)}><Sparkles className="h-3.5 w-3.5" /> Mark Popular</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkFlag("is_popular", false)}>Unpopular</Button>
          <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={bulkDelete} className="ml-auto"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {loading ? <p className="text-muted-foreground py-8 text-center">Loading…</p> :
        filtered.length === 0 ? <p className="text-muted-foreground py-8 text-center">{search ? "No matches." : "No series yet. Create your first one."}</p> :
        view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(s => {
              const sel = selected.has(s.id);
              return (
                <div key={s.id} className={`group relative rounded-xl overflow-hidden border backdrop-blur-xl transition-all ${sel ? "border-primary ring-2 ring-primary/40" : "border-border/50 bg-card/40 hover:border-primary/40"}`}>
                  <button onClick={() => toggleSelect(s.id)} className="absolute top-2 left-2 z-10 h-6 w-6 rounded-md bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center" aria-label="Select">
                    <div className={`h-3.5 w-3.5 rounded-sm ${sel ? "bg-primary" : "bg-transparent border border-border"}`} />
                  </button>
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                    {s.is_trending && <span title="Trending" className="h-6 w-6 rounded-md bg-orange-500/90 text-white flex items-center justify-center"><Flame className="h-3.5 w-3.5" /></span>}
                    {s.is_popular && <span title="Popular" className="h-6 w-6 rounded-md bg-primary/90 text-primary-foreground flex items-center justify-center"><Sparkles className="h-3.5 w-3.5" /></span>}
                  </div>
                  <div className="aspect-[2/3] bg-muted overflow-hidden">
                    {s.cover_url ? <img src={s.cover_url} alt={s.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" /> :
                      <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>}
                  </div>
                  <div className="p-2.5">
                    <div className="font-bold text-sm truncate">{s.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.type} · {s.status}</div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => onChapters(s.id)} title="Chapters"><BookOpen className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => onEdit(s.id)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-1.5 ml-auto text-destructive hover:text-destructive" onClick={() => remove(s.id, s.title)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 w-8"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-card/60">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.cover_url && <img src={s.cover_url} alt="" className="h-12 w-9 object-cover rounded-sm" />}
                      <div>
                        <div className="font-bold flex items-center gap-1.5">{s.title}
                          {s.is_trending && <Flame className="h-3 w-3 text-orange-500" />}
                          {s.is_popular && <Sparkles className="h-3 w-3 text-primary" />}
                        </div>
                        <div className="text-xs text-muted-foreground">/{s.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell capitalize">{s.type}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><Badge variant="outline" className="capitalize">{s.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onChapters(s.id)} title="Chapters"><BookOpen className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => onEdit(s.id)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s.id, s.title)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )
      }
    </div>
  );
}

/* SERIES FORM */
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function SeriesForm({ id, onBack }: { id: string | null; onBack: () => void }) {
  const [form, setForm] = useState({
    title: "", slug: "", description: "", author: "",
    type: "manga" as "manga" | "novel",
    status: "ongoing" as "ongoing" | "completed" | "hiatus",
    genres: [] as string[],
    cover_url: "" as string | null,
    is_trending: false, is_popular: false,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("series").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("Failed to load"); return; }
      setForm({
        title: data.title, slug: data.slug, description: data.description ?? "", author: data.author ?? "",
        type: data.type, status: data.status, genres: data.genres ?? [],
        cover_url: data.cover_url, is_trending: data.is_trending, is_popular: data.is_popular,
      });
      setLoading(false);
    })();
  }, [id]);

  const toggleGenre = (g: string) => setForm(f => ({ ...f, genres: f.genres.includes(g) ? f.genres.filter(x => x !== g) : [...f.genres, g] }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    let coverUrl = form.cover_url;
    try {
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const path = `covers/${slugify(form.title)}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chapter-images").upload(path, coverFile, { upsert: true, contentType: coverFile.type });
        if (upErr) throw upErr;
        coverUrl = supabase.storage.from("chapter-images").getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        description: form.description.trim() || null,
        author: form.author.trim() || null,
        type: form.type, status: form.status,
        genres: form.genres,
        cover_url: coverUrl,
        is_trending: form.is_trending, is_popular: form.is_popular,
      };
      if (id) {
        const { error } = await supabase.from("series").update(payload).eq("id", id);
        if (error) throw error;
        toast.success("Series updated");
      } else {
        const { error } = await supabase.from("series").insert(payload);
        if (error) throw error;
        toast.success("Series created");
      }
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Back</Button>
      <h2 className="text-lg font-bold uppercase tracking-wider mb-5">{id ? "Edit Series" : "New Series"}</h2>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value, slug: f.slug || slugify(e.target.value) }))} />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="auto-generated" />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={5} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={form.author} onChange={(e) => setForm(f => ({ ...f, author: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as "manga" | "novel" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manga">Manga / Manhwa</SelectItem>
                  <SelectItem value="novel">Novel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as "ongoing" | "completed" | "hiatus" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="hiatus">Hiatus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Genres</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ALL_GENRES.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md border transition-colors ${
                    form.genres.includes(g) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_trending} onChange={(e) => setForm(f => ({ ...f, is_trending: e.target.checked }))} />
              Trending (Hero)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_popular} onChange={(e) => setForm(f => ({ ...f, is_popular: e.target.checked }))} />
              Popular
            </label>
          </div>
        </div>

        <div>
          <Label>Cover Image</Label>
          <div className="rounded-md border border-border bg-card aspect-[2/3] mt-2 flex items-center justify-center overflow-hidden">
            {coverFile ? (
              <img src={URL.createObjectURL(coverFile)} alt="" className="h-full w-full object-cover" />
            ) : form.cover_url ? (
              <img src={form.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="mt-3" />
          <p className="text-xs text-muted-foreground mt-1">Recommended: 600×900 (2:3)</p>
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          {saving ? "Saving…" : id ? "Save Changes" : "Create Series"}
        </Button>
        <Button variant="outline" onClick={onBack}>Cancel</Button>
      </div>
    </div>
  );
}

/* CHAPTER MANAGER */
function ChapterManager({ seriesId, onBack }: { seriesId: string; onBack: () => void }) {
  const [series, setSeries] = useState<Series | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [content, setContent] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("series").select("*").eq("id", seriesId).maybeSingle();
    setSeries(s ?? null);
    const { data: c } = await supabase.from("chapters").select("*").eq("series_id", seriesId).order("number", { ascending: false });
    setChapters(c ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [seriesId]);

  const updatePrice = async (id: string, newPrice: number) => {
    const { error } = await supabase.from("chapters").update({ price: newPrice }).eq("id", id);
    if (error) return toast.error(error.message);
    setChapters(cs => cs.map(c => c.id === id ? { ...c, price: newPrice } : c));
    toast.success("Price updated");
  };

  const removeChapter = async (id: string, n: number) => {
    if (!confirm(`Delete chapter ${n}?`)) return;
    await supabase.from("chapter_pages").delete().eq("chapter_id", id);
    const { error } = await supabase.from("chapters").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const createChapter = async () => {
    if (!num.trim()) return toast.error("Chapter number is required");
    const n = Number(num);
    if (Number.isNaN(n)) return toast.error("Number must be numeric");
    const p = Math.max(0, parseInt(price) || 0);

    if (series?.type === "manga" && !zipFile) return toast.error("Please select a ZIP file with chapter images");
    if (series?.type === "novel" && !content.trim()) return toast.error("Please add the chapter text");

    setCreating(true);
    try {
      const { data: ch, error: chErr } = await supabase.from("chapters").insert({
        series_id: seriesId, number: n, title: title.trim() || null, price: p,
        content: series?.type === "novel" ? content.trim() : null,
      }).select().single();
      if (chErr) throw chErr;

      if (series?.type === "manga" && zipFile) {
        const zip = await JSZip.loadAsync(zipFile);
        const imageEntries = Object.values(zip.files)
          .filter(f => !f.dir && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

        if (imageEntries.length === 0) throw new Error("No images found in ZIP");

        setProgress({ current: 0, total: imageEntries.length, label: "Extracting…" });
        const pageRows: { chapter_id: string; page_number: number; image_url: string }[] = [];

        for (let i = 0; i < imageEntries.length; i++) {
          const entry = imageEntries[i];
          setProgress({ current: i, total: imageEntries.length, label: `Uploading ${entry.name}…` });
          const blob = await entry.async("blob");
          const ext = entry.name.split(".").pop()?.toLowerCase() || "jpg";
          const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "avif" ? "image/avif" : "image/jpeg";
          const path = `series/${seriesId}/ch-${n}/${String(i + 1).padStart(3, "0")}.${ext}`;
          const { error: upErr } = await supabase.storage.from("chapter-images").upload(path, blob, { upsert: true, contentType });
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from("chapter-images").getPublicUrl(path);
          pageRows.push({ chapter_id: ch.id, page_number: i + 1, image_url: publicUrl });
        }

        setProgress({ current: imageEntries.length, total: imageEntries.length, label: "Saving pages…" });
        const BATCH = 50;
        for (let i = 0; i < pageRows.length; i += BATCH) {
          const { error: pErr } = await supabase.from("chapter_pages").insert(pageRows.slice(i, i + BATCH));
          if (pErr) throw pErr;
        }
      }

      await supabase.from("series").update({ updated_at: new Date().toISOString() }).eq("id", seriesId);

      toast.success(`Chapter ${n} created`);
      setNum(""); setTitle(""); setPrice("0"); setContent(""); setZipFile(null);
      setProgress(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create chapter");
      setProgress(null);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading…</p>;
  if (!series) return <p className="text-muted-foreground py-8 text-center">Series not found.</p>;

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Back</Button>
      <div className="flex items-center gap-3 mb-6">
        {series.cover_url && <img src={series.cover_url} alt="" className="h-14 w-10 object-cover rounded-sm" />}
        <div>
          <h2 className="text-lg font-bold">{series.title}</h2>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{series.type} · {chapters.length} chapter{chapters.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5 mb-8">
        <h3 className="font-bold uppercase tracking-wider text-sm mb-4">Add Chapter</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="num">Chapter Number *</Label>
            <Input id="num" type="number" step="0.1" value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ctitle">Title (optional)</Label>
            <Input id="ctitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Beginning" />
          </div>
          <div>
            <Label htmlFor="price">Coin Price (0 = free)</Label>
            <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {series.type === "manga" ? (
            <div className="md:col-span-2">
              <Label htmlFor="zip">Chapter ZIP (images)</Label>
              <Input id="zip" type="file" accept=".zip,application/zip" onChange={(e) => setZipFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground mt-1">Images sorted naturally. JPG, PNG, WEBP, GIF, AVIF supported.</p>
            </div>
          ) : (
            <div className="md:col-span-3">
              <Label htmlFor="content">Chapter Text</Label>
              <Textarea id="content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          )}
        </div>

        {progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="truncate pr-2">{progress.label}</span>
              <span className="tabular-nums shrink-0">{progress.current} / {progress.total}</span>
            </div>
            <Progress value={(progress.current / Math.max(1, progress.total)) * 100} />
          </div>
        )}

        <div className="mt-5">
          <Button onClick={createChapter} disabled={creating} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            <Upload className="h-4 w-4" /> {creating ? "Uploading…" : "Create Chapter"}
          </Button>
        </div>
      </div>

      <MassPriceTool seriesId={seriesId} chapterCount={chapters.length} onDone={load} />

      <h3 className="font-bold uppercase tracking-wider text-sm mb-3">Chapters</h3>
      {chapters.length === 0 ? <p className="text-muted-foreground text-sm py-6 text-center">No chapters yet.</p> :
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 w-20">#</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 w-40">Price (coins)</th>
                <th className="text-right px-4 py-3 w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map(c => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-bold tabular-nums">{Number(c.number)}</td>
                  <td className="px-4 py-3">{c.title || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <Input
                      type="number" min={0}
                      defaultValue={c.price}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        if (v !== c.price) updatePrice(c.id, v);
                      }}
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeChapter(c.id, Number(c.number))} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}

/* ---------------------- USERS ---------------------- */
type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  coins: number;
  created_at: string;
  roles: string[];
  banned_until: string | null;
};

const ROLES_EDITABLE: { key: "admin" | "manager" | "super_admin"; label: string }[] = [
  { key: "admin", label: "Uploader" },
  { key: "manager", label: "Manager" },
  { key: "super_admin", label: "Super-Admin" },
];

function isBanned(u: { banned_until: string | null }): boolean {
  if (!u.banned_until) return false;
  return new Date(u.banned_until).getTime() > Date.now();
}

function UsersView({ canEditRoles }: { canEditRoles: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "staff" | "banned">("all");
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error(error.message);
    setUsers((data ?? []) as AdminUser[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (q && !u.email.toLowerCase().includes(q) && !(u.display_name ?? "").toLowerCase().includes(q)) return false;
    if (filterRole === "staff" && u.roles.length === 0) return false;
    if (filterRole === "banned" && !isBanned(u)) return false;
    return true;
  });

  const stats = useMemo(() => ({
    total: users.length,
    staff: users.filter(u => u.roles.length > 0).length,
    banned: users.filter(isBanned).length,
  }), [users]);

  return (
    <div>
      <SectionHeader icon={UsersIcon} title="Users" subtitle={`${stats.total} total · ${stats.staff} staff · ${stats.banned} banned`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Input
          placeholder="Search by email or display name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as typeof filterRole)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="staff">Staff only</SelectItem>
            <SelectItem value="banned">Banned only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-muted-foreground py-8 text-center">Loading…</p> :
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Roles</th>
                  <th className="text-left px-4 py-3 w-28">Coins</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell w-32">Joined</th>
                  <th className="text-right px-4 py-3 w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const banned = isBanned(u);
                  return (
                    <tr key={u.id} className={`border-t border-border/40 hover:bg-card/60 transition-colors ${banned ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              {u.display_name || u.email.split("@")[0]}
                              {banned && <Badge variant="destructive" className="text-[9px] uppercase">Banned</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">user</span> :
                            u.roles.map(r => <Badge key={r} variant="outline" className="text-[10px] border-primary/40 text-primary">{r}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums">
                        <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-primary" /> {u.coins}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(u)}>Manage</Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      }

      {selected && (
        <UserModal
          user={selected}
          canEditRoles={canEditRoles}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function UserModal({ user, canEditRoles, onClose, onChanged }: {
  user: AdminUser;
  canEditRoles: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [coins, setCoins] = useState(user.coins);
  const [banned, setBanned] = useState(isBanned(user));
  const banFn = useServerFn(setUserBan);

  const adjust = async () => {
    const d = parseInt(delta);
    if (Number.isNaN(d) || d === 0) return toast.error("Enter a non-zero amount");
    setBusy(true);
    const { data, error } = await supabase.rpc("adjust_user_coins", {
      _target: user.id, _delta: d, _reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { success: boolean; balance?: number; error?: string };
    if (!res.success) return toast.error(res.error ?? "Failed");
    toast.success(`Balance: ${res.balance}`);
    setCoins(res.balance ?? coins);
    setDelta("0"); setReason("");
    onChanged();
  };

  const toggleRole = async (role: "admin" | "manager" | "super_admin", grant: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_set_user_role", { _target: user.id, _role: role, _grant: grant });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { success: boolean; error?: string };
    if (!res.success) return toast.error(res.error ?? "Failed");
    setRoles(rs => grant ? Array.from(new Set([...rs, role])) : rs.filter(r => r !== role));
    toast.success(grant ? `Granted ${role}` : `Revoked ${role}`);
    onChanged();
  };

  const toggleBan = async () => {
    const next = !banned;
    if (next && !confirm(`Ban ${user.email}? They will be signed out and unable to log back in.`)) return;
    setBusy(true);
    try {
      await banFn({ data: { targetUserId: user.id, ban: next } });
      setBanned(next);
      toast.success(next ? "User banned" : "User unbanned");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              {user.display_name || user.email.split("@")[0]}
              {banned && <Badge variant="destructive" className="text-[10px]">Banned</Badge>}
            </h3>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="rounded-md bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 p-4 mb-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Current balance</div>
          <div className="text-2xl font-extrabold text-primary tabular-nums">{coins.toLocaleString()} coins</div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Adjust coins (positive = add, negative = remove)</Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. compensation, reward" />
          </div>
          <Button onClick={adjust} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full">
            <Coins className="h-4 w-4" /> Apply Adjustment
          </Button>
        </div>

        {canEditRoles && (
          <div className="mt-6 border-t border-border/40 pt-5">
            <Label className="mb-2 block">Roles</Label>
            <div className="space-y-2">
              {ROLES_EDITABLE.map(r => {
                const on = roles.includes(r.key);
                return (
                  <div key={r.key} className="flex items-center justify-between rounded-md border border-border/50 bg-background/60 px-3 py-2">
                    <div>
                      <div className="text-sm font-bold">{r.label}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.key}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={on ? "destructive" : "outline"}
                      disabled={busy}
                      onClick={() => toggleRole(r.key, !on)}
                    >
                      {on ? "Revoke" : "Grant"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-border/40 pt-5">
          <Label className="mb-2 block">Account access</Label>
          <Button
            onClick={toggleBan}
            disabled={busy}
            variant={banned ? "outline" : "destructive"}
            className="w-full font-bold"
          >
            {banned ? <><CheckCircle2 className="h-4 w-4" /> Unban User</> : <><Ban className="h-4 w-4" /> Ban User</>}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2">
            {banned
              ? "Banned users cannot sign in or use existing sessions. Unban to restore access."
              : "Banning prevents sign-in and invalidates all existing sessions immediately."}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- FINANCE LOG ---------------------- */
type FinanceRow = {
  occurred_at: string;
  kind: "unlock" | "adjustment";
  user_id: string;
  user_email: string | null;
  amount: number;
  note: string;
};

function FinanceView() {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlock" | "adjustment">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("admin_finance_log", { _limit: 200 });
      if (error) toast.error(error.message);
      setRows((data ?? []) as FinanceRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    if (filter !== "all" && r.kind !== filter) return false;
    const q = search.trim().toLowerCase();
    if (q && !(r.user_email ?? "").toLowerCase().includes(q) && !r.note.toLowerCase().includes(q)) return false;
    return true;
  });

  const totals = useMemo(() => {
    const spent = rows.filter(r => r.kind === "unlock").reduce((a, r) => a + Math.abs(r.amount), 0);
    const granted = rows.filter(r => r.kind === "adjustment" && r.amount > 0).reduce((a, r) => a + r.amount, 0);
    const removed = rows.filter(r => r.kind === "adjustment" && r.amount < 0).reduce((a, r) => a + Math.abs(r.amount), 0);
    return { spent, granted, removed };
  }, [rows]);

  return (
    <div>
      <SectionHeader icon={Receipt} title="Finance Log" subtitle={`Latest ${rows.length} transactions`} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Coins} label="Coins Spent" value={totals.spent.toLocaleString()} accent />
        <StatCard icon={ArrowUpRight} label="Granted by Staff" value={totals.granted.toLocaleString()} />
        <StatCard icon={ArrowDownRight} label="Removed by Staff" value={totals.removed.toLocaleString()} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Input
          placeholder="Search email or note…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All transactions</SelectItem>
            <SelectItem value="unlock">Chapter unlocks</SelectItem>
            <SelectItem value="adjustment">Admin adjustments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-muted-foreground py-8 text-center">Loading…</p> :
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 w-36 hidden sm:table-cell">When</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Detail</th>
                  <th className="text-right px-4 py-3 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-t border-border/40 hover:bg-card/60 transition-colors">
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground tabular-nums">
                      {new Date(r.occurred_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono truncate max-w-[180px]">{r.user_email ?? r.user_id.slice(0, 8)}</div>
                      <div className="md:hidden text-[10px] text-muted-foreground truncate max-w-[180px]">{r.note}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs">
                      <Badge variant="outline" className="mr-2 text-[9px] uppercase">{r.kind}</Badge>
                      <span className="text-muted-foreground">{r.note}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${r.amount < 0 ? "text-destructive" : "text-primary"}`}>
                      {r.amount > 0 ? "+" : ""}{r.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No transactions match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  );
}

/* ---------------------- MASS PRICE TOOL ---------------------- */
function MassPriceTool({ seriesId, chapterCount, onDone }: { seriesId: string; chapterCount: number; onDone: () => void }) {
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const p = Math.max(0, parseInt(price) || 0);
    if (!confirm(`Set the price of ALL ${chapterCount} chapter(s) to ${p} coin(s)? This cannot be undone.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_mass_update_chapter_price", { _series_id: seriesId, _price: p });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { success: boolean; updated?: number; error?: string };
    if (!res.success) return toast.error(res.error ?? "Failed");
    toast.success(`Updated ${res.updated} chapter(s) to ${p} coins`);
    onDone();
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl p-5 mb-8">
      <div className="flex items-start gap-3 mb-3">
        <Coins className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-bold uppercase tracking-wider text-sm">Mass Price Update</h3>
          <p className="text-xs text-muted-foreground">Set the same coin price across every chapter in this series.</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full sm:w-auto">
          <Label htmlFor="mass-price">New price (0 = free)</Label>
          <Input id="mass-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button onClick={apply} disabled={busy || chapterCount === 0} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          {busy ? "Applying…" : `Apply to ${chapterCount} chapters`}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------- SITE SETTINGS ---------------------- */
type SiteSettings = {
  site_name: string;
  seo_description: string;
  hero_series_id: string | null;
};

function SettingsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({ site_name: "", seo_description: "", hero_series_id: null });
  const [seriesList, setSeriesList] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [s, list] = await Promise.all([
        supabase.from("site_settings").select("site_name, seo_description, hero_series_id").eq("id", true).maybeSingle(),
        supabase.from("series").select("id, title").order("title"),
      ]);
      if (s.data) setSettings({
        site_name: s.data.site_name,
        seo_description: s.data.seo_description,
        hero_series_id: s.data.hero_series_id,
      });
      if (s.error) toast.error(s.error.message);
      setSeriesList(list.data ?? []);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!settings.site_name.trim()) return toast.error("Site name is required");
    setSaving(true);
    // Update singleton row
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: settings.site_name.trim(),
        seo_description: settings.seo_description.trim(),
        hero_series_id: settings.hero_series_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) { setSaving(false); return toast.error(error.message); }

    // Sync hero series flag: clear all, set chosen
    if (settings.hero_series_id) {
      await supabase.from("series").update({ is_trending: false }).neq("id", settings.hero_series_id);
      await supabase.from("series").update({ is_trending: true }).eq("id", settings.hero_series_id);
    }

    setSaving(false);
    toast.success("Site settings saved");
  };

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={SettingsIcon} title="Site Settings" subtitle="Brand, SEO, and the hero banner" />

      <div className="space-y-5">
        <GlassCard title="Branding">
          <div className="space-y-4">
            <div>
              <Label htmlFor="site_name">Site Name</Label>
              <Input id="site_name" value={settings.site_name} onChange={(e) => setSettings(s => ({ ...s, site_name: e.target.value }))} placeholder="Nuvia Toon" />
              <p className="text-xs text-muted-foreground mt-1">Shown across the homepage and SEO meta.</p>
            </div>
            <div>
              <Label htmlFor="seo">SEO Description</Label>
              <Textarea id="seo" rows={3} value={settings.seo_description} onChange={(e) => setSettings(s => ({ ...s, seo_description: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Used as the meta description on the homepage.</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Hero Banner Series" subtitle="Pick the headline series for the homepage hero">
          <Select
            value={settings.hero_series_id ?? "__none__"}
            onValueChange={(v) => setSettings(s => ({ ...s, hero_series_id: v === "__none__" ? null : v }))}
          >
            <SelectTrigger><SelectValue placeholder="No hero" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {seriesList.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">Saving will mark this series as the only Trending one.</p>
        </GlassCard>

        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
