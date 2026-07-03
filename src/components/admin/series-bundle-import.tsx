import { useMemo, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, FileArchive, BookOpen, AlertTriangle } from "lucide-react";

const SERIES_STATUSES = ["ongoing", "completed", "hiatus"] as const;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;

type SeriesStatus = (typeof SERIES_STATUSES)[number];

type BundleManifest = {
  title?: string;
  slug?: string;
  description?: string;
  author?: string;
  status?: SeriesStatus;
  genres?: string[];
  sourceUrl?: string;
  coverPath?: string;
  chapters?: Array<{
    number?: number | string;
    title?: string;
    folder?: string;
    path?: string;
    price?: number;
  }>;
};

type ChapterPlan = {
  number: number;
  title: string | null;
  price: number;
  entries: JSZip.JSZipObject[];
};

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function extFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "png" || ext === "webp" || ext === "gif" || ext === "avif" ? ext : "jpg";
}

function contentTypeFromExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  return "image/jpeg";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseManifest(raw: string): BundleManifest {
  const parsed = JSON.parse(raw) as BundleManifest;
  return parsed ?? {};
}

function inferChapterNumber(
  label: string,
  index: number,
): { number: number; title: string | null } {
  const trimmed = label.replace(/\/+$/, "").split("/").pop() ?? label;
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  const number = match ? Number(match[1]) : index + 1;
  const titlePart = trimmed
    .replace(/^(?:ch(?:apter)?\.?\s*)?\d+(?:\.\d+)?\s*[-_:]*\s*/i, "")
    .trim();
  return {
    number: Number.isFinite(number) ? number : index + 1,
    title: titlePart || null,
  };
}

