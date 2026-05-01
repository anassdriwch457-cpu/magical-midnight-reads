<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chapters', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('series_id')->constrained('series')->cascadeOnDelete();
            $table->decimal('chapter_number', 6, 2)->nullable();
            $table->decimal('number', 6, 2)->index();
            $table->string('title')->nullable();
            $table->json('images')->nullable();
            $table->longText('content')->nullable();
            $table->boolean('is_premium')->default(false);
            $table->unsignedInteger('price')->default(0);
            $table->timestamps();
            $table->unique(['series_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chapters');
    }
};
