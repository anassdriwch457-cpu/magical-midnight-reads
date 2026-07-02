<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\ChapterUnlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UnlockChapterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = ChapterUnlock::query()
            ->where('user_id', $request->user()->id)
            ->get(['chapter_id'])
            ->map(fn ($row) => ['chapter_id' => (string) $row->chapter_id])
            ->values();

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chapter_id' => ['required', 'string', 'exists:chapters,id'],
        ]);

        $user = $request->user();
        $chapter = Chapter::query()->findOrFail($data['chapter_id']);
        $price = (int) $chapter->price;

        if ($price <= 0 || !$chapter->is_premium) {
            ChapterUnlock::firstOrCreate([
                'user_id' => $user->id,
                'chapter_id' => $chapter->id,
            ], ['coins_spent' => 0]);

            return response()->json([
                'success' => true,
                'balance' => (int) $user->coin_balance,
            ]);
        }

        $already = ChapterUnlock::query()
            ->where('user_id', $user->id)
            ->where('chapter_id', $chapter->id)
            ->exists();

        if ($already) {
            return response()->json([
                'success' => true,
                'balance' => (int) $user->coin_balance,
            ]);
        }

        if ((int) $user->coin_balance < $price) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient coins',
            ]);
        }

        try {
            DB::transaction(function () use ($user, $chapter, $price): void {
                $user->refresh();
                if ((int) $user->coin_balance < $price) {
                    throw new \RuntimeException('Insufficient coins');
                }
                $user->decrement('coin_balance', $price);

                ChapterUnlock::create([
                    'user_id' => $user->id,
                    'chapter_id' => $chapter->id,
                    'coins_spent' => $price,
                ]);
            });
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient coins',
            ]);
        } catch (\Throwable $e) {
            Log::error('[unlock] transaction failed', [
                'chapter_id' => $chapter->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to unlock chapter, please try again',
            ], 500);
        }

        $user->refresh();

        return response()->json([
            'success' => true,
            'balance' => (int) $user->coin_balance,
        ]);
    }

    public function storeByPath(Request $request, string $chapter): JsonResponse
    {
        $request->merge(['chapter_id' => $chapter]);
        return $this->store($request);
    }
}
