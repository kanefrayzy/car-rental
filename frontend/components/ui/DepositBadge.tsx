import { CheckIcon } from "@/components/ui/icons";
import { depositCopy } from "@/config/terms";

/**
 * "Only a $500 refundable hold", next to the price (owner, 2026-11-10): the deposit is a hold on
 * the card, not a charge, and small next to what competitors ask.
 */
export function DepositBadge({ amountUsd, className = "" }: { amountUsd: number; className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-full bg-tint px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-brand-deep ${className}`}
    >
      <CheckIcon aria-hidden="true" className="shrink-0 text-[0.8125rem]" />
      {depositCopy(amountUsd).highlight}
    </p>
  );
}
