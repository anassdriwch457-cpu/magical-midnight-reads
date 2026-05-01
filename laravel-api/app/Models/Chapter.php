<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Chapter extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'series_id',
        'chapter_number',
        'number',
        'title',
        'images',
        'content',
        'is_premium',
        'price',
    ];

    protected function casts(): array
    {
        return [
            'chapter_number' => 'float',
            'number' => 'float',
            'images' => 'array',
            'is_premium' => 'boolean',
            'price' => 'integer',
        ];
    }

    public function series()
    {
        return $this->belongsTo(Series::class);
    }

    public function pages()
    {
        return $this->hasMany(ChapterPage::class);
    }

    protected static function booted(): void
    {
        $sync = function (Chapter $chapter): void {
            if (!$chapter->getKey()) {
                $chapter->id = (string) Str::uuid();
            }
            if (is_null($chapter->chapter_number) && !is_null($chapter->number)) {
                $chapter->chapter_number = $chapter->number;
            }
            if (is_null($chapter->number) && !is_null($chapter->chapter_number)) {
                $chapter->number = $chapter->chapter_number;
            }
            $chapter->is_premium = (int) ($chapter->price ?? 0) > 0;
        };

        static::creating($sync);
        static::updating($sync);
    }
}
