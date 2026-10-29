<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** The website hears about every change it shows, and only about those. */
class BlogRevalidationTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'http://frontend:3000/internal/revalidate';

    /** What the website answers; a test that needs it down sets 502. */
    private int $websiteStatus = 200;

    protected function setUp(): void
    {
        parent::setUp();

        config(['blog.revalidate_url' => self::URL, 'blog.revalidate_secret' => 'test-secret']);
        Http::fake(fn () => Http::response(['revalidated' => true], $this->websiteStatus));
    }

    private function assertToldTheWebsite(int $times, ?array $slugs = null): void
    {
        Http::assertSentCount($times);
        if ($times > 0) {
            Http::assertSent(fn (Request $request) => $request->url() === self::URL
                && $request->method() === 'POST'
                && $request->hasHeader('Authorization', 'Bearer test-secret')
                && $request['tags'] === ['blog']
                && ($slugs === null || $request['slugs'] === $slugs));
        }
    }

    public function test_publishing_tells_the_website(): void
    {
        $post = Post::factory()->create(['slug' => 'new-post']);
        $this->assertToldTheWebsite(0);

        $post->update(['status' => PostStatus::Published, 'published_at' => now()]);

        $this->assertToldTheWebsite(1, ['new-post']);
    }

    public function test_editing_a_draft_does_not_but_editing_a_live_post_does(): void
    {
        $draft = Post::factory()->create();
        $draft->update(['title' => 'Still a draft']);
        $this->assertToldTheWebsite(0);

        $live = Post::factory()->published()->create(['slug' => 'live-post']);
        $live->update(['title' => 'A better title']);
        // Saved with no change: nothing to tell.
        $live->save();

        $this->assertToldTheWebsite(2);
    }

    public function test_a_rename_sends_both_addresses_and_deleting_a_live_post_tells_it_too(): void
    {
        $post = Post::factory()->published()->create(['slug' => 'old-name']);
        $post->update(['slug' => 'new-name']);
        Http::assertSent(fn (Request $request) => $request['slugs'] === ['old-name', 'new-name']);

        $post->delete();
        Http::assertSent(fn (Request $request) => $request['slugs'] === ['new-name']);
        $this->assertToldTheWebsite(3);
    }

    public function test_unpublishing_tells_the_website_and_deleting_a_draft_does_not(): void
    {
        $post = Post::factory()->published()->create();
        $post->update(['status' => PostStatus::Draft]);
        $this->assertToldTheWebsite(2);

        $post->delete();
        $this->assertToldTheWebsite(2);
    }

    public function test_a_scheduled_post_is_announced_when_its_time_comes_without_changing_its_dates(): void
    {
        $post = Post::factory()->scheduled('2026-10-14 13:00:00')->create();
        $this->assertToldTheWebsite(0);

        $this->artisan('blog:revalidate-due')->assertSuccessful();
        $this->assertToldTheWebsite(0);

        $updatedAt = $post->updated_at->toIso8601String();
        $this->travelTo('2026-10-14 13:00:30');
        $this->artisan('blog:revalidate-due')->assertSuccessful();
        $this->assertToldTheWebsite(1, [$post->slug]);
        $this->assertNotNull($post->fresh()->revalidated_at);
        $this->assertSame($updatedAt, $post->fresh()->updated_at->toIso8601String());

        // Once is enough.
        $this->artisan('blog:revalidate-due')->assertSuccessful();
        $this->assertToldTheWebsite(1);
    }

    public function test_a_post_published_from_the_panel_is_not_announced_twice(): void
    {
        Post::factory()->published()->create();
        $this->artisan('blog:revalidate-due')->assertSuccessful();

        $this->assertToldTheWebsite(1);
    }

    public function test_the_website_being_down_never_stops_a_save(): void
    {
        $this->websiteStatus = 502;

        $post = Post::factory()->published()->create(['title' => 'Saved anyway']);

        $this->assertDatabaseHas('posts', ['id' => $post->id, 'title' => 'Saved anyway']);
        Http::assertSentCount(1);

        // The due-check retries later: a failed call is not stamped.
        Post::query()->whereKey($post->id)->toBase()->update(['revalidated_at' => null]);
        $this->artisan('blog:revalidate-due')->assertSuccessful();
        $this->assertNull($post->fresh()->revalidated_at);
    }

    public function test_the_secret_is_required_and_nothing_is_sent_without_a_url(): void
    {
        config(['blog.revalidate_url' => null]);
        Post::factory()->published()->create();
        $this->artisan('blog:revalidate')->assertFailed();

        Http::assertNothingSent();
    }

    public function test_the_manual_command_refreshes_everything(): void
    {
        $this->artisan('blog:revalidate')->assertSuccessful();

        $this->assertToldTheWebsite(1, []);
    }
}
