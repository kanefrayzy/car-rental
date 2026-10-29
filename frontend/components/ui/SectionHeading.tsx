type SectionHeadingProps = {
  children: React.ReactNode;
  id?: string;
};

/** Short blue rule above an h2, as on every section in the mockups. */
export function SectionHeading({ children, id }: SectionHeadingProps) {
  return (
    <div>
      <span aria-hidden="true" className="block h-[3px] w-[2.375rem] rounded-full bg-brand-deep" />
      <h2 id={id} className="mt-2 text-title font-bold">
        {children}
      </h2>
    </div>
  );
}
