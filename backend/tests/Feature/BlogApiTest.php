<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\PostSlugRedirect;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/** What the website reads: only live posts, old addresses of renamed posts, signed previews. */
class BlogApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::fake();
    }

    public function test_the_list_has_live_posts_only_newest_first_with_pages(): void
    {
        $older = Post::factory()->published('2026-10-01 14:00:00')->create(['title' => 'Older post']);
        $newer = Post::factory()->published('2026-10-10 14:00:00')->create(['title' => 'Newer post']);
        Post::factory()->create(['title' => 'A draft']);
        Post::factory()->scheduled('2026-10-20 14:00:00')->create(['title' => 'Scheduled post']);

        $this->getJson('/api/blog/posts')
            ->assertOk()
            ->assertJsonPath('meta', ['page' => 1, 'perPage' => 12, 'total' => 2, 'lastPage' => 1])
            ->assertJsonPath('data.0.slug', $newer->slug)
            ->assertJsonPath('data.1.slug', $older->slug)
            ->assertJsonMissingPath('data.0.content')
            ->assertJsonStructure(['data' => [['slug', 'title', 'excerpt', 'cover', 'publishedAt', 'updatedAt', 'readingTime']]]);

        $this->getJson('/api/blog/posts?perPage=1&page=2')
            ->assertJsonPath('meta.lastPage', 2)
            ->assertJsonPath('data.0.slug', $older->slug);

        // The page size is capped.
        $this->getJson('/api/blog/posts?perPage=5000')->assertJsonPath('meta.perPage', 100);
    }

    public function test_a_post_is_found_by_slug_but_drafts_and_scheduled_posts_are_not(): void
    {
        $live = Post::factory()->published()->create(['content' => "Hello there.\n\n## Part\n\nMore text."]);
        $draft = Post::factory()->create();
        $scheduled = Post::factory()->scheduled('2026-10-14 13:00:00')->create();

        $this->getJson("/api/blog/posts/{$live->slug}")
            ->assertOk()
            ->assertJsonPath('data.slug', $live->slug)
            ->assertJsonPath('data.content', "Hello there.\n\n## Part\n\nMore text.")
            ->assertJsonPath('data.metaDescription', 'Hello there.');

        $this->getJson("/api/blog/posts/{$draft->slug}")->assertNotFound();
        $this->getJson("/api/blog/posts/{$scheduled->slug}")->assertNotFound();
        $this->getJson('/api/blog/posts/no-such-post')->assertNotFound();

        // When its time comes, the scheduled post is there.
        $this->travelTo('2026-10-14 13:00:01');
        $this->getJson("/api/blog/posts/{$scheduled->slug}")->assertOk();
    }

    public function test_renaming_a_live_post_keeps_its_old_address_as_a_301(): void
    {
        $post = Post::factory()->published()->create(['slug' => 'first-name']);

        $post->update(['slug' => 'second-name']);
        $post->update(['slug' => 'third-name']);

        // Both old addresses lead straight to the current one, no chain.
        foreach (['first-name', 'second-name'] as $old) {
            $this->getJson("/api/blog/posts/{$old}")
                ->assertStatus(301)
                ->assertHeader('Location', url('/api/blog/posts/third-name'))
                ->assertExactJson(['slug' => 'third-name']);
        }
        $this->getJson('/api/blog/posts/third-name')->assertOk();

        // Taking an old name back: it is the post's address again, not a redirect.
        $post->update(['slug' => 'first-name']);
        $this->getJson('/api/blog/posts/first-name')->assertOk();
        $this->getJson('/api/blog/posts/third-name')->assertStatus(301)->assertJsonPath('slug', 'first-name');
        $this->assertSame(['second-name', 'third-name'], PostSlugRedirect::orderBy('old_slug')->pluck('old_slug')->all());
    }

    public function test_renaming_a_draft_leaves_no_redirect(): void
    {
        $post = Post::factory()->create(['slug' => 'draft-name']);
        $post->update(['slug' => 'final-name', 'status' => PostStatus::Published, 'published_at' => now()]);

        $this->getJson('/api/blog/posts/draft-name')->assertNotFound();
        $this->assertDatabaseCount('post_slug_redirects', 0);
    }

    public function test_an_old_address_of_a_post_taken_off_the_site_is_not_found(): void
    {
        $post = Post::factory()->published()->create(['slug' => 'old-name']);
        $post->update(['slug' => 'new-name']);
        $post->update(['status' => PostStatus::Draft]);

        $this->getJson('/api/blog/posts/old-name')->assertNotFound();
        $this->getJson('/api/blog/posts/new-name')->assertNotFound();
    }

    public function test_a_draft_is_shown_through_its_signed_preview_link_only(): void
    {
        $draft = Post::factory()->create(['title' => 'Secret draft']);
        parse_str((string) parse_url($draft->previewUrl(), PHP_URL_QUERY), $query);
        $this->assertStringStartsWith(config('rental.frontend_url').'/blog/preview?post=', $draft->previewUrl());

        $path = "/api/blog/preview/{$draft->id}?expires={$query['expires']}&signature={$query['signature']}";
        $this->getJson($path)->assertOk()->assertJsonPath('data.title', 'Secret draft')->assertJsonPath('state', 'draft');

        $this->getJson("/api/blog/preview/{$draft->id}")->assertForbidden();
        $this->getJson("/api/blog/preview/{$draft->id}?expires={$query['expires']}&signature=0{$query['signature']}")->assertForbidden();
        // Someone else's id with this signature.
        $other = Post::factory()->create();
        $this->getJson("/api/blog/preview/{$other->id}?expires={$query['expires']}&signature={$query['signature']}")->assertForbidden();

        $this->travel(config('blog.preview_link_days') + 1)->days();
        $this->getJson($path)->assertForbidden();
    }

    public function test_saving_fills_the_slug_reading_time_and_excerpt(): void
    {
        $words = implode(' ', array_fill(0, 660, 'word'));
        $first = Post::factory()->create(['title' => 'Prom Night in a Hellcat!', 'slug' => null, 'excerpt' => null, 'content' => "The **best** [ride](https://example.com) for prom.\n\n".$words]);
        $second = Post::factory()->create(['title' => 'Prom night in a Hellcat', 'slug' => null]);
        $reserved = Post::factory()->create(['title' => 'Page', 'slug' => null]);

        $this->assertSame('prom-night-in-a-hellcat', $first->slug);
        $this->assertSame('prom-night-in-a-hellcat-2', $second->slug);
        $this->assertSame('page-post', $reserved->slug);
        $this->assertSame(4, $first->reading_time); // 665 words at 220 a minute
        $this->assertSame('The best ride for prom.', $first->excerpt);
    }

    public function test_the_cover_comes_with_its_size_and_copies_are_on_the_public_disk(): void
    {
        $post = Post::factory()->published()->create(['cover_image' => 'blog/covers/abc_1600x900.webp', 'cover_alt' => '']);

        $this->getJson("/api/blog/posts/{$post->slug}")
            ->assertJsonPath('data.cover.url', url('/storage/blog/covers/abc_1600x900.webp'))
            ->assertJsonPath('data.cover.width', 1600)
            ->assertJsonPath('data.cover.height', 900)
            // No description: the title stands in.
            ->assertJsonPath('data.cover.alt', $post->title);
    }

    public function test_the_blog_has_its_own_rate_limit(): void
    {
        config(['rental.rate_limits.blog_per_minute' => 2]);

        $this->getJson('/api/blog/posts')->assertOk();
        $this->getJson('/api/blog/posts')->assertOk();
        $this->getJson('/api/blog/posts')->assertTooManyRequests();
        // The rest of the API is not affected.
        $this->getJson('/api/settings')->assertOk();
    }

    public function test_preview_route_name_is_signed_relative(): void
    {
        // The website calls the API at another host name than the one in APP_URL (inside
        // Docker), so the signature must not depend on it.
        $draft = Post::factory()->create();
        $signed = URL::temporarySignedRoute('blog.preview', now()->addDay(), ['post' => $draft->id], absolute: false);

        $this->getJson('http://backend'.$signed)->assertOk();
    }
}
