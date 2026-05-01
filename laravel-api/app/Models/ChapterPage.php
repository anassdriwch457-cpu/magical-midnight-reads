<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ChapterPage extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'chapter_id',
        'page_number',
        'image_url',
    ];

    protected function casts(): array
    {
        return [
            'page_number' => 'integer',
        ];
    }

    public function chapter()
    {
        return $this->belongsTo(Chapter::class);
    }

    protected static function booted(): void
    {
        static::creating(function (ChapterPage $page): void {
            if (!$page->getKey()) {
                $page->id = (string) Str::uuid();
            }
        });
    }
}
