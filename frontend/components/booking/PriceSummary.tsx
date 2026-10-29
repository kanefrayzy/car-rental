import { usd } from "@/config/terms";

export type PriceQuote = {
  days: number;
  pricePerDay: number;
  rentalUsd: number;
  taxRate: number;
  taxUsd: number;
  totalUsd: number;
  depositUsd: number;
};

/**
 * The price as the customer pays it: rental and tax add up to the total, the deposit sits
 * apart because it comes back. Used by the booking form and the booking page.
 */
export function PriceSummary({ quote, className = "" }: { quote: PriceQuote; className?: string }) {
  const { days, pricePerDay, rentalUsd, taxRate, taxUsd, totalUsd, depositUsd } = quote;

  return (
    <div className={className}>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-muted">
          {usd(pricePerDay)} × {days} {days === 1 ? "day" : "days"}
        </dt>
        <dd className="text-right font-medium text-ink">{usd(rentalUsd)}</dd>
        <dt className="text-muted">Tax ({taxRate}%)</dt>
        <dd className="text-right font-medium text-ink">{usd(taxUsd)}</dd>
        <div aria-hidden="true" className="col-span-2 mt-1 border-t border-line" />
        <dt className="pt-1 font-semibold text-ink">Rental total</dt>
        <dd className="pt-1 text-right font-display text-lg leading-tight font-bold text-ink">
          {usd(totalUsd)}
        </dd>
      </dl>
      <div className="mt-4 flex items-start justify-between gap-4 rounded-btn-lg bg-tint/60 px-3.5 py-3 text-sm">
        <p>
          <span className="font-medium text-ink">Refundable deposit</span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted">
            Paid separately, returned after the car is checked in.
          </span>
        </p>
        <p className="font-semibold text-ink">{usd(depositUsd)}</p>
      </div>
    </div>
  );
}
