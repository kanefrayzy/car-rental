import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactPanel } from "./ContactPanel";

// Not in the mockups (user, 2026-10-16): the same form and cards as the /contact page, so a
// visitor can ask from the home page without leaving it. Messages go to site.email with
// Reply-To set to the visitor.
export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="container-site pt-10 pb-10 xl:pt-8 xl:pb-12">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
        <div>
          <SectionHeading id="contact-title">Contact</SectionHeading>
          <p className="mt-2 max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted">
            Ask about dates, delivery or a quote for your occasion. We answer by email; call or text for a quick
            reply.
          </p>
        </div>
        <Link
          href="/contact"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline"
        >
          Contact page
          <ArrowRightIcon />
        </Link>
      </div>
      <div className="mt-6">
        <ContactPanel />
      </div>
    </section>
  );
}
