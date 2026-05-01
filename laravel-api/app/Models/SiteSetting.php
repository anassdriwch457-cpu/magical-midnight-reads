<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected $table = 'site_settings';

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'boolean';

    protected $fillable = [
        'id',
        'site_name',
        'seo_description',
        'hero_series_id',
    ];
}
