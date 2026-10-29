<?php

namespace Database\Factories;

use App\Enums\PostStatus;
use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => rtrim(fake()->unique()->sentence(5), '.'),
            'content' => "Opening paragraph about renting the car.\n\n## First part\n\n".fake()->paragraphs(3, true)."\n\n## Second part\n\n".fake()->paragraphs(2, true),
            'status' => PostStatus::Draft,
        ];
    }

    public function published(?string $at = null): static
    {
        return $this->state(fn () => [
            'status' => PostStatus::Published,
            'published_at' => $at ?? now()->subDay(),
        ]);
    }

    public function scheduled(?string $at = null): static
    {
        return $this->state(fn () => [
            'status' => PostStatus::Published,
            'published_at' => $at ?? now()->addDays(2),
        ]);
    }
}
