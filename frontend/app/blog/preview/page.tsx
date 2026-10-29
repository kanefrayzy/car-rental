import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PostArticle } from "@/components/blog/PostArticle";
import { getAllPosts, getPreview } from "@/lib/blog";

// A draft as the site will show it, through the signed link from the admin panel's Preview
// button. Never in search results, never cached.
export const metadata: Metadata = {
  title: { absolute: "Post preview" },
  robots: { index: false, follow: false, nocache: true },
};

const labels = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

async function Preview({ searchParams }: { searchParams: PageProps<"/blog/preview">["searchParams"] }) {
  const query = await searchParams;
  const read = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const preview = await getPreview({ post: read("post"), expires: read("expires"), signature: read("signature") });

  if (!preview) {
    return (
      <main id="top" className="container-site flex-1 py-16 xl:py-24">
        <h1 className="text-title font-bold">This preview link has expired</h1>
        <p className="mt-3 max-w-[36rem] text-[0.9375rem] leading-relaxed text-muted">
          Preview links work for a week. Open the post in the admin panel and press Preview again for a new one.
        </p>
        <Link href="/blog" className="mt-6 inline-block text-sm font-medium text-brand-deep hover:underline">
          Go to the blog
        </Link>
      </main>
    );
  }

  const related = (await getAllPosts()).filter((item) => item.slug !== preview.data.slug).slice(0, 3);
  const notice = (
    <p role="status" className="bg-warning px-[var(--gutter)] py-2.5 text-center text-sm font-medium text-white">
      Preview: {labels[preview.state]}. {preview.state === "published" ? "This is the saved version." : "Not on the website yet; only this link shows it."}
    </p>
  );

  return <PostArticle post={preview.data} related={related} notice={notice} />;
}

export default function BlogPreviewPage(props: PageProps<"/blog/preview">) {
  return (
    <Suspense fallback={<main id="top" className="flex-1" />}>
      <Preview searchParams={props.searchParams} />
    </Suspense>
  );
}
