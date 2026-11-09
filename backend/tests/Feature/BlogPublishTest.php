<?php

namespace Tests\Feature;

use App\Jobs\RevalidateBlog;
use App\Models\Post;
use App\Services\BlogCoverPool;
use App\Services\BlogImages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** POST /api/blog/publish: what the scheduled blog agent may and may not do. */
class BlogPublishTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-publish-token';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Queue::fake();
        config(['blog.publish.token' => self::TOKEN]);
    }

    /** A post that passes every check. */
    private function article(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Winter Drives on Long Island',
            'slug' => 'winter-drives-long-island',
            'excerpt' => 'Five routes for a cold, clear day, with the miles for each.',
            'content' => "Intro paragraph.\n\n## First route\n\n".str_repeat('Some useful words about the route. ', 90),
            'meta_title' => 'Winter Drives on Long Island | Bueno Exotics',
            'meta_description' => 'Five winter routes from Patchogue with the round-trip miles for each.',
        ], $overrides);
    }

    private function publish(array $data, ?string $token = self::TOKEN): TestResponse
    {
        return $this->withToken((string) $token)->postJson('/api/blog/publish', $data);
    }

    public function test_it_publishes_a_live_post_with_a_cover_from_the_pool(): void
    {
        $response = $this->publish($this->article())->assertCreated();

        $post = Post::sole();
        $this->assertTrue($post->isLive());
        $this->assertSame('api', $post->origin);
        $this->assertSame('winter-drives-long-island', $post->slug);
        $this->assertContains($post->cover_source, BlogCoverPool::keys());
        $this->assertSame(BlogCoverPool::alt($post->cover_source), $post->cover_alt);
        Storage::disk('public')->assertExists($post->cover_image);
        $this->assertStringStartsWith(BlogImages::COVERS.'/', $post->cover_image);
        $response->assertJson(['slug' => $post->slug, 'cover' => $post->cover_source]);
        $this->assertStringEndsWith('/blog/winter-drives-long-island', $response->json('url'));

        // The website hears about it at once.
        Queue::assertPushed(RevalidateBlog::class);

        // It shows up in the public API.
        $this->getJson('/api/blog/posts')->assertJsonPath('data.0.slug', 'winter-drives-long-island');
    }

    public function test_it_needs_the_token_and_does_not_exist_without_one(): void
    {
        $this->publish($this->article(), null)->assertUnauthorized();
        $this->publish($this->article(), 'wrong-token')->assertUnauthorized();

        config(['blog.publish.token' => '']);
        $this->publish($this->article(), '')->assertNotFound();

        $this->assertSame(0, Post::count());
    }

    public function test_it_checks_lengths_and_short_posts(): void
    {
        $this->publish($this->article([
            'meta_title' => str_repeat('a', 61),
            'meta_description' => str_repeat('a', 161),
            'excerpt' => str_repeat('a', 161),
            'content' => 'Too short.',
            'slug' => 'Not A Slug',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['meta_title', 'meta_description', 'excerpt', 'content', 'slug']);

        $this->publish($this->article(['slug' => 'rss']))->assertJsonValidationErrors('slug');
        $this->assertSame(0, Post::count());
    }

    public function test_banned_words_are_refused_in_any_field(): void
    {
        $this->publish($this->article(['title' => 'A day in a HELLCAT']))->assertJsonValidationErrors('title');
        $this->publish($this->article(['content' => $this->article()['content'].' The Hellcat engine.']))->assertJsonValidationErrors('content');

        $this->assertSame(0, Post::count());
    }

    public function test_a_taken_slug_is_refused_and_the_title_makes_one_when_missing(): void
    {
        Post::factory()->published()->create(['slug' => 'winter-drives-long-island']);

        $this->publish($this->article())->assertStatus(409)->assertJson(['slug' => 'winter-drives-long-island']);

        $this->publish($this->article(['slug' => null, 'title' => 'Fall Colors by Car']))->assertCreated()->assertJson(['slug' => 'fall-colors-by-car']);
    }

    public function test_a_second_post_within_twelve_hours_is_refused(): void
    {
        $this->publish($this->article())->assertCreated();
        $this->publish($this->article(['slug' => 'another-post']))->assertStatus(429);

        $this->travel(13)->hours();
        $this->publish($this->article(['slug' => 'another-post']))->assertCreated();
    }

    public function test_a_post_written_by_hand_does_not_block_the_agent(): void
    {
        Post::factory()->published()->create();

        $this->publish($this->article())->assertCreated();
    }

    public function test_an_opening_h1_is_dropped(): void
    {
        $this->publish($this->article(['content' => "# Winter Drives on Long Island\n\n".$this->article()['content']]))->assertCreated();

        $this->assertStringStartsWith('Intro paragraph.', Post::sole()->content);
    }

    public function test_covers_rotate_and_never_repeat_the_newest_view(): void
    {
        $views = [];
        for ($i = 0; $i < 6; $i++) {
            $this->publish($this->article(['slug' => "post-{$i}"]))->assertCreated();
            $views[] = BlogCoverPool::view(Post::query()->newestFirst()->value('cover_source'));
            $this->travel(13)->hours();
        }

        for ($i = 1; $i < count($views); $i++) {
            $this->assertNotSame($views[$i - 1], $views[$i], 'Two posts in a row with the same view: '.implode(', ', $views));
        }
        $this->assertCount(6, Post::pluck('cover_source')->unique());
    }

    public function test_the_least_recently_used_cover_comes_first(): void
    {
        $keys = BlogCoverPool::keys();
        // Every picture but one used, the newest post a detail shot.
        foreach ($keys as $i => $key) {
            if ($key !== 'side-wheels') {
                Post::factory()->published()->create(['cover_source' => $key, 'published_at' => now()->subDays(100 - $i)]);
            }
        }
        Post::factory()->published()->create(['cover_source' => 'hood-headlight', 'published_at' => now()]);

        $this->assertSame('side-wheels', BlogCoverPool::pick());
    }

    public function test_changing_the_cover_by_hand_forgets_the_pool_picture(): void
    {
        $post = Post::factory()->published()->create(['cover_source' => 'rear-sunset', 'cover_image' => 'blog/covers/a_960x540.webp']);

        $post->update(['cover_image' => 'blog/covers/b_960x540.webp']);

        $this->assertNull($post->fresh()->cover_source);
    }

    public function test_every_pool_cover_exists_and_has_a_view_and_alt(): void
    {
        foreach (config('blog.cover_pool') as $key => $cover) {
            $this->assertFileExists(BlogCoverPool::path($key));
            $this->assertContains($cover['view'], ['front', 'rear', 'side', 'interior', 'detail'], $key);
            $this->assertNotEmpty($cover['alt'], $key);
            $this->assertLessThanOrEqual(config('blog.limits.cover_alt'), mb_strlen($cover['alt']), $key);
        }
    }
}
