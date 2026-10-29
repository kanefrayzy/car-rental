import { site } from "./site";
import { rentalTerms, usd } from "./terms";

const { booking, location } = site;

/**
 * Homepage copy. Draft wording: have the client review the FAQ answers before launch.
 * "\n" in step and requirement copy is a deliberate line break taken from the mockups.
 */

export type StepIcon = "calendar" | "message" | "documents" | "deposit";

/** The deposit comes from the admin panel's Settings page (lib/catalog.ts, getSiteSettings). */
export const stepsFor = (depositUsd: number): { icon: StepIcon; title: string; text: string }[] => [
  {
    icon: "calendar",
    title: "Pick your dates\nand send a request",
    text: "See the price with tax\nbefore you send it.",
  },
  {
    icon: "deposit",
    title: "Pay the\nrefundable deposit",
    text: `${usd(depositUsd)} by card locks\nyour dates.`,
  },
  {
    icon: "documents",
    title: "Upload license\nand insurance",
    text: "Two photos, on your\nprivate booking page.",
  },
  {
    icon: "message",
    title: "We confirm,\nyou pay and drive",
    text: "Usually the same day.\nPay before pickup.",
  },
];

/**
 * What people rent the car for (user, 2026-10-16). Each card's button opens the booking page
 * with ?occasion=<slug>, and the request carries it (shown in the admin panel and the emails).
 * The API accepts the same slugs: `rental.occasions` in /backend/config/rental.php. Change both
 * together. `label` is the wording in the booking form's list and on the booking page.
 */
export const occasions = [
  {
    slug: "photoshoot",
    title: "Photoshoots",
    label: "Photoshoot",
    text: "A widebody that makes every frame.",
    cta: "Book for a photoshoot",
  },
  {
    slug: "music-video",
    title: "Music Videos",
    label: "Music video",
    text: "The car that steals the scene in your video.",
    cta: "Book for a music video",
  },
  {
    slug: "wedding",
    title: "Weddings",
    label: "Wedding",
    text: "Arrive in style. We can deliver it to the venue.",
    cta: "Book for a wedding",
  },
  {
    slug: "birthday",
    title: "Birthdays",
    label: "Birthday",
    text: "A day behind the wheel is the gift they remember.",
    cta: "Book for a birthday",
  },
  {
    slug: "prom",
    title: "Prom",
    label: "Prom",
    text: `Make the entrance. An adult ${booking.minDriverAge}+, like a parent, rents and drives.`,
    cta: "Book for prom",
  },
  {
    slug: "event",
    title: "Events & Parties",
    label: "Event or party",
    text: "A showpiece out front for launches and parties.",
    cta: "Book for an event",
  },
] as const;

export type Occasion = (typeof occasions)[number]["slug"];

export const isOccasion = (value: unknown): value is Occasion =>
  occasions.some((occasion) => occasion.slug === value);

export const occasionLabel = (slug: Occasion) => occasions.find((occasion) => occasion.slug === slug)!.label;

/**
 * The contact form's "Occasion" list (user, 2026-10-16): a plain rental, the occasions above,
 * and "Other". The API accepts the same values: `rental.contact_topics` in
 * /backend/config/rental.php. Change both together.
 */
