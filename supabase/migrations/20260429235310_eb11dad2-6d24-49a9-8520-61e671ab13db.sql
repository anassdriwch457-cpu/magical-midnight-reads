-- Import jobs tracker
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  source_site TEXT NOT NULL,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_chapters INT NOT NULL DEFAULT 0,
  completed_chapters INT NOT NULL DEFAULT 0,
  current_chapter TEXT,
  error TEXT,
  logs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_created_at ON public.import_jobs(created_at DESC);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import jobs"
ON public.import_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Source URL on series/chapters for dedupe + traceability
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_source_url ON public.series(source_url) WHERE source_url IS NOT NULL;

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE INDEX IF NOT EXISTS idx_chapters_source_url ON public.chapters(source_url);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_import_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_import_jobs_updated_at();