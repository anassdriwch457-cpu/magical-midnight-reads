import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { uploadChapterFromUrls, listSeriesForUpload } from "@/lib/chapter-upload.functions";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, FileText, AlertCircle } from "lucide-react";

type SeriesItem = { id: string; title: string; slug: string; type: string };

export function ChapterUrlUploadView() {
  const list = useServerFn(listSeriesForUpload);
  const upload = useServerFn(uploadChapterFromUrls);

  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [seriesId, setSeriesId] = useState<string>("");
  const [chapterNumber, setChapterNumber] = useState<string>("1");
  const [chapterTitle, setChapterTitle] = useState<string>("");
  const [price, setPrice] = useState<string>("0");
  const [urls, setUrls] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ saved: number; total: number; errors: string[] } | null>(
    null,
  );

  useEffect(() => {
    list()
      .then((res) => setSeries((res.series as SeriesItem[]) ?? []))
      .catch((e) => toast.error((e as Error).message));
  }, [list]);

  const onSubmit = async () => {
    const lines = urls
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && /^https?:\/\//i.test(l));
    if (!seriesId) return toast.error("Pick a series");
    if (lines.length === 0) return toast.error("Paste at least one image URL");
    const num = Number(chapterNumber);
    if (!Number.isFinite(num)) return toast.error("Chapter number is invalid");

    setLoading(true);
    setResult(null);
    try {
      const res = await upload({
        data: {
          seriesId,
          chapterNumber: num,
          chapterTitle: chapterTitle.trim() || null,
          price: Number(price) || 0,
          imageUrls: lines,
        },
      });
      setResult({ saved: res.saved, total: res.total, errors: res.errors });
      if (res.errors.length === 0) {
        toast.success(`Uploaded ${res.saved}/${res.total} pages`);
      } else {
        toast.warning(`Uploaded ${res.saved}/${res.total} (${res.errors.length} errors)`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" /> Upload Chapter from URLs
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Paste image URLs (one per line) from <strong>Google Drive</strong> or{" "}
          <strong>Gofile</strong>. Drive links like{" "}
          <code className="text-[10px]">drive.google.com/file/d/ID/view</code> are auto-converted —
          just make sure each file is shared as &quot;Anyone with the link&quot;. For Gofile, use
          the direct download URL of each image.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Series</Label>
          <Select value={seriesId} onValueChange={setSeriesId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a series…" />
            </SelectTrigger>
            <SelectContent>
              {series.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {s.type}
                    </Badge>
                    {s.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Chapter Number</Label>
          <Input
            type="number"
            step="0.1"
            value={chapterNumber}
            onChange={(e) => setChapterNumber(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Price (coins, 0 = free)</Label>
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Chapter Title (optional)</Label>
          <Input
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            placeholder="e.g. The Awakening"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Image URLs (one per line)
          </Label>
          <Textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder={`https://drive.google.com/file/d/ABC.../view\nhttps://store4.gofile.io/download/.../page1.jpg`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          ⚠️ Re-uploading the same chapter number replaces all existing pages.
        </p>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload Chapter
        </Button>
      </div>

      {result && (
        <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-2">
          <div>
            Saved <strong>{result.saved}</strong> / {result.total} pages
          </div>
          {result.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {result.errors.length} errors
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto text-[10.5px]">
                {result.errors.join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
