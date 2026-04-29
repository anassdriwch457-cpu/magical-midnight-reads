export function SeriesCardSkeleton() {
  return (
    <div className="block">
      <div className="aspect-[2/3] rounded-[4px] bg-muted/50 animate-pulse" />
      <div className="pt-2.5 space-y-2">
        <div className="h-3 w-3/4 rounded bg-muted/50 animate-pulse" />
        <div className="h-2.5 w-1/2 rounded bg-muted/40 animate-pulse" />
      </div>
    </div>
  );
}

export function SeriesCardSkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <SeriesCardSkeleton key={i} />
      ))}
    </div>
  );
}
