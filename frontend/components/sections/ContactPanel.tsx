import type { ReactNode } from "react";
import { ClockIcon, MailIcon, MessageIcon, PhoneIcon, PinIcon, StarIcon } from "@/components/ui/icons";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { site } from "@/config/site";
import { formatTime } from "@/lib/time";
import { ContactForm } from "./ContactForm";

/**
 * The form on the left, three cards on the right: business hours, quick contact, "Follow us"
 * (user, 2026-10-16, after aaxotics.com/contact; the social icons from site.social since 2026-10-23). The /contact page and the Contact section on
 * the home page both show it, under their own h2.
 */
export function ContactPanel() {
  const { open, close } = site.booking.hours;
  const { city, state, region } = site.location;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-8">
      <div className="relative rounded-card border border-line bg-card p-5 shadow-card sm:p-7 xl:p-8">
        <ContactForm />
      </div>

      <div className="grid gap-4 sm:max-lg:grid-cols-2 xl:gap-5">
        <Card icon={<ClockIcon />} title="Business hours">
          <p className="flex items-baseline justify-between gap-4 font-medium text-ink">
            Daily
            <span>
              {formatTime(open)} – {formatTime(close)}
            </span>
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Calls, texts, pick-ups and returns, New York time.
          </p>
        </Card>

        <Card icon={<PhoneIcon />} title="Quick contact">
          <ul className="grid gap-3">
            <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <a href={site.phone.href} className="font-medium text-ink hover:text-brand-deep">
                {site.phone.display}
              </a>
              <span className="flex gap-2">
                <Chip href={site.phone.href} icon={<PhoneIcon />}>
                  Call
                </Chip>
                <Chip href={site.phone.sms} icon={<MessageIcon />}>
                  Text
                </Chip>
              </span>
            </li>
            {site.email && (
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="flex items-center gap-2.5 font-medium break-all text-ink hover:text-brand-deep"
                >
                  <MailIcon className="shrink-0 text-brand-deep" />
                  {site.email}
                </a>
              </li>
            )}
            <li className="flex items-center gap-2.5 text-ink-soft">
              <PinIcon className="shrink-0 text-brand-deep" />
              {city}, {state} · {region}
            </li>
          </ul>
        </Card>

        <Card icon={<StarIcon />} title="Follow us" className="sm:max-lg:col-span-2">
          <SocialLinks className="mb-4" />
          <a
            href={site.google.profile}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 font-medium text-ink hover:text-brand-deep"
          >
            <StarIcon className="text-lg text-brand-deep" />
            Reviews on Google
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Card>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  className = "",
  children,
}: {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-card border border-line bg-card p-5 text-sm shadow-card xl:p-6 ${className}`}>
      <h3 className="flex items-center gap-3 text-base font-bold">
        <span className="flex size-9 items-center justify-center rounded-full bg-tint text-base text-brand-deep">
          {icon}
        </span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[0.8125rem] font-medium text-brand-deep transition-colors hover:border-brand-deep hover:bg-tint/50"
    >
      <span className="text-sm">{icon}</span>
      {children}
    </a>
  );
}
