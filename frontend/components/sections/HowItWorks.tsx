import { StepGlyph } from "@/components/ui/feature-icons";
import { ChevronDownIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { stepsFor } from "@/config/content";
import { getSiteSettings } from "@/lib/catalog";

// Below xl each step is one compact row: number, icon, then title and text side by side.
// From xl up it is the desktop mockup's column: icon above the title, steps side by side.
export async function HowItWorks() {
  const steps = stepsFor((await getSiteSettings()).depositUsd);

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="container-site">
      <div className="border-b border-line pt-10 pb-1 xl:pt-9 xl:pb-9">
        <SectionHeading id="how-it-works-title">How It Works</SectionHeading>

        <ol className="mt-2 md:grid md:grid-cols-2 md:gap-x-10 xl:mt-6 xl:grid-cols-4 xl:gap-x-0">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex items-start gap-4 border-line py-5 not-last:border-b md:max-xl:nth-last-2:border-b-0 xl:gap-8 xl:border-b-0! xl:py-0 xl:pr-6 xl:pl-12 xl:not-first:border-l xl:first:pl-2"
            >
              {index > 0 && (
                <span className="absolute top-1/2 -left-px hidden -translate-x-1/2 -translate-y-1/2 bg-page py-1.5 text-xs text-muted xl:block">
                  <ChevronDownIcon className="-rotate-90" />
                </span>
              )}
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint font-display text-base font-semibold text-brand-deep xl:size-11 xl:text-xl">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 items-start gap-3.5 xl:block">
                {/* The glyph has ~12% built-in padding; the negative margins align its ink. */}
                <StepGlyph
                  name={step.icon}
                  className="-mt-0.5 shrink-0 text-[2.25rem] text-ink xl:-ml-1.5 xl:text-[2.875rem]"
                />
                <div className="min-w-0 pt-0.5 xl:pt-0">
                  {/* The line breaks in the copy are for the desktop columns only. */}
                  <h3 className="font-sans text-[0.9375rem] leading-snug font-medium text-ink xl:mt-4 xl:text-base xl:whitespace-pre-line">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[0.8125rem] leading-[1.5] text-muted xl:mt-2 xl:text-sm xl:leading-[1.6] xl:whitespace-pre-line">
                    {step.text}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
