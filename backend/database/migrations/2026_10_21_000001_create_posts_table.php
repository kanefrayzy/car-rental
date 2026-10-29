<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Blog posts (2026-10-21), and the old addresses of posts whose slug was changed. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->string('slug', 100)->unique();
            $table->string('excerpt', 160)->nullable();
            // Markdown, as written or pasted in the admin panel.
            $table->longText('content');
            // Path on the public disk (blog/covers/…_1600x900.webp); copies sit next to it.
            $table->string('cover_image')->nullable();
            $table->string('cover_alt', 150)->nullable();
            $table->string('meta_title', 60)->nullable();
            $table->string('meta_description', 160)->nullable();
            // draft or published; a published post with published_at in the future is scheduled.
            $table->string('status', 16)->default('draft');
            $table->timestamp('published_at')->nullable();
            // Minutes, counted from the content on every save.
            $table->unsignedSmallInteger('reading_time')->default(1);
            // When the website was last told about this post; a scheduled post whose time has
            // come and that the website has not heard about yet is announced by blog:revalidate-due.
            $table->timestamp('revalidated_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
        });

        Schema::create('post_slug_redirects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->string('old_slug', 100)->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_slug_redirects');
        Schema::dropIfExists('posts');
    }
};
