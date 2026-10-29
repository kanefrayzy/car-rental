import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Page not found | ${site.name}`,
};

export default function NotFound() {
  return (
    <>
      <main id="top" className="flex flex-1 items-center">
        <div className="container-site py-20 text-center xl:py-28">
          <p className="text-eyebrow font-semibold text-brand-deep uppercase">
            Error 404
          </p>
          <h1 className="mt-4 text-title font-bold">
            This page took a wrong turn
          </h1>
          <p className="mx-auto mt-3 max-w-[28rem] text-muted">
            The address may be mistyped, or the page has moved. Everything you
            need is on the home page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className={buttonClasses({ shape: "pill" })}>
              Back to the home page
            </Link>
            <a
              href={site.phone.href}
              className={buttonClasses({ variant: "outline", shape: "pill" })}
            >
              Call {site.phone.display}
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
