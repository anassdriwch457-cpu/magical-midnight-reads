<?php

namespace App\Http\Controllers;

use App\Models\Series;
use App\Models\SiteSetting;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SeriesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Series::query();

        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($request->filled('trending')) {
            $query->where('is_trending', true);
        }
        if ($request->filled('popular')) {
            $query->where('is_popular', true);
        }
        if ($request->filled('slug')) {
            $query->where('slug', $request->string('slug')->toString());
        }
        if ($request->filled('id')) {
            $query->where('id', $request->string('id')->toString());
        }
        if ($request->filled('exclude_id')) {
            $query->where('id', '!=', $request->string('exclude_id')->toString());
        }
        if ($request->filled('ids')) {
            $ids = collect(explode(',', (string) $request->string('ids')))
                ->map(fn ($id) => trim($id))
                ->filter()
                ->values();
            if ($ids->isNotEmpty()) {
                $query->whereIn('id', $ids);
            }
        }
        if ($request->filled('genre')) {
            $genre = $request->string('genre')->toString();
            $query->where(function (Builder $q) use ($genre): void {
                $q->whereJsonContains('genres', $genre)
                    ->orWhereJsonContains('genres', [$genre]);
            });
        }
        if ($request->filled('q')) {
            $q = $request->string('q')->toString();
            $query->where('title', 'like', '%' . $q . '%');
        }

        $sort = $request->string('sort')->toString();
        $dir = strtolower($request->string('dir', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        $sortable = ['created_at', 'updated_at', 'title', 'views', 'rating'];
        if (in_array($sort, $sortable, true)) {
            $query->orderBy($sort, $dir);
        } else {
            $query->orderBy('updated_at', 'desc');
        }

        $perPage = min(max((int) $request->integer('per_page', 18), 1), 100);
        $rows = $query->paginate($perPage);

        return response()->json([
            'data' => $rows->items(),
            'total' => $rows->total(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function show(string $series): JsonResponse
    {
        $row = Series::query()
            ->where('id', $series)
            ->orWhere('slug', $series)
            ->firstOrFail();

        return response()->json($row);
    }

    public function siteSettings(): JsonResponse
    {
        $settings = SiteSetting::query()->find(true);

        if (!$settings) {
            return response()->json([
                'id' => true,
                'site_name' => 'Nuvia Toon',
                'seo_description' => 'Discover trending manhwa and novels with a magical reading experience.',
                'hero_series_id' => null,
            ]);
        }

        return response()->json($settings);
    }
}
