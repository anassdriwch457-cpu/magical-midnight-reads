<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChapterUnlock extends Model
{
    protected $fillable = [
        'user_id',
        'chapter_id',
        'coins_spent',
    ];

    protected function casts(): array
    {
        return [
            'coins_spent' => 'integer',
        ];
    }
}
