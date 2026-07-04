import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createImportJob,
  importSeriesFromJson,
  importSeriesFromJsonUrl,
  importSeriesFromSourceApi,
  listImportJobs,
  runImportStep,
  cancelImportJob,
} from "@/lib/migrator.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  Play,
  StopCircle,
  RefreshCw,
} from "lucide-react";
import { ChapterUrlUploadView } from "./chapter-url-upload";

type Job = {
  id: string;
  source_url: string;
  source_site: string;
  series_id: string | null;
  status: string;
  total_chapters: number;
  completed_chapters: number;
  current_chapter: string | null;
  error: string | null;
  logs: string[];
  created_at: string;
};

const SITES = [{ id: "mangago", label: "Mangago.me" }] as const;
const SOURCE_API_SITES = [
  { id: "mangabuddy", label: "MangaBuddy" },
  { id: "kunmanga", label: "KunManga" },
  { id: "comix", label: "Comix.to" },
] as const;

const GENERIC_IMPORT_EXAMPLE = {
  title: "Example Series",
  description: "Imported from a JSON payload",
  author: "Author Name",
  slug: "example-series",
  type: "manga",
  status: "ongoing",
  chapters: [
    {
      number: 1,
      title: "Chapter 1",
      imageUrls: ["https://example.com/page-1.jpg", "https://example.com/page-2.jpg"],
    },
  ],
};

function getImportedChapterCount(result: unknown) {
  if (!result || typeof result !== "object") {
    return 0;
  }
  const chapters = (result as { chapters?: unknown }).chapters;
  return Array.isArray(chapters) ? chapters.length : 0;
}

