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
  Receipt, ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import JSZip from "jszip";

type Series = Tables<"series">;
type Chapter = Tables<"chapters">;

const ALL_GENRES = ["Action","Adventure","Comedy","Drama","Fantasy","Josei","Magic","Mystery","Romance","School Life","Shoujo","Shounen Ai","Supernatural","Yaoi","Yuri"];

type Tab = "analytics" | "content" | "users" | "finance";

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
    return t;
  }, [canViewAnalytics, canManageContent, canManageUsers]);

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
    <div className="pt-20 min-h-screen bg-background">
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
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "content", label: "Content", icon: Library },
    { key: "users", label: "Users", icon: UsersIcon },
  ];
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/40 min-h-[calc(100vh-5rem)] p-4 gap-1">
      <div className="px-3 py-4 mb-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Crown className="h-3.5 w-3.5 text-primary" /> {roleLabel}
        </div>
        <div className="mt-1 text-lg font-extrabold tracking-tight">Dashboard</div>
      </div>
      {items.filter(i => allowedTabs.includes(i.key)).map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors text-left ${
              active
                ? "bg-primary text-primary-foreground"
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

/* ---------------------- ANALYTICS ---------------------- */
function AnalyticsView() {
  const [totalSales, setTotalSales] = useState<number | null>(null);
  const [topSeries, setTopSeries] = useState<{ series_id: string; title: string; cover_url: string | null; unlocks: number; revenue: number }[]>([]);
  const [growth7, setGrowth7] = useState<number>(0);
  const [growth30, setGrowth30] = useState<number>(0);
  const [growthSeries, setGrowthSeries] = useState<{ day: string; signups: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sales, top, growth] = await Promise.all([
        supabase.rpc("admin_total_sales"),
        supabase.rpc("admin_top_series", { _limit: 10 }),
        supabase.rpc("admin_user_growth", { _days: 30 }),
      ]);
      if (sales.error) toast.error(sales.error.message); else setTotalSales(Number(sales.data ?? 0));
      if (top.error) toast.error(top.error.message); else setTopSeries((top.data ?? []) as never);
      if (growth.error) toast.error(growth.error.message);
      else {
        const days = (growth.data ?? []) as { day: string; signups: number }[];
        setGrowthSeries(days);
        setGrowth30(days.reduce((a, d) => a + Number(d.signups), 0));
        setGrowth7(days.slice(-7).reduce((a, d) => a + Number(d.signups), 0));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading analytics…</p>;

  const maxBar = Math.max(1, ...growthSeries.map(d => Number(d.signups)));

  return (
    <div>
      <SectionHeader icon={BarChart3} title="Analytics" subtitle="Sales, top content, and growth" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Coins} label="Total Coins Spent" value={totalSales?.toLocaleString() ?? "0"} accent />
        <StatCard icon={TrendingUp} label="New Users (7d)" value={growth7.toLocaleString()} />
        <StatCard icon={UsersIcon} label="New Users (30d)" value={growth30.toLocaleString()} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-bold uppercase tracking-wider text-sm mb-4">Top Series by Unlocks</h3>
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
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-bold uppercase tracking-wider text-sm mb-4">Sign-ups (last 30 days)</h3>
          <div className="flex items-end gap-1 h-40">
            {growthSeries.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.signups}`}>
                <div
                  className="w-full bg-primary/80 rounded-sm"
                  style={{ height: `${(Number(d.signups) / maxBar) * 100}%`, minHeight: 2 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{growthSeries[0]?.day.slice(5)}</span>
            <span>{growthSeries.at(-1)?.day.slice(5)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Coins; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("series").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <SectionHeader icon={Library} title="Series Library" subtitle={`${items.length} title${items.length === 1 ? "" : "s"}`} />
        <Button onClick={onNew} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
          <Plus className="h-4 w-4" /> New Series
        </Button>
      </div>

      {loading ? <p className="text-muted-foreground py-8 text-center">Loading…</p> :
        items.length === 0 ? <p className="text-muted-foreground py-8 text-center">No series yet. Create your first one.</p> :
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-card/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.cover_url && <img src={s.cover_url} alt="" className="h-12 w-9 object-cover rounded-sm" />}
                      <div>
                        <div className="font-bold">{s.title}</div>
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
};

const ROLES_EDITABLE: { key: "admin" | "manager" | "super_admin"; label: string }[] = [
  { key: "admin", label: "Uploader" },
  { key: "manager", label: "Manager" },
  { key: "super_admin", label: "Super-Admin" },
];

function UsersView({ canEditRoles }: { canEditRoles: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
  });

  return (
    <div>
      <SectionHeader icon={UsersIcon} title="Users" subtitle={`${users.length} total`} />

      <Input
        placeholder="Search by email or display name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm mb-5"
      />

      {loading ? <p className="text-muted-foreground py-8 text-center">Loading…</p> :
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Roles</th>
                <th className="text-left px-4 py-3 w-28">Coins</th>
                <th className="text-left px-4 py-3 hidden md:table-cell w-32">Joined</th>
                <th className="text-right px-4 py-3 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-t border-border hover:bg-card/50">
                  <td className="px-4 py-3">
                    <div className="font-bold">{u.display_name || u.email.split("@")[0]}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">user</span> :
                        u.roles.map(r => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold tabular-nums">
                    <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-primary" /> {u.coins}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelected(u)}>Manage</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users match your search.</td></tr>
              )}
            </tbody>
          </table>
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5">
          <h3 className="text-lg font-bold">{user.display_name || user.email.split("@")[0]}</h3>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>

        <div className="rounded-md bg-primary/5 border border-primary/30 p-4 mb-5">
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
          <div className="mt-6 border-t border-border pt-5">
            <Label className="mb-2 block">Roles</Label>
            <div className="space-y-2">
              {ROLES_EDITABLE.map(r => {
                const on = roles.includes(r.key);
                return (
                  <div key={r.key} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
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

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
