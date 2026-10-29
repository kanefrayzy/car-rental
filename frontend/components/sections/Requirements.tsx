import { RequirementGlyph } from "@/components/ui/feature-icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { requirements } from "@/config/content";
import { site } from "@/config/site";

export function Requirements() {
  return (
    <section id="requirements" aria-labelledby="requirements-title" className="container-site">
      <div className="border-line pt-8 pb-6 xl:border-b xl:pt-3 xl:pb-9">
        <SectionHeading id="requirements-title">Requirements</SectionHeading>

        <ul className="mt-5 border-line max-xl:border-t md:grid md:grid-cols-2 md:gap-x-10 xl:mt-4 xl:grid-cols-4 xl:gap-x-0">
          {requirements.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-7 border-line py-6 pl-3 not-last:border-b md:max-xl:nth-last-2:border-b-0 xl:gap-[1.375rem] xl:border-b-0! xl:py-0 xl:pr-4 xl:pl-9 xl:not-first:border-l xl:first:pl-0"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink text-[2rem] text-ink xl:size-[3.625rem] xl:text-[2.375rem]">
                {item.icon === "age" ? (
                  <span className="font-display text-[0.9375rem] font-bold xl:text-lg">
                    {site.booking.minDriverAge}+
                  </span>
                ) : (
                  <RequirementGlyph name={item.icon} />
                )}
              </span>
              <div className="pt-1 xl:pt-2.5">
                <h3 className="font-sans text-base font-medium text-ink xl:text-sm">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-[1.6] whitespace-pre-line text-muted xl:mt-2 xl:text-xs xl:leading-[1.65]">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
