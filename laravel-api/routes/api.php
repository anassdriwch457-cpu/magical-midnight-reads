<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChapterController;
use App\Http\Controllers\SeriesController;
use App\Http\Controllers\StripeController;
use App\Http\Controllers\UnlockChapterController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:5,1')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

Route::get('/series', [SeriesController::class, 'index']);
Route::get('/series/{series}', [SeriesController::class, 'show']);
Route::get('/series/{series}/chapters', [ChapterController::class, 'bySeries']);
Route::get('/chapters/{chapter}/pages', [ChapterController::class, 'pages']);
Route::get('/site-settings', [SeriesController::class, 'siteSettings']);

Route::post('/stripe/webhook', [StripeController::class, 'webhook']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::get('/user/roles', [AuthController::class, 'roles']);
    Route::get('/wallet/balance', [AuthController::class, 'walletBalance']);
    Route::get('/user/unlocks', [UnlockChapterController::class, 'index']);
    Route::post('/unlock-chapter', [UnlockChapterController::class, 'store']);
    Route::post('/chapters/{chapter}/unlock', [UnlockChapterController::class, 'storeByPath']);
    Route::post('/verify-checkout', [StripeController::class, 'verifyCheckout']);
});
