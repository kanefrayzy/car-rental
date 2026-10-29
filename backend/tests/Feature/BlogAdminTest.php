<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Filament\Resources\Posts\Pages\CreatePost;
use App\Filament\Resources\Posts\Pages\EditPost;
use App\Filament\Resources\Posts\Pages\ListPosts;
use App\Models\Post;
use App\Models\User;
use App\Services\BlogImages;
use Filament\Actions\DeleteAction;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Livewire\Livewire;
use Mockery;
use RuntimeException;
use Tests\TestCase;

/** The Blog section of the admin panel, and the pictures it stores. */
class BlogAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Http::fake();
        Filament::setCurrentPanel('admin');
        $this->actingAs(User::factory()->create());
    }

    /** One of the buttons under the editor (Save draft, Publish, Schedule, Save changes). */
    private static function button(string $name): TestAction
    {
        return TestAction::make($name)->schemaComponent('form-actions', schema: 'content');
    }

    public function test_the_blog_pages_need_a_sign_in_and_open_for_the_owner(): void
    {
        $post = Post::factory()->published()->create(['title' => 'Wedding cars on Long Island']);

        $this->get('/be/posts')->assertOk()->assertSee('Wedding cars on Long Island')->assertSee('Published');
        $this->get('/be/posts/create')->assertOk()->assertSee('Save draft')->assertSee('Schedule');
        $this->get("/be/posts/{$post->id}/edit")->assertOk()->assertSee('Google preview')->assertSee('Move to drafts');

        auth()->logout();
        $this->get('/be/posts')->assertRedirect('/be/login');
    }

    public function test_a_pasted_article_is_published_with_its_title_taken_from_the_first_line(): void
    {
        $markdown = "# Renting a Hellcat for Prom: A Parent’s Guide\n\nProm night is a big deal.\n\n## What to ask\n\nAsk about the deposit.\n\n| Item | Price |\n|---|---|\n| Day | \$499 |";

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => '', 'content' => $markdown])
            ->callAction(self::button('publish'))
            ->assertHasNoFormErrors()
            ->assertNotified('Published: the post is on the website');

        $post = Post::sole();
        $this->assertSame('Renting a Hellcat for Prom: A Parent’s Guide', $post->title);
        $this->assertSame('renting-a-hellcat-for-prom-a-parents-guide', $post->slug);
        $this->assertStringStartsWith('Prom night is a big deal.', $post->content);
        $this->assertSame('Prom night is a big deal.', $post->excerpt);
        $this->assertTrue($post->isLive());
        $this->getJson("/api/blog/posts/{$post->slug}")->assertOk();
    }

    public function test_save_draft_keeps_it_off_the_site_and_schedule_sets_the_time(): void
    {
        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'Birthday surprise ideas', 'content' => 'Text of the post.'])
            ->callAction(self::button('saveDraft'))
            ->assertHasNoFormErrors();

        $post = Post::sole();
        $this->assertSame(PostStatus::Draft, $post->status);
        $this->assertNull($post->published_at);
        $this->getJson("/api/blog/posts/{$post->slug}")->assertNotFound();

        // New York time in the picker: 9:00 AM on Oct 20 is 13:00 UTC.
        Livewire::test(EditPost::class, ['record' => $post->id])
            ->callAction(self::button('schedule'), ['published_at' => '2026-10-20 09:00:00'])
            ->assertHasNoFormErrors()
            ->assertHasNoActionErrors();

        $post->refresh();
        $this->assertSame('scheduled', $post->state());
        $this->assertSame('2026-10-20 13:00:00', $post->published_at->format('Y-m-d H:i:s'));
        $this->getJson("/api/blog/posts/{$post->slug}")->assertNotFound();

        // A time already past is refused.
        Livewire::test(EditPost::class, ['record' => $post->id])
            ->callAction(self::button('schedule'), ['published_at' => '2026-10-13 08:00:00'])
            ->assertHasActionErrors(['published_at']);
        $this->assertSame('2026-10-20 13:00:00', $post->fresh()->published_at->format('Y-m-d H:i:s'));

        // Publish now, then back to drafts.
        Livewire::test(EditPost::class, ['record' => $post->id])->callAction(self::button('publish'));
        $this->assertTrue($post->fresh()->isLive());
        Livewire::test(EditPost::class, ['record' => $post->id])->callAction(self::button('saveDraft'));
        $this->assertSame(PostStatus::Draft, $post->fresh()->status);
        $this->getJson("/api/blog/posts/{$post->slug}")->assertNotFound();
    }

    public function test_publishing_again_keeps_the_first_publish_date(): void
    {
        $post = Post::factory()->create(['status' => PostStatus::Draft, 'published_at' => '2026-10-01 12:00:00']);

        Livewire::test(EditPost::class, ['record' => $post->id])->callAction(self::button('publish'));

        $this->assertSame('2026-10-01 12:00:00', $post->fresh()->published_at->format('Y-m-d H:i:s'));
    }

    public function test_the_fields_are_checked(): void
    {
        Post::factory()->create(['slug' => 'taken']);

        Livewire::test(CreatePost::class)
            ->fillForm([
                'title' => 'Fine title',
                'slug' => 'Not A Slug!',
                'excerpt' => str_repeat('a', 161),
                'meta_title' => str_repeat('t', 61),
                'meta_description' => str_repeat('d', 161),
                'content' => '',
            ])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['slug' => 'regex', 'excerpt' => 'max', 'meta_title' => 'max', 'meta_description' => 'max', 'content' => 'required']);

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => '', 'content' => 'No heading here.'])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['title' => 'required']);

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'x', 'slug' => 'taken', 'content' => 'Text.'])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['slug']);

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'x', 'slug' => 'preview', 'content' => 'Text.'])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['slug']);

        $this->assertSame(1, Post::count());
    }

    public function test_the_old_address_of_another_post_cannot_be_reused(): void
    {
        $post = Post::factory()->published()->create(['slug' => 'old-name']);
        $post->update(['slug' => 'new-name']);

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'x', 'slug' => 'old-name', 'content' => 'Text.'])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['slug']);

        // The post itself may take it back.
        Livewire::test(EditPost::class, ['record' => $post->id])
            ->fillForm(['slug' => 'old-name'])
            ->callAction(self::button('saveKeep'))
            ->assertHasNoFormErrors();
        $this->assertSame('old-name', $post->fresh()->slug);
    }

    public function test_a_cover_is_stored_as_webp_with_smaller_copies(): void
    {
        Livewire::test(CreatePost::class)
            ->fillForm([
                'title' => 'Cover test',
                'content' => 'Text.',
                'cover_image' => UploadedFile::fake()->image('cover.jpg', 2400, 1350),
                'cover_alt' => 'The car at sunset',
            ])
            ->callAction(self::button('saveDraft'))
            ->assertHasNoFormErrors();

        $path = Post::sole()->cover_image;
        $this->assertMatchesRegularExpression('#^blog/covers/[a-z0-9]{24}_1600x900\.webp$#', $path);
        $base = substr($path, 0, -5);
        foreach (["{$base}.webp", "{$base}-480.webp", "{$base}-800.webp", "{$base}-1200.webp"] as $file) {
            Storage::disk('public')->assertExists($file);
        }
        $this->assertSame('image/webp', getimagesizefromstring(Storage::disk('public')->get($path))['mime']);
        $this->assertSame([800, 450], array_slice(getimagesizefromstring(Storage::disk('public')->get("{$base}-800.webp")), 0, 2));
    }

    public function test_a_cover_must_be_a_big_enough_picture(): void
    {
        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'x', 'content' => 'Text.', 'cover_image' => UploadedFile::fake()->image('small.jpg', 800, 450)])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['cover_image']);

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'x', 'content' => 'Text.', 'cover_image' => UploadedFile::fake()->create('cover.pdf', 100, 'application/pdf')])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['cover_image']);

        Livewire::test(CreatePost::class)
            ->fillForm(['title' => 'x', 'content' => 'Text.', 'cover_image' => UploadedFile::fake()->image('huge.jpg', 1600, 900)->size(9000)])
            ->callAction(self::button('saveDraft'))
            ->assertHasFormErrors(['cover_image']);

        $this->assertSame(0, Post::count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_replacing_and_deleting_a_post_removes_its_cover_files(): void
    {
        // Kept in variables: a fake file is deleted as soon as nothing holds it.
        [$a, $b] = [UploadedFile::fake()->image('a.jpg', 1300, 800), UploadedFile::fake()->image('b.jpg', 1300, 800)];
        $first = BlogImages::store($a->getRealPath(), BlogImages::COVERS);
        $post = Post::factory()->published()->create(['cover_image' => $first]);
        $second = BlogImages::store($b->getRealPath(), BlogImages::COVERS);

        $post->update(['cover_image' => $second]);
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertMissing(str_replace('.webp', '-1200.webp', $first));
        Storage::disk('public')->assertExists($second);

        Livewire::test(EditPost::class, ['record' => $post->id])->callAction(DeleteAction::class);

        $this->assertModelMissing($post);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_the_list_deletes_with_a_confirmation_and_filters_by_status(): void
    {
        $live = Post::factory()->published()->create();
        $draft = Post::factory()->create();
        $scheduled = Post::factory()->scheduled()->create();

        Livewire::test(ListPosts::class)
            ->assertCanSeeTableRecords([$live, $draft, $scheduled])
            ->filterTable('state', 'scheduled')
            ->assertCanSeeTableRecords([$scheduled])
            ->assertCanNotSeeTableRecords([$live, $draft]);

        Livewire::test(ListPosts::class)
            ->assertTableActionExists(DeleteAction::class, fn (DeleteAction $action) => $action->isConfirmationRequired(), $draft)
            ->callTableAction(DeleteAction::class, $draft);
        $this->assertModelMissing($draft);

        Livewire::test(ListPosts::class)->callTableBulkAction('delete', [$live, $scheduled]);
        $this->assertSame(0, Post::count());
    }

    public function test_pictures_inside_a_post_are_uploaded_and_get_a_markdown_url(): void
    {
        $component = Livewire::test(CreatePost::class)
            ->set('componentFileAttachments.data.content', UploadedFile::fake()->image('inside.png', 1000, 600));

        $url = $component->instance()->getSchema('form')->getFlatFields(withHidden: true)['content']->saveUploadedFileAttachmentAndGetUrl();

        $this->assertMatchesRegularExpression('#/storage/blog/images/[a-z0-9]{24}_1000x600\.webp$#', $url);
        // The picture and its 480 and 800 px copies (it is narrower than 1,200).
        $this->assertCount(3, Storage::disk('public')->allFiles('blog/images'));
    }

    public function test_pictures_are_checked_by_content_not_by_name(): void
    {
        $fake = UploadedFile::fake()->createWithContent('photo.jpg', '<?php echo "hi";');

        $this->expectException(InvalidArgumentException::class);
        BlogImages::store($fake->getRealPath(), BlogImages::CONTENT);
    }

    public function test_a_picture_that_cannot_be_written_is_refused_and_not_half_saved(): void
    {
        // The public disk reports a failed write with false, not an exception (2026-10-21: a
        // folder made by root left a post pointing at a cover that was never written).
        $file = UploadedFile::fake()->image('a.jpg', 1300, 800);
        $disk = Mockery::mock(Filesystem::class);
        $disk->shouldReceive('put')->andReturn(true, false);
        $disk->shouldReceive('delete')->once();
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);

        $this->expectException(RuntimeException::class);
        BlogImages::store($file->getRealPath(), BlogImages::COVERS);
    }

    public function test_a_transparent_png_keeps_its_transparency(): void
    {
        $image = imagecreatetruecolor(600, 300);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
        $file = tempnam(sys_get_temp_dir(), 'png');
        imagepng($image, $file);

        $path = BlogImages::store($file, BlogImages::CONTENT);
        $stored = imagecreatefromstring(Storage::disk('public')->get($path));

        $this->assertSame(127, imagecolorsforindex($stored, imagecolorat($stored, 10, 10))['alpha']);
        $this->assertSame(['width' => 600, 'height' => 300], BlogImages::size($path));
        unlink($file);
    }
}
