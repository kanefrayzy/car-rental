import { getImageProps } from "next/image";

type Source = {
  src: string;
  width: number;
  height: number;
  /** `sizes` for this source. */
  sizes: string;
};

type ArtImageProps = {
  mobile: Source;
  /** Optional crop for 48rem-80rem (tablets, small laptops). */
  tablet?: Source;
  /** Optional crop from 80rem up; without it the mobile source serves every width. */
  desktop?: Source;
  alt: string;
  /** Load eagerly with high priority (above-the-fold images only). */
  priority?: boolean;
  className?: string;
};

// scripts/images.mjs writes an AVIF twin of every prepared width (same name, .avif).
const avif = (srcSet = "") => srcSet.replace(/\.webp(?= )/g, ".avif");

/**
 * A next/image `fill` image (the parent sets the box) offered as AVIF first, then WebP. For
 * site images prepared by scripts/images.mjs only: other files have no AVIF twin.
 */
export function FillPicture({
  src,
  alt,
  sizes,
  className,
  draggable,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  draggable?: boolean;
}) {
  const { props } = getImageProps({ src, alt, sizes, fill: true });
  return (
    <picture>
      <source type="image/avif" srcSet={avif(props.srcSet)} sizes={sizes} />
      <img {...props} alt={alt} draggable={draggable} className={className} />
    </picture>
  );
}

// Art direction: a different crop per layout tier. The xl breakpoint (80rem) is where the
// two mockup layouts switch; md (48rem) is the in-between tier. Only the matching source
// is downloaded, as AVIF where the browser takes it and WebP otherwise.
export function ArtImage({
  mobile,
  tablet,
  desktop,
  alt,
  priority = false,
  className,
}: ArtImageProps) {
  const {
    props: { srcSet: mobileSrcSet, ...img },
  } = getImageProps({ ...mobile, alt });
  const tiers = [
    desktop && { media: "(width >= 80rem)", source: desktop },
    tablet && { media: "(width >= 48rem)", source: tablet },
  ]
    .filter((tier) => !!tier)
    .map(({ media, source }) => ({ media, sizes: source.sizes, srcSet: getImageProps({ ...source, alt }).props.srcSet }));

  return (
    <picture>
      {tiers.map((tier) => (
        <source key={`${tier.media}-avif`} type="image/avif" media={tier.media} srcSet={avif(tier.srcSet)} sizes={tier.sizes} />
      ))}
      {tiers.map((tier) => (
        <source key={tier.media} type="image/webp" media={tier.media} srcSet={tier.srcSet} sizes={tier.sizes} />
      ))}
      <source type="image/avif" srcSet={avif(mobileSrcSet)} sizes={mobile.sizes} />
      <source type="image/webp" srcSet={mobileSrcSet} sizes={mobile.sizes} />
      <img
        {...img}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
