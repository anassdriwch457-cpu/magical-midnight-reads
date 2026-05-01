<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'session_id',
        'amount_cents',
        'coins',
        'status',
        'credited_at',
    ];

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'coins' => 'integer',
            'credited_at' => 'datetime',
        ];
    }
}
