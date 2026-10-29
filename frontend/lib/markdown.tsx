import type { Element, ElementContent, Root, RootContent } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { toString } from "hast-util-to-string";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { site } from "@/config/site";
import { blogImageSize } from "@/lib/imageLoader";

/**
 * A blog post's Markdown as React, rendered on the server (the post pages are static).
 *
 * - GitHub-flavoured: tables, strikethrough, task lists, footnotes, autolinks.
 * - Raw HTML in the Markdown is dropped, and what is left is sanitized (GitHub's rules plus
 *   tel: and sms: links), so a pasted article cannot bring scripts, frames or styles.
 * - "#" headings become H2: the page's H1 is the post title. H2s get ids for the contents.
 * - Links to this site go through next/link; others open in a new tab with rel="noopener".
 * - The blog's own pictures (from the admin panel) get their size and a srcset; tables get
 *   a scrolling frame so a wide one never widens the page.
 */

export type TocEntry = { id: string; text: string };

const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), "tel", "sms"] },
};

/** "# Title" inside the text is a section, not a second page title. */
function demoteH1() {
  return (tree: Root) => {
    const visit = (node: Root | ElementContent) => {
      if (node.type === "element" && node.tagName === "h1") node.tagName = "h2";
      if ("children" in node) node.children.forEach((child) => visit(child as ElementContent));
    };
    visit(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(demoteH1)
  // After sanitizing, so the ids are ours (sanitize would prefix them with "user-content-").
  .use(rehypeSlug);

const siteHost = new URL(site.url).host;

/** "/blog/x" for links into this site (also when written as https://buenoexoticsny.com/...), else null. */
function internalPath(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.host === siteHost || url.host === `www.${siteHost}`) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Not an absolute URL (a #fragment or a relative path): left as it is.
  }
  return null;
}

function MarkdownLink({ href = "", children, ...props }: ComponentProps<"a">) {
  // The sanitizer took the address away (javascript: and the like): plain text then.
  if (!href) return <>{children}</>;
  const path = internalPath(href);
  if (path) {
    return (
      <Link href={path} {...props}>
        {children}
      </Link>
    );
  }
  if (/^(https?:)?\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener" {...props}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function MarkdownImage({ src, alt = "", title }: ComponentProps<"img">) {
  if (typeof src !== "string" || !src) return null;
  const size = blogImageSize(src);
  if (size) {
    return (
      <Image
        src={src}
        alt={alt}
        title={title}
        width={size.width}
        height={size.height}
        sizes="(width >= 48rem) 44rem, calc(100vw - 2.5rem)"
        loading="lazy"
      />
    );
  }
  // A picture from elsewhere: its size is unknown, so a plain lazy image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} title={title} loading="lazy" decoding="async" />;
}

function MarkdownTable(props: ComponentProps<"table">) {
  return (
    <div className="md-table" tabIndex={0} role="region" aria-label="Table, scrolls sideways">
      <table {...props} />
    </div>
  );
}

const components = { a: MarkdownLink, img: MarkdownImage, table: MarkdownTable };

function toReact(children: RootContent[]): ReactNode {
  return toJsxRuntime({ type: "root", children }, { Fragment, jsx, jsxs, components });
}

/** The contents (one entry per H2) and the body in two halves, split at a section near the middle. */
export function renderMarkdown(markdown: string): { toc: TocEntry[]; firstHalf: ReactNode; secondHalf: ReactNode } {
  const tree = processor.runSync(processor.parse(markdown)) as Root;
  const nodes = tree.children.filter((node) => !(node.type === "text" && !node.value.trim()));

  const isH2 = (node: RootContent): node is Element => node.type === "element" && node.tagName === "h2";
  const toc = nodes.filter(isH2).map((node) => ({ id: String(node.properties.id ?? ""), text: toString(node) }));

  // The split for the call to action in the middle: the H2 whose start is closest to half of
  // the text; with no H2 past the first block, the block boundary nearest the middle.
  const lengths = nodes.map((node) => toString(node).length);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let before = 0;
  let best = { index: -1, distance: Infinity, heading: false };
  nodes.forEach((node, index) => {
    if (index > 0) {
      const distance = Math.abs(before - total / 2);
      const heading = isH2(node);
      // A section start wins over a plain paragraph boundary unless it is much farther off.
      const score = heading ? distance : distance + total * 0.15;
      if (score < best.distance) best = { index, distance: score, heading };
    }
    before += lengths[index];
  });

  // Short posts (a few paragraphs) get the call to action at the end only.
  const split = total > 1200 && best.index > 0 ? best.index : nodes.length;

  return { toc, firstHalf: toReact(nodes.slice(0, split)), secondHalf: split < nodes.length ? toReact(nodes.slice(split)) : null };
}
