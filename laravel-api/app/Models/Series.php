<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Series extends Model
{
    protected $table = 'series';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'title',
        'slug',
        'description',
        'cover_image',
        'cover_url',
        'banner_url',
        'author',
        'artist',
        'type',
        'status',
        'genres',
        'is_trending',
        'is_popular',
        'rating',
        'views',
    ];

    protected function casts(): array
    {
        return [
            'genres' => 'array',
            'is_trending' => 'boolean',
            'is_popular' => 'boolean',
            'rating' => 'float',
            'views' => 'integer',
        ];
    }

    public function chapters()
    {
        return $this->hasMany(Chapter::class);
    }

    protected static function booted(): void
    {
        static::creating(function (Series $series): void {
            if (!$series->getKey()) {
                $series->id = (string) Str::uuid();
            }
        });
    }
}
