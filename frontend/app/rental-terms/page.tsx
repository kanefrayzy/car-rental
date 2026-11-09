import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/ContentPage";
import { site } from "@/config/site";
import { depositDefaults, rentalTerms, usd } from "@/config/terms";
import { getCars, getSiteSettings } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { formatTime } from "@/lib/time";

export const metadata: Metadata = pageMetadata({
  title: "Rental Terms: Deposit, Mileage and Fees",
  description: `Driver requirements, deposit, mileage, delivery and fees for renting the Dodge Charger Hellcat Widebody from ${site.name} in ${site.location.city}, NY.`,
  path: "/rental-terms",
});

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/*
 * A short summary, as competitors do; the full agreement is signed at pickup. The payment
 * sections follow what the site does: since 2026-11-10 (owner) the deposit is a hold on the card
 * saved with the request, placed 24 hours before pickup and released after the return
 * (backend App\Services\DepositHolds); a late cancellation fee and charges the hold does not
 * cover go to the saved card. Before that it was charged with the request and refunded (the
 * "charge" branches below, still used if the API's mode is switched back). The rental is
 * paid from the approval email before pickup. Every number comes from config: site.booking (confirmed by the client) and config/terms.ts (templates,
 * tagged TODO until the client confirms them). The price can come from the API (lib/catalog.ts).
 */
export default async function RentalTermsPage() {
  const { booking, location } = site;
  const t = rentalTerms;
  const [[car], { depositUsd, depositMode }] = await Promise.all([getCars(), getSiteSettings()]);
  const hold = depositMode === "hold";
  const lateFee =
    t.cancellation.lateCancellationFeeDays === 1 ? "one rental day" : plural(t.cancellation.lateCancellationFeeDays, "rental day");

  return (
    <ContentPage title="Rental Terms" path="/rental-terms" intro="The short version of how renting works.">
      <h2>Driver requirements</h2>
      <ul>
        <li>At least {t.driver.minAge} years old.</li>
        <li>A valid driver’s license.</li>
        <li>Your own {t.driver.insurance} insurance that extends to a rental car.</li>
        <li>A credit card in the driver’s name.</li>
      </ul>

      <h2>Rental and mileage</h2>
      <ul>
        <li>
          The {car.fullName} is {usd(car.pricePerDay)} per day, plus {t.taxRatePercent}% tax.
        </li>
        <li>
          A rental day is 24 hours from your pick-up time; a part of a day counts as a full day. Pick-up and return
          are between {formatTime(booking.hours.open)} and {formatTime(booking.hours.close)}, New York time.
        </li>
        <li>Minimum rental: {plural(booking.minRentalDays, "day")}.</li>
        <li>
          {booking.includedMilesPerDay} miles per day included, then {usd(booking.extraMileUsd)} for each extra
          mile.
        </li>
        <li>
          Delivery is free within {booking.delivery.freeRadiusMiles} miles of {location.city}; farther drop-offs
          cost {usd(booking.delivery.feeMinUsd)} to {usd(booking.delivery.feeMaxUsd)}.
        </li>
      </ul>

      <h2>Security deposit</h2>
      {hold ? (
        <ul>
          <li>
            A {usd(depositUsd)} refundable hold on your card. It is a hold, not a charge: nothing is taken unless
            something is owed under these terms.
          </li>
          <li>
            You save your card when you request the booking. Nothing is charged then. Saving it locks your dates; until
            then they are reserved for {plural(booking.holdHours, "hour")}.
          </li>
          <li>
            We place the hold {plural(depositDefaults.holdHoursBeforePickup, "hour")} before pickup, or right away if
            pickup is sooner. Banks keep a hold for a few days only, so on a longer rental we place a new hold before the
            old one ends and then release the old one.
          </li>
          <li>
            After the car is returned, we release the hold. Your bank decides how fast it shows as available again.
          </li>
          <li>
            If something is owed for tolls, tickets, extra miles, late return, fuel or cleaning, we may use part of the
            hold for it and release the rest. We email you what was used and why.
          </li>
          <li>
            If your bank declines the hold, we email you a link to confirm it or use another card. Without a hold we may
            not hand over the car.
          </li>
        </ul>
      ) : (
        <ul>
          <li>
            {usd(depositUsd)}, paid by card when you request the booking. It is charged, not held on your card. Until it
            is paid, your dates are held for {plural(booking.holdHours, "hour")}.
          </li>
          <li>
            We refund it after the car is returned, minus any of the charges below. Refunds take 5 to 10 business days
            to show up, depending on your bank.
          </li>
        </ul>
      )}

      <h2>Paying for the rental</h2>
      <ul>
        <li>
          Once we approve your booking, we email you a link to pay the rental plus {t.taxRatePercent}% tax by card.
        </li>
        <li>The rental must be paid before pickup. If it is not, we may cancel the booking.</li>
      </ul>

      <h2>Cancellation</h2>
      {hold ? (
        <ul>
          <li>
            Free up to {t.cancellation.freeHoursBefore} hours before pickup: we release any hold and refund any rental
            payment in full.
          </li>
          <li>
            Later than that, the price of {lateFee} is charged to the card you saved, and any hold on it is released.
            A rental payment is refunded, minus that fee.
          </li>
        </ul>
      ) : (
        <ul>
          <li>
            Free up to {t.cancellation.freeHoursBefore} hours before pickup: we refund the deposit and any rental
            payment in full.
          </li>
          <li>Later than that, the price of {lateFee} is kept from your deposit, and we refund the rest.</li>
        </ul>
      )}

      <h2>{hold ? "Charges after the rental" : "Charges taken from the deposit"}</h2>
      {hold && (
        <p>
          Tolls, tickets, extra miles, late return, fuel and cleaning may be taken from the hold. Anything the hold does
          not cover, including charges that arrive after it is released, is charged to the card you saved. We email you
          each charge and its reason.
        </p>
      )}
      <ul>
        <li>
          Extra miles: {usd(booking.extraMileUsd)} per mile over {booking.includedMilesPerDay} miles per day.
        </li>
        <li>
          Late return: {usd(t.lateReturn.perHourUsd)} per hour; more than {t.lateReturn.fullDayAfterHours} hours
          late counts as a full day.
        </li>
        <li>
          Fuel: return the car with the same fuel level, or pay {usd(t.fuelPerGallonUsd)} per missing gallon.
        </li>
        <li>Cleaning: {usd(t.cleaningFeeUsd)} if the car comes back dirty.</li>
        <li>Smoking or vaping in the car: {usd(t.smokingFeeUsd)}.</li>
        <li>
          Tolls and tickets from your rental, plus a {usd(t.tollAndTicketAdminFeeUsd)} processing fee for each.
        </li>
        <li>Lost key: {usd(t.lostKeyFeeUsd)}.</li>
        <li>Damage not covered by your insurance.</li>
      </ul>

      <h2>Not allowed</h2>
      <ul>
        {t.prohibited.map((rule) => (
          <li key={rule}>{rule}.</li>
        ))}
      </ul>

      <p>
        <strong>These terms are a summary. The full rental agreement is signed at pickup.</strong>
      </p>
      <p>
        Questions? Call or text <a href={site.phone.href}>{site.phone.display}</a>
        {site.email && (
          <>
            , or email <a href={`mailto:${site.email}`}>{site.email}</a>
          </>
        )}
        .
      </p>
    </ContentPage>
  );
}
