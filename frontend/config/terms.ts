import { site } from "./site";

/**
 * Rental terms and fees: the one place for them. The /rental-terms page, the FAQ and the
 * booking dialog all read from here.
 *
 * The fees and the 48-hour cancellation rule were confirmed by the client on 2026-10-20 (the
 * lost key at $750). Values still tagged TODO (tax rate, insurance, prohibited uses) are not
 * agreed yet. The deposit, age, mileage and delivery come from site.booking, which the client
 * confirmed on 2026-10-14.
 */
export const rentalTerms = {
  /**
   * Percent of the rental. TODO: confirm with the client's accountant. NY adds a 12% special
   * tax on passenger car rentals on top of sales tax (TB-ST-825), and Suffolk County sales
   * tax is 8.75% since March 2025, so the real rate is likely higher.
   * The API charges its own copy (RENTAL_TAX_RATE in /backend): change both together.
   */
  taxRatePercent: 8.625, // TODO: confirm with the client's accountant

  driver: {
    minAge: site.booking.minDriverAge,
    insurance: "full coverage", // TODO: confirm with the client
  },

  cancellation: {
    freeHoursBefore: 48,
    lateCancellationFeeDays: 1,
  },

  lateReturn: {
    perHourUsd: 50,
    fullDayAfterHours: 3,
  },

  fuelPerGallonUsd: 10,
  cleaningFeeUsd: 150,
  smokingFeeUsd: 250,
  tollAndTicketAdminFeeUsd: 25,
  lostKeyFeeUsd: 750,

  // TODO: confirm with the client
  prohibited: [
    "Racing, timed events or any track use",
    "Off-road driving",
    "Carrying passengers or goods for pay (rideshare, delivery, hire)",
    "Anyone driving who is not named on the rental agreement",
  ],
} as const;

/** Rental plus tax, rounded to the cent like the API does. Delivery and deposit are separate. */
export function priceWithTax(rentalUsd: number) {
  const taxUsd = Math.round(rentalUsd * rentalTerms.taxRatePercent) / 100;
  return { taxUsd, totalUsd: Math.round((rentalUsd + taxUsd) * 100) / 100 };
}

/** $1,497 for whole dollars, $129.12 when there are cents. */
export function usd(amount: number) {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}
