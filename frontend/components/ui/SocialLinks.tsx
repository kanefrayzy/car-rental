import type { SVGProps } from "react";
import { InstagramIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { socialLinks } from "@/lib/seo";

// Here rather than in icons.tsx: that file is also bundled for client components, and these
// two are only drawn on the server (2026-10-23).
function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.600 3c.300 2.300 1.700 3.900 4 4.100v3.200c-1.500.100-2.900-.400-4-1.200v6.300c0 3.300-2.500 5.600-5.600 5.600S5.400 18.700 5.400 15.600c0-3.200 2.700-5.700 6.100-5.400v3.300c-1.400-.300-2.800.600-2.800 2.100 0 1.200 1 2.200 2.300 2.200 1.400 0 2.300-1 2.300-2.500V3h3.300Z" />
    </svg>
  );
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M13.400 21v-7.900h2.700l.400-3.100h-3.100V8c0-.900.300-1.500 1.600-1.500h1.700V3.700c-.300 0-1.300-.100-2.400-.100-2.400 0-4 1.400-4 4.100V10H7.600v3.100h2.700V21h3.100Z" />
    </svg>
  );
}

const icons = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
};

/**
 * Round icon links to the social profiles set in config (site.social), for the footer and
 * "Follow us" on /contact. Nothing renders when none is set.
 */
export function SocialLinks({ className = "" }: { className?: string }) {
  if (!socialLinks.length) return null;
  return (
    <ul className={`flex items-center gap-2.5 ${className}`}>
      {socialLinks.map(({ network, label, url }) => {
        const NetworkIcon = icons[network];
        return (
          <li key={network}>
            <a
              href={url}
              target="_blank"
              rel="noopener"
              aria-label={`${site.name} on ${label}`}
              title={label}
              className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-card text-ink transition-[color,border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-brand-deep hover:text-brand-deep motion-reduce:hover:translate-y-0"
            >
              <NetworkIcon className="text-[1.25rem]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
