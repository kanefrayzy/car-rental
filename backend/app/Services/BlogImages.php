<?php

namespace App\Services;

use GdImage;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

/**
 * Pictures for the blog: covers and pictures inside posts. Every upload is decoded and
 * written again as WebP, at most `blog.images.max_width` wide, with smaller copies for the
 * website's srcset. The stored name carries the size: blog/covers/k3j…_1600x900.webp, with
 * copies k3j…_1600x900-480.webp, -800 and -1200 (only those narrower than the picture).
 * frontend/lib/imageLoader.ts reads the same pattern. Change both together.
 */
class BlogImages
{
    public const COVERS = 'blog/covers';

    public const CONTENT = 'blog/images';

    public static function disk(): Filesystem
    {
        return Storage::disk('public');
    }

    /**
     * Re-encodes the picture at `$sourcePath` and returns its path on the public disk.
     *
     * @throws InvalidArgumentException when the file is not a picture GD can read.
     * @throws RuntimeException when it cannot be written to the public disk.
     */
    public static function store(string $sourcePath, string $directory): string
    {
        $data = @file_get_contents($sourcePath);
        $info = $data !== false ? @getimagesizefromstring($data) : false;
        if (! $info || ! in_array($info['mime'] ?? null, config('blog.images.types'), true)) {
            throw new InvalidArgumentException('Upload a JPG, PNG or WebP picture.');
        }

        $maxSide = config('blog.images.max_side');
        if ($info[0] > $maxSide || $info[1] > $maxSide) {
            throw new InvalidArgumentException("The picture is too large. Make it at most {$maxSide} pixels on each side.");
        }

        $image = @imagecreatefromstring($data);
        if (! $image instanceof GdImage) {
            // Animated WebP, for one, cannot be decoded by GD.
            throw new InvalidArgumentException('This picture could not be read. Save it as a JPG or PNG and try again.');
        }
        unset($data);

        imagepalettetotruecolor($image);
        $image = self::orient($image, $sourcePath, $info[2]);

        $maxWidth = config('blog.images.max_width');
        if (imagesx($image) > $maxWidth) {
            $image = self::scale($image, $maxWidth);
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $base = $directory.'/'.Str::lower(Str::random(24))."_{$width}x{$height}";

        $written = ["{$base}.webp" => self::encode($image)];
        foreach (config('blog.images.widths') as $copyWidth) {
            if ($copyWidth < $width) {
                $written["{$base}-{$copyWidth}.webp"] = self::encode(self::scale($image, $copyWidth));
            }
        }

        // The public disk does not throw on a failed write (filesystems.php), so check: a post
        // must never point at a picture that is not there.
        foreach ($written as $path => $bytes) {
            if (! self::disk()->put($path, $bytes, 'public')) {
                self::disk()->delete(array_keys($written));
                throw new RuntimeException('The picture could not be saved on the server (storage/app/public is not writable).');
            }
        }

        return "{$base}.webp";
    }

    /** Deletes a stored picture and its copies. */
    public static function delete(?string $path): void
    {
        if (blank($path) || ! ($size = self::size($path))) {
            return;
        }

        $base = Str::beforeLast($path, '.webp');
        $paths = [$path];
        foreach (config('blog.images.widths') as $copyWidth) {
            if ($copyWidth < $size['width']) {
                $paths[] = "{$base}-{$copyWidth}.webp";
            }
        }

        self::disk()->delete($paths);
    }

    /**
     * Width and height, read from the stored name.
     *
     * @return array{width: int, height: int}|null
     */
    public static function size(?string $path): ?array
    {
        if (! $path || ! preg_match('/_(\d+)x(\d+)\.webp$/', $path, $match)) {
            return null;
        }

        return ['width' => (int) $match[1], 'height' => (int) $match[2]];
    }

    public static function url(string $path): string
    {
        return self::disk()->url($path);
    }

    private static function scale(GdImage $image, int $width): GdImage
    {
        $height = max(1, (int) round(imagesy($image) * $width / imagesx($image)));
        $scaled = imagecreatetruecolor($width, $height);
        imagealphablending($scaled, false);
        imagesavealpha($scaled, true);
        imagecopyresampled($scaled, $image, 0, 0, 0, 0, $width, $height, imagesx($image), imagesy($image));

        return $scaled;
    }

    private static function encode(GdImage $image): string
    {
        imagealphablending($image, false);
        imagesavealpha($image, true);
        ob_start();
        imagewebp($image, null, config('blog.images.quality'));

        return (string) ob_get_clean();
    }

    /** Phone photos are often stored sideways with an EXIF note to turn them; turn them for real. */
    private static function orient(GdImage $image, string $sourcePath, int $type): GdImage
    {
        if ($type !== IMAGETYPE_JPEG || ! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($sourcePath);
        $orientation = (int) (is_array($exif) ? ($exif['Orientation'] ?? 1) : 1);
        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        return $rotated instanceof GdImage ? $rotated : $image;
    }
}
