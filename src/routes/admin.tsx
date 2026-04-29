import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Plus, Pencil, Trash2, Upload, ArrowLeft, BookOpen, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

type Series = Tables<"series">;
type Chapter = Tables<"chapters">;

const ALL_GENRES = ["Action","Adventure","Comedy","Drama","Fantasy","Josei","Magic","Mystery","Romance","School Life","Shoujo","Shounen Ai","Supernatural","Yaoi","Yuri"];

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Nuvia Toon" }] }),
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect non-admin authenticated users to home with toast
  useEffect(() => {
    if (loading) return;
    if (user && !isAdmin) {
      toast.error("Admin access required");
      navigate({ to: "/" });
    }
  }, [user, isAdmin, loading, navigate]);

  const [view, setView] = useState<{ kind: "list" } | { kind: "edit"; id: string | null } | { kind: "chapters"; id: string }>({ kind: "list" });

  if (loading) return <div className="pt-24 text-center text-muted-foreground">Loading…</div>;

  if (!user) return (
    <div className="container mx-auto px-4 pt-24 pb-20 text-center">
      <p>Please <Link to="/auth" className="text-primary underline">sign in</Link> first.</p>
    </div>
  );

  if (!isAdmin) return (
    <div className="container mx-auto px-4 pt-24 pb-20 max-w-xl text-center">
      <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <h1 className="text-2xl font-bold mb-2">Admin access required</h1>
      <p className="text-muted-foreground mb-6">Your account doesn't have admin privileges yet.</p>
      <div className="rounded-[4px] border border-border bg-card p-5 text-left text-sm space-y-2">
        <p className="font-semibold">To grant yourself admin access (one-time setup):</p>
        <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto"><code>{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user.id}', 'admin')
ON CONFLICT DO NOTHING;`}</code></pre>
        <p className="text-muted-foreground">Then refresh this page.</p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 pt-24 pb-20 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage series, chapters, and uploads</p>
        </div>
      </div>

      {view.kind === "list" && <SeriesList onEdit={(id) => setView({ kind: "edit", id })} onChapters={(id) => setView({ kind: "chapters", id })} onNew={() => setView({ kind: "edit", id: null })} />}
      {view.kind === "edit" && <SeriesForm id={view.id} onBack={() => setView({ kind: "list" })} />}
      {view.kind === "chapters" && <ChapterManager seriesId={view.id} onBack={() => setView({ kind: "list" })} />}
    </div>
  );
}

/* ---------------------- SERIES LIST ---------------------- */
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
        <h2 className="text-lg font-bold uppercase tracking-wider">Series Library</h2>
        <Button onClick={onNew} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-[4px]">
          <Plus className="h-4 w-4" /> New Series
        </Button>
      </div>

      {loading ? <p className="text-muted-foreground py-8 text-center">Loading…</p> :
        items.length === 0 ? <p className="text-muted-foreground py-8 text-center">No series yet. Create your first one.</p> :
        <div className="rounded-[4px] border border-border overflow-hidden">
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

/* ---------------------- SERIES FORM ---------------------- */
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
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[4px] border transition-colors ${
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
          <div className="rounded-[4px] border border-border bg-card aspect-[2/3] mt-2 flex items-center justify-center overflow-hidden">
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
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-[4px]">
          {saving ? "Saving…" : id ? "Save Changes" : "Create Series"}
        </Button>
        <Button variant="outline" onClick={onBack} className="rounded-[4px]">Cancel</Button>
      </div>
    </div>
  );
}

/* ---------------------- CHAPTER MANAGER ---------------------- */
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
    // Delete pages first (storage cleanup is best-effort; skip to keep simple)
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
      // 1. Insert chapter row
      const { data: ch, error: chErr } = await supabase.from("chapters").insert({
        series_id: seriesId, number: n, title: title.trim() || null, price: p,
        content: series?.type === "novel" ? content.trim() : null,
      }).select().single();
      if (chErr) throw chErr;

      // 2. If manga: extract ZIP & upload images
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
        // Insert in batches to be safe
        const BATCH = 50;
        for (let i = 0; i < pageRows.length; i += BATCH) {
          const { error: pErr } = await supabase.from("chapter_pages").insert(pageRows.slice(i, i + BATCH));
          if (pErr) throw pErr;
        }
      }

      // 3. Touch series.updated_at
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

      {/* New chapter form */}
      <div className="rounded-[4px] border border-border bg-card p-5 mb-8">
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
              <p className="text-xs text-muted-foreground mt-1">Images are sorted alphabetically. Supports JPG, PNG, WEBP, GIF, AVIF.</p>
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
              <span>{progress.label}</span>
              <span className="tabular-nums">{progress.current} / {progress.total}</span>
            </div>
            <Progress value={(progress.current / Math.max(1, progress.total)) * 100} />
          </div>
        )}

        <div className="mt-5">
          <Button onClick={createChapter} disabled={creating} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-[4px]">
            <Upload className="h-4 w-4" /> {creating ? "Uploading…" : "Create Chapter"}
          </Button>
        </div>
      </div>

      {/* Chapter list */}
      <h3 className="font-bold uppercase tracking-wider text-sm mb-3">Chapters</h3>
      {chapters.length === 0 ? <p className="text-muted-foreground text-sm py-6 text-center">No chapters yet.</p> :
        <div className="rounded-[4px] border border-border overflow-hidden">
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
