<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\ChapterPage;
use App\Models\Series;
use Illuminate\Http\JsonResponse;

class ChapterController extends Controller
{
    public function bySeries(string $series): JsonResponse
    {
        $seriesModel = Series::query()
            ->where('id', $series)
            ->orWhere('slug', $series)
            ->firstOrFail();

        $chapters = Chapter::query()
            ->where('series_id', $seriesModel->id)
            ->orderBy('number')
            ->get();

        return response()->json($chapters);
    }

    public function pages(string $chapter): JsonResponse
    {
        $pages = ChapterPage::query()
            ->where('chapter_id', $chapter)
            ->orderBy('page_number')
            ->get();

        if ($pages->isNotEmpty()) {
            return response()->json($pages);
        }

        $chapterModel = Chapter::query()->findOrFail($chapter);
        $images = collect($chapterModel->images ?? [])
            ->values()
            ->map(fn ($url, $index) => [
                'id' => $chapterModel->id . '-' . ($index + 1),
                'chapter_id' => $chapterModel->id,
                'page_number' => $index + 1,
                'image_url' => $url,
            ]);

        return response()->json($images);
    }
}
