<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('series', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('cover_image')->nullable();
            $table->string('cover_url')->nullable();
            $table->string('banner_url')->nullable();
            $table->text('description')->nullable();
            $table->string('author')->nullable();
            $table->string('artist')->nullable();
            $table->enum('type', ['manga', 'novel'])->default('manga');
            $table->enum('status', ['ongoing', 'completed', 'hiatus'])->default('ongoing');
            $table->json('genres')->nullable();
            $table->boolean('is_trending')->default(false);
            $table->boolean('is_popular')->default(false);
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedBigInteger('views')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('series');
    }
};