export function MigratorView() {
  const create = useServerFn(createImportJob);
  const importJson = useServerFn(importSeriesFromJson);
  const importJsonUrl = useServerFn(importSeriesFromJsonUrl);
  const importSourceApi = useServerFn(importSeriesFromSourceApi);
  const list = useServerFn(listImportJobs);
  const step = useServerFn(runImportStep);
  const cancel = useServerFn(cancelImportJob);

  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSite, setSourceSite] = useState<string>("mangago");
  const [creating, setCreating] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const [importingSourceApi, setImportingSourceApi] = useState(false);
  const [sourceApiBatchUrls, setSourceApiBatchUrls] = useState("");
  const [importingBatch, setImportingBatch] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const stoppedRef = useRef<Set<string>>(new Set());
  const [jsonPayload, setJsonPayload] = useState(JSON.stringify(GENERIC_IMPORT_EXAMPLE, null, 2));
  const [jsonSourceUrl, setJsonSourceUrl] = useState("");
  const [sourceApiUrl, setSourceApiUrl] = useState("");
  const [sourceApiSite, setSourceApiSite] = useState<string>("comix");
  const [includeChapterImages, setIncludeChapterImages] = useState(true);
  const [chapterLimit, setChapterLimit] = useState(50);

  const refresh = useCallback(async () => {
    try {
      const res = await list();
      setJobs((res.jobs as Job[]) ?? []);
    } catch (err) {
      console.error(err);
    }
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runUntilDone = async (jobId: string) => {
    activeRef.current = jobId;
    setActiveJobId(jobId);
    try {
      while (activeRef.current === jobId && !stoppedRef.current.has(jobId)) {
        const res = await step({ data: { jobId } });
        const updated = (res.job as Job) ?? null;
        if (updated) {
          setJobs((prev) => {
            const found = prev.some((j) => j.id === updated.id);
            return found
              ? prev.map((j) => (j.id === updated.id ? updated : j))
              : [updated, ...prev];
          });
          if (updated.status === "done") {
            toast.success(`Import done: ${updated.completed_chapters} chapters`);
            break;
          }
          if (updated.status === "failed") {
            toast.error(`Import failed: ${updated.error ?? "unknown error"}`);
            break;
          }
        }
        // tiny breather
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (activeRef.current === jobId) {
        activeRef.current = null;
        setActiveJobId(null);
      }
    }
  };

  const onStart = async () => {
    if (!sourceUrl.trim()) {
      toast.error("Enter a source URL");
      return;
    }
    setCreating(true);
    try {
      const { jobId } = await create({
        data: { sourceUrl: sourceUrl.trim(), sourceSite: sourceSite as "mangago" },
      });
      toast.success("Import job started");
      setSourceUrl("");
      await refresh();
      runUntilDone(jobId);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onImportJson = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonPayload);
    } catch {
      toast.error("Paste valid JSON");
      return;
    }

    setImportingJson(true);
    try {
      const res = await importJson({ data: parsed });
      const chapters = (res.chapters as Array<{ chapterNumber: number }>) ?? [];
      toast.success(`Imported ${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImportingJson(false);
    }
  };

  const onImportJsonUrl = async () => {
    if (!jsonSourceUrl.trim()) {
      toast.error("Enter a JSON URL");
      return;
    }

    setImportingJson(true);
    try {
      const res = await importJsonUrl({ data: { url: jsonSourceUrl.trim() } });
      const chapters = getImportedChapterCount(res);
      toast.success(`Imported ${chapters} chapter${chapters === 1 ? "" : "s"}`);
      setJsonSourceUrl("");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImportingJson(false);
    }
  };

  const onImportSourceApi = async () => {
    if (!sourceApiUrl.trim()) {
      toast.error("Enter a series URL");
      return;
    }
    setImportingSourceApi(true);
    try {
      const res = await importSourceApi({
        data: {
          url: sourceApiUrl.trim(),
          site: sourceApiSite as "mangabuddy" | "kunmanga" | "comix",
          includeChapterImages,
          chapterLimit,
        },
      });
      const chapters = getImportedChapterCount(res);
      toast.success(`Imported ${chapters} chapter${chapters === 1 ? "" : "s"}`);
      setSourceApiUrl("");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImportingSourceApi(false);
    }
  };

  const onImportSourceApiBatch = async () => {
    const urls = sourceApiBatchUrls
      .split(/[\n,]+/)
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      toast.error("Add at least one series URL");
      return;
    }

    setImportingBatch(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const url of urls) {
        try {
          await importSourceApi({
            data: {
              url,
              site: sourceApiSite as "mangabuddy" | "kunmanga" | "comix",
              includeChapterImages,
              chapterLimit,
            },
          });
          ok++;
        } catch (err) {
          failed++;
          console.error(err);
        }
      }

      toast.success(
        failed === 0 ? `Imported ${ok} series` : `Imported ${ok} series, ${failed} failed`,
      );
      setSourceApiBatchUrls("");
      await refresh();
    } finally {
      setImportingBatch(false);
    }
  };

  const onResume = (jobId: string) => {
    stoppedRef.current.delete(jobId);
    runUntilDone(jobId);
  };

  const onPause = (jobId: string) => {
    stoppedRef.current.add(jobId);
    if (activeRef.current === jobId) {
      activeRef.current = null;
      setActiveJobId(null);
    }
  };

  const onCancel = async (jobId: string) => {
    stoppedRef.current.add(jobId);
    try {
      await cancel({ data: { jobId } });
      toast.success("Cancelled");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Download className="h-6 w-6 text-primary" /> Quick Import / Migrator
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a series URL from a supported site. The tool fetches series info, copies the cover
          and every chapter image to your Cloud storage, and creates the records here. Only import
          content you have rights to host.
        </p>
      </header>

      {/* New job form */}
      <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6 space-y-4">
        <div className="grid sm:grid-cols-[1fr_220px_auto] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="src-url">Source URL</Label>
            <Input
              id="src-url"
              placeholder="https://www.mangago.me/read-manga/your_series/"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="src-site">Source Site</Label>
            <Select value={sourceSite} onValueChange={setSourceSite}>
              <SelectTrigger id="src-site">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" /> {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={onStart} disabled={creating} className="w-full sm:w-auto">
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start Migration
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          Imports run in the background. You can close this page — the job continues on the next
          time it&apos;s resumed. Pause if you want to stop fetching.
        </p>
      </div>

      {/* Manual URL upload (Drive / Gofile) */}
      <ChapterUrlUploadView />

      <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold">Series Link Import</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fetch series data from your scrape API, then save it into Pearltoon. This uses the
            server-side scraper key from project secrets.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div className="space-y-1.5">
            <Label htmlFor="source-api-url">Series URL</Label>
            <Input
              id="source-api-url"
              placeholder="https://comix.to/title/your-series"
              value={sourceApiUrl}
              onChange={(e) => setSourceApiUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source-api-site">Site</Label>
            <Select value={sourceApiSite} onValueChange={setSourceApiSite}>
              <SelectTrigger id="source-api-site">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_API_SITES.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeChapterImages}
              onChange={(e) => setIncludeChapterImages(e.target.checked)}
            />
            Include chapter images
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="chapter-limit">Chapter limit</Label>
            <Input
              id="chapter-limit"
              type="number"
              min={1}
              max={200}
              value={chapterLimit}
              onChange={(e) => setChapterLimit(Number(e.target.value) || 50)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onImportSourceApi} disabled={importingSourceApi}>
            {importingSourceApi ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import from Source API
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-api-batch">Batch series URLs</Label>
          <Textarea
            id="source-api-batch"
            value={sourceApiBatchUrls}
            onChange={(e) => setSourceApiBatchUrls(e.target.value)}
            rows={5}
            placeholder={"https://example.com/series/1\nhttps://example.com/series/2"}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onImportSourceApiBatch} disabled={importingBatch}>
            {importingBatch ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import batch
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold">Generic JSON Import</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste series metadata, or point this at a public JSON export URL. The payload can
            include <code>chapters</code> or a top-level <code>imageUrls</code> array for chapter 1.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="json-source-url">JSON URL</Label>
            <Input
              id="json-source-url"
              placeholder="https://example.com/export/series.json"
              value={jsonSourceUrl}
              onChange={(e) => setJsonSourceUrl(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={onImportJsonUrl} disabled={importingJson} className="w-full sm:w-auto">
              {importingJson ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Import JSON URL
            </Button>
          </div>
        </div>
        <Textarea
          value={jsonPayload}
          onChange={(e) => setJsonPayload(e.target.value)}
          rows={14}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onImportJson} disabled={importingJson}>
            {importingJson ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => setJsonPayload(JSON.stringify(GENERIC_IMPORT_EXAMPLE, null, 2))}
          >
            Load example
          </Button>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Recent jobs</h3>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No import jobs yet. Paste a URL above to start.
          </div>
        )}

        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isActive={activeJobId === job.id}
            onResume={() => onResume(job.id)}
            onPause={() => onPause(job.id)}
            onCancel={() => onCancel(job.id)}
          />
        ))}
      </div>
    </div>
  );
}

function JobCard({
  job,
  isActive,
  onResume,
  onPause,
  onCancel,
}: {
  job: Job;
  isActive: boolean;
  onResume: () => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  const pct =
    job.total_chapters > 0
      ? Math.round((job.completed_chapters / job.total_chapters) * 100)
      : job.status === "done"
        ? 100
        : 0;

  const statusBadge = () => {
    switch (job.status) {
      case "done":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
      case "pending":
      case "scraping":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scraping
          </Badge>
        );
      case "importing_chapters":
        return (
          <Badge className="bg-primary/15 text-primary border-primary/30">
            {isActive ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Importing
          </Badge>
        );
      default:
        return <Badge variant="outline">{job.status}</Badge>;
    }
  };

  const lastLogs = (job.logs ?? []).slice(-4);

  return (
    <div className="rounded-xl border border-border bg-card/40 backdrop-blur p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {statusBadge()}
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {job.source_site}
            </span>
          </div>
          <a
            href={job.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium truncate block hover:underline"
          >
            {job.source_url}
          </a>
          {job.current_chapter && (
            <div className="text-xs text-muted-foreground mt-1">Current: {job.current_chapter}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(job.status === "pending" ||
            job.status === "scraping" ||
            job.status === "importing_chapters") &&
            (isActive ? (
              <Button size="sm" variant="outline" onClick={onPause}>
                <StopCircle className="h-4 w-4" /> Pause
              </Button>
            ) : (
              <Button size="sm" onClick={onResume}>
                <Play className="h-4 w-4" /> Resume
              </Button>
            ))}
          {(job.status === "pending" ||
            job.status === "scraping" ||
            job.status === "importing_chapters") && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {job.completed_chapters} / {job.total_chapters || "?"} chapters
          </span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      {job.error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {job.error}
        </div>
      )}

      {lastLogs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Logs ({(job.logs ?? []).length})
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/30 p-2 text-[10.5px] leading-relaxed">
            {(job.logs ?? []).slice(-50).join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
