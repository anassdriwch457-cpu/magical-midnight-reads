<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table): void {
            $table->boolean('id')->primary()->default(true);
            $table->string('site_name')->default('Nuvia Toon');
            $table->text('seo_description')->default('Discover trending manhwa and novels with a magical reading experience.');
            $table->uuid('hero_series_id')->nullable();
            $table->timestamps();
        });

        DB::table('site_settings')->insert([
            'id' => true,
            'site_name' => 'Nuvia Toon',
            'seo_description' => 'Discover trending manhwa and novels with a magical reading experience.',
            'hero_series_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
    }
};