export function SeriesBundleImportView() {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [status, setStatus] = useState<SeriesStatus>("ongoing");
  const [genres, setGenres] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);

  const genreList = useMemo(
    () =>
      genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
    [genres],
  );

  const importSeries = async () => {
    if (!zipFile) return toast.error("Select a ZIP bundle first");

    setImporting(true);
    setProgress({ current: 0, total: 1, label: "Reading bundle…" });

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const manifestEntry = zip.file(/(?:^|\/)(?:series|manifest)\.json$/i)[0] ?? null;
      const manifest = manifestEntry ? parseManifest(await manifestEntry.async("text")) : {};

      const seriesTitle = (
        title.trim() ||
        manifest.title ||
        zipFile.name.replace(/\.zip$/i, "")
      ).trim();
      if (!seriesTitle) throw new Error("Series title is required");

      const seriesSlugBase = slug.trim() || manifest.slug || slugify(seriesTitle);
      if (!seriesSlugBase) throw new Error("Series slug is required");

      const seriesGenres = genreList.length > 0 ? genreList : (manifest.genres ?? []);
      const seriesDescription = description.trim() || manifest.description || null;
      const seriesAuthor = author.trim() || manifest.author || null;
      const seriesSourceUrl = sourceUrl.trim() || manifest.sourceUrl || null;
      const seriesCoverPath = coverPath.trim() || manifest.coverPath || "";
      const seriesStatus = status || manifest.status || "ongoing";

      let slugCandidate = seriesSlugBase;
      for (let i = 2; i < 100; i++) {
        const { data: clash, error } = await supabase
          .from("series")
          .select("id")
          .eq("slug", slugCandidate)
          .maybeSingle();
        if (error) throw error;
        if (!clash) break;
        slugCandidate = `${seriesSlugBase}-${i}`;
      }

      const { data: created, error: createErr } = await supabase
        .from("series")
        .insert({
          title: seriesTitle,
          slug: slugCandidate,
          description: seriesDescription,
          cover_url: null,
          status: seriesStatus,
          type: "manga",
          author: seriesAuthor,
          genres: seriesGenres,
          source_url: seriesSourceUrl,
        })
        .select("id")
        .single();
      if (createErr) throw createErr;

      const seriesId = created.id as string;
      const files = Object.values(zip.files).filter(
        (file) => !file.dir && IMAGE_EXTENSIONS.test(file.name),
      );

      const chapterPlans: ChapterPlan[] = [];
      if (manifest.chapters?.length) {
        for (const [index, chapter] of manifest.chapters.entries()) {
          const label = chapter.folder || chapter.path || `Chapter ${chapter.number ?? index + 1}`;
          const prefix = (chapter.folder || chapter.path || "")
            .replace(/^\.\//, "")
            .replace(/\/+$/, "");
          const entries = files
            .filter((file) => {
              if (!prefix) return false;
              const name = file.name.replace(/^\.\//, "");
              return name === prefix || name.startsWith(`${prefix}/`);
            })
            .sort((a, b) => naturalSort(a.name, b.name));
          if (entries.length === 0) continue;
          const inferred = inferChapterNumber(label, index);
          chapterPlans.push({
            number: Number(chapter.number ?? inferred.number),
            title: chapter.title?.trim() || inferred.title,
            price: Number(chapter.price ?? 0) || 0,
            entries,
          });
        }
      } else {
        const grouped = new Map<string, JSZip.JSZipObject[]>();
        for (const file of files) {
          const name = file.name.replace(/^\.\//, "");
          const parts = name.split("/");
          const group = parts.length > 1 ? parts[0] : "chapter-1";
          const list = grouped.get(group) ?? [];
          list.push(file);
          grouped.set(group, list);
        }
        const groups = Array.from(grouped.entries()).sort((a, b) => naturalSort(a[0], b[0]));
        if (groups.length === 0) throw new Error("No chapter images found in the ZIP");
        groups.forEach(([group, entries], index) => {
          const inferred = inferChapterNumber(group, index);
          chapterPlans.push({
            number: inferred.number,
            title: inferred.title,
            price: 0,
            entries: entries.sort((a, b) => naturalSort(a.name, b.name)),
          });
        });
      }

      if (chapterPlans.length === 0) throw new Error("No chapters found in the ZIP");

      const coverCandidates = [
        seriesCoverPath,
        manifest.coverPath,
        "cover.jpg",
        "cover.jpeg",
        "cover.png",
        "cover.webp",
        "cover.avif",
      ].filter(Boolean) as string[];

      let coverFile: JSZip.JSZipObject | null = null;
      for (const candidate of coverCandidates) {
        const exact = zip.file(candidate) ?? null;
        if (exact) {
          coverFile = exact;
          break;
        }
      }
      if (!coverFile) {
        coverFile =
          files
            .filter((file) => /(^|\/)cover\.(jpe?g|png|webp|gif|avif)$/i.test(file.name))
            .sort((a, b) => naturalSort(a.name, b.name))[0] ?? null;
      }
      if (!coverFile) {
        coverFile = chapterPlans[0].entries[0] ?? null;
      }

      if (coverFile) {
        setProgress({
          current: 1,
          total: chapterPlans.length + 1,
          label: `Uploading cover from ${coverFile.name}…`,
        });
        const coverBlob = await coverFile.async("blob");
        const coverExt = extFromName(coverFile.name);
        const coverPathName = `series/${seriesId}/cover.${coverExt}`;
        const { error: coverErr } = await supabase.storage
          .from("chapter-images")
          .upload(coverPathName, coverBlob, {
            upsert: true,
            contentType: contentTypeFromExt(coverExt),
          });
        if (coverErr) throw coverErr;
        const {
          data: { publicUrl: coverUrl },
        } = supabase.storage.from("chapter-images").getPublicUrl(coverPathName);
        const { error: updateErr } = await supabase
          .from("series")
          .update({ cover_url: coverUrl })
          .eq("id", seriesId);
        if (updateErr) throw updateErr;
      }

      let completed = 0;
      for (const chapter of chapterPlans) {
        setProgress({
          current: completed + 1,
          total: chapterPlans.length,
          label: `Creating chapter ${chapter.number}…`,
        });

        const { data: createdChapter, error: chapterErr } = await supabase
          .from("chapters")
          .insert({
            series_id: seriesId,
            number: chapter.number,
            title: chapter.title,
            price: chapter.price,
            source_url: null,
          })
          .select("id")
          .single();
        if (chapterErr) throw chapterErr;

        for (let index = 0; index < chapter.entries.length; index++) {
          const entry = chapter.entries[index];
          setProgress({
            current: completed + 1,
            total: chapterPlans.length,
            label: `Uploading Ch.${chapter.number} page ${index + 1}/${chapter.entries.length}…`,
          });
          const blob = await entry.async("blob");
          const ext = extFromName(entry.name);
          const path = `series/${seriesId}/ch-${String(chapter.number)}/p-${String(index + 1).padStart(4, "0")}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("chapter-images")
            .upload(path, blob, {
              upsert: true,
              contentType: contentTypeFromExt(ext),
            });
          if (uploadErr) throw uploadErr;
          const {
            data: { publicUrl },
          } = supabase.storage.from("chapter-images").getPublicUrl(path);
          const { error: pageErr } = await supabase.from("chapter_pages").insert({
            chapter_id: createdChapter.id,
            page_number: index + 1,
            image_url: publicUrl,
          });
          if (pageErr) throw pageErr;
        }

        completed++;
      }

      setProgress({
        current: chapterPlans.length,
        total: chapterPlans.length,
        label: "Finalizing…",
      });
      toast.success(`Imported ${chapterPlans.length} chapters`);
      setZipFile(null);
      setTitle("");
      setSlug("");
      setDescription("");
      setAuthor("");
      setSourceUrl("");
      setCoverPath("");
      setGenres("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bundle import failed");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <FileArchive className="h-5 w-5 text-primary" /> Import Owned Series Bundle
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a ZIP export for a series you own or are licensed to publish. The bundle can
          include a <code>series.json</code> manifest, a cover image, and chapter folders with page
          images.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bundle-zip">Series ZIP</Label>
          <Input
            id="bundle-zip"
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-title">Title</Label>
          <Input
            id="bundle-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Series title"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-slug">Slug</Label>
          <Input
            id="bundle-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated if blank"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bundle-description">Description</Label>
          <Textarea
            id="bundle-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Optional series description"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-author">Author</Label>
          <Input
            id="bundle-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Optional author name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-source">Source URL</Label>
          <Input
            id="bundle-source"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Optional internal source URL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-cover">Cover Path</Label>
          <Input
            id="bundle-cover"
            value={coverPath}
            onChange={(e) => setCoverPath(e.target.value)}
            placeholder="Optional path in ZIP"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SeriesStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERIES_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bundle-genres">Genres</Label>
          <Input
            id="bundle-genres"
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="Comma-separated: Action, Drama, Fantasy"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <span>
          Only import content you own or are licensed to distribute. The bundle should already
          contain the final pages you want published.
        </span>
      </div>

      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">{progress.label}</span>
            <span className="tabular-nums shrink-0">
              {progress.current} / {progress.total}
            </span>
          </div>
          <Progress value={(progress.current / Math.max(1, progress.total)) * 100} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" />
          Manifest fields are optional; the importer can infer chapters from folders when the ZIP is
          structured that way.
        </p>
        <Button onClick={importSeries} disabled={importing}>
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Import Series
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Badge variant="outline">series.json</Badge>
        <Badge variant="outline">cover.jpg</Badge>
        <Badge variant="outline">chapter folders</Badge>
        <Badge variant="outline">page images</Badge>
      </div>
    </div>
  );
}