export const contactTopics = [
  { value: "rental", label: "Rental" },
  { value: "photoshoot", label: "Photoshoot" },
  { value: "music-video", label: "Music Video" },
  { value: "wedding", label: "Wedding" },
  { value: "prom", label: "Prom" },
  { value: "birthday", label: "Birthday" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const;

export type ContactTopic = (typeof contactTopics)[number]["value"];

/**
 * The customer's path from request to pickup, as the booking form and the booking page
 * explain it. The booking page (BookingTracker) shows the live state of each step.
 */
export const bookingJourneyFor = (depositUsd: number): { title: string; text: string }[] => [
  { title: "Send your request", text: "Nothing is charged yet." },
  {
    title: `Pay the ${usd(depositUsd)} deposit`,
    text: `Refundable. It locks your dates; without it they are held for ${booking.holdHours} hours.`,
  },
  { title: "Upload license and insurance", text: "Two photos on your private booking page." },
  { title: "We confirm", text: "By email, usually the same day." },
  { title: "Pay for the rental", text: "Online, any time before pickup." },
];

export type RequirementIcon = "age" | "license" | "insurance" | "card";

export const requirements: { icon: RequirementIcon; title: string; text: string }[] = [
  {
    icon: "age",
    title: `${booking.minDriverAge}+ years`,
    text: `Must be at least ${booking.minDriverAge} years old.`,
  },
  {
    icon: "license",
    title: "Valid driver’s license",
    text: "Clean and valid license\nrequired.",
  },
  {
    icon: "insurance",
    title: "Full coverage insurance",
    text: "Personal insurance\nor rental coverage.",
  },
  {
    icon: "card",
    title: "Credit card for deposit",
    text: "Major credit card in your name.",
  },
];

// Answers read their numbers from config: site.booking (confirmed) and config/terms.ts
// (templates until the client confirms them). /rental-terms states the same rules.
export const faqFor = (depositUsd: number): { question: string; answer: string }[] => [
  {
    question: "What are the rental requirements?",
    answer: `You need to be at least ${booking.minDriverAge} years old, hold a valid driver’s license, carry your own ${rentalTerms.driver.insurance} insurance that extends to a rental car, and have a credit card in the driver’s name.`,
  },
  {
    question: "How do I send my license and insurance?",
    answer: "After you send a booking request, we email you a secure link to upload a photo of your license and your proof of insurance. Only we can see the files. We confirm your dates once we have them, and you bring the license and card at pickup.",
  },
  {
    question: "What does it cost in total?",
    answer: `The daily rate for every 24 hours from your pick-up time (a part of a day counts as a day), plus ${rentalTerms.taxRatePercent}% tax, plus delivery if you are beyond our free delivery area. The ${usd(depositUsd)} security deposit is separate: it is charged when you request the booking and refunded after the car is returned, minus any extra charges.`,
  },
  {
    question: "Can I pick up or get delivery?",
    answer: `Both. Pick the car up in ${location.city}, or have it delivered to your home, hotel or event. Delivery is free within ${booking.delivery.freeRadiusMiles} miles of ${location.city}. Farther drop-offs cost ${usd(booking.delivery.feeMinUsd)} to ${usd(booking.delivery.feeMaxUsd)} depending on distance, and we confirm the fee when we reply to your request. We can deliver to JFK, priced after you book.`,
  },
  {
    question: "Can I rent the car for a photoshoot or music video?",
    // Shoots are quoted per project (user, 2026-10-19); config/services.ts says the same.
    answer: `Yes. Shoots are quoted per project: the price depends on how long you need the car, where you are shooting, and whether it stays parked or drives in frame. Ask for a quote with the details. We can bring the car to your set, free within ${booking.delivery.freeRadiusMiles} miles of ${location.city}.`,
  },
  {
    question: "Can I book the car for a wedding or prom?",
    answer: `Yes. We can deliver it to your venue or your home. The driver must be at least ${booking.minDriverAge} with a valid license and ${rentalTerms.driver.insurance} insurance, so for prom an adult ${booking.minDriverAge}+, usually a parent, rents the car and drives.`,
  },
  {
    question: "Is there a mileage limit?",
    answer: `Each rental day includes ${booking.includedMilesPerDay} miles, so a three-day rental comes with ${3 * booking.includedMilesPerDay}. Extra miles are ${usd(booking.extraMileUsd)} each, taken from your deposit after you return the car.`,
  },
  {
    question: "What is the cancellation policy?",
    answer: `Cancel up to ${rentalTerms.cancellation.freeHoursBefore} hours before pickup at no charge. After that the price of ${rentalTerms.cancellation.lateCancellationFeeDays === 1 ? "one rental day" : `${rentalTerms.cancellation.lateCancellationFeeDays} rental days`} is kept from your deposit, and we refund the rest.`,
  },
  {
    question: "What if I return the car late or with less fuel?",
    answer: `Late returns cost ${usd(rentalTerms.lateReturn.perHourUsd)} per hour, and more than ${rentalTerms.lateReturn.fullDayAfterHours} hours late counts as a full day. Return the car with the fuel level you got it with, or we charge ${usd(rentalTerms.fuelPerGallonUsd)} per missing gallon.`,
  },
  {
    question: "Who pays for tolls and tickets?",
    answer: `You do. Tolls and tickets from your rental are passed on to you with a ${usd(rentalTerms.tollAndTicketAdminFeeUsd)} processing fee each. Racing, track days, off-road driving and drivers not named on the agreement are not allowed.`,
  },
];
