<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    public $incrementing = false;
    protected $keyType = 'string';

    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'display_name',
        'coin_balance',
        'banned_until',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'coin_balance' => 'integer',
            'banned_until' => 'datetime',
        ];
    }

    public function roles()
    {
        return $this->hasMany(UserRole::class);
    }

    protected static function booted(): void
    {
        static::creating(function (User $user): void {
            if (!$user->getKey()) {
                $user->id = (string) Str::uuid();
            }
        });
    }
}
