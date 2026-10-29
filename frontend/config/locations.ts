import { formatTime } from "@/lib/time";
import { charger } from "./cars";
import type { Occasion } from "./content";
import { site } from "./site";
import { rentalTerms, usd } from "./terms";

const { booking, location } = site;
const radius = booking.delivery.freeRadiusMiles;
const fee = `${usd(booking.delivery.feeMinUsd)} to ${usd(booking.delivery.feeMaxUsd)}`;
const miles = booking.includedMilesPerDay;
const extraMile = usd(booking.extraMileUsd);
const hours = `${formatTime(booking.hours.open)} to ${formatTime(booking.hours.close)}`;
const hp = `${charger.horsepower} hp`;
const age = booking.minDriverAge;

/**
 * Distances that the copy below uses, from Patchogue by road, checked in Google Maps on
 * 2026-10-19: Southampton 37 mi, Westhampton Beach 23, Montauk Point 68, Times Square 56,
 * Massapequa Park (the Nassau line) 25 at about 30 min, Jamesport 30, Greenport 47. LIRR from
 * Penn Station: 1 h 28 min to 2 h 10 min, some trains change at Babylon. The
 * mileage sums are worked out from them and site.booking: re-read the copy if the included
 * miles change.
 */
const roundTrip = { montauk: 140, midtown: 115 };

export type Area = {
  slug: string;
  /** As it reads after "Hellcat Rental in": "Patchogue", "the Hamptons", "NYC". */
  name: string;
  /** In lists and links. */
  label: string;
  /** The area for search engines (Service.areaServed). */
  place: { type: "City" | "AdministrativeArea" | "Place"; name: string };
  /** Page title before "| Bueno Exotics" (60 characters in all) and description (155). */
  title: string;
  description: string;
  /** One line under the H1. */
  lead: string;
  /** The heading over the body copy. */
  heading: string;
  /** One line on /locations and on the link cards. */
  summary: string;
  /** Two or three short paragraphs about this area only. */
  body: string[];
  /** The quick facts card beside the copy. */
  facts: { label: string; value: string }[];
  faqs: { question: string; answer: string }[];
  /** The services people here book most (links to /services). */
  occasions: Occasion[];
  /** Areas linked at the bottom of the page, by slug. */
  nearby: string[];
  /** When the copy last changed (sitemap lastmod). Change it with the copy. */
  updated: string;
};

/**
 * The area pages (/locations/[slug]) and the footer's "Areas we serve". Every page is written
 * for its area: no shared template text with the name swapped in. Prices come from the admin
 * panel, so none are written here; delivery and mileage come from site.booking.
 */
export const areas: Area[] = [
  {
    slug: "patchogue",
    name: "Patchogue",
    label: "Patchogue",
    place: { type: "City", name: "Patchogue" },
    title: "Hellcat Rental in Patchogue, NY",
    description: `Rent the ${hp} Dodge Charger Hellcat Widebody right in Patchogue. Pick it up in the village or get free delivery within ${radius} miles.`,
    lead: "This is home. The car lives here, so Patchogue gets it first and gets it free.",
    heading: "Main Street, the bay and the village",
    summary: `Our home base. Pickup in the village, free delivery within ${radius} miles.`,
    body: [
      `Pick the car up in the village, or we bring it to your door: delivery is free within ${radius} miles of Patchogue, so anywhere in town costs nothing extra. The exact pickup spot comes with your confirmation.`,
      "Start on Main Street after dark, when the theater marquee is lit and the exhaust echoes off the storefronts. Then take South Country Road east through Bellport, or roll down to the bay where the Fire Island ferries leave. Sunrise Highway is a few minutes north when you want open road.",
      "Locals book it for prom, weddings by the water and the birthday that needs something louder than a cake. Coming in by train? Patchogue is a stop on the LIRR Montauk Branch.",
    ],
    facts: [
      { label: "Pickup", value: "In the village, daily" },
      { label: "Delivery", value: `Free within ${radius} miles` },
      { label: "Included", value: `${miles} miles a day` },
      { label: "By train", value: "LIRR, Montauk Branch" },
    ],
    faqs: [
      {
        question: "Where do I pick up the car in Patchogue?",
        answer: `In the village. We keep the exact spot off the website and send it with your confirmation. Pickup and return run every day from ${hours}, at the times you choose when you book.`,
      },
      {
        question: "Is delivery free in Patchogue?",
        answer: `Yes. Delivery is free within ${radius} miles of Patchogue, which covers the whole village. Send us the address when we confirm your booking.`,
      },
      {
        question: "Can we get the car for prom in Patchogue?",
        answer: `Yes, with an adult behind the wheel: the driver must be ${age} or older with a valid license and ${rentalTerms.driver.insurance} insurance. We can bring the car to the house for photos before you leave.`,
      },
    ],
    occasions: ["prom", "wedding", "birthday"],
    nearby: ["suffolk-county", "the-hamptons", "nassau-county"],
    updated: "2026-10-19",
  },
  {
    slug: "suffolk-county",
    name: "Suffolk County",
    label: "Suffolk County",
    place: { type: "AdministrativeArea", name: "Suffolk County" },
    title: "Hellcat Rental in Suffolk County, NY",
    description: `Hellcat Widebody rental across Suffolk County. Pickup in Patchogue, free delivery within ${radius} miles, ${fee} beyond. Weddings, shoots and road trips.`,
    lead: "Patchogue sits in the middle of the South Shore, so most of Suffolk is an easy drive.",
    heading: "From the South Shore to the North Fork",
    summary: `Free delivery within ${radius} miles, ${fee} to the rest of the county.`,
    body: [
      `Pick up in Patchogue or have the car brought to you. Delivery is free within ${radius} miles of Patchogue; farther out in Suffolk it costs ${fee} depending on distance, and we confirm the fee when we reply to your request.`,
      "Suffolk has the best driving on the island. Cross the Robert Moses Causeway and run Ocean Parkway with water on both sides. Head north to the harbor in Port Jefferson, or east on Route 25 past the North Fork farm stands and vineyards.",
      `It is a wedding county, too: North Fork vineyards and Oheka Castle in Huntington both look better with a widebody parked out front. Each day includes ${miles} miles, enough for the wineries and back.`,
    ],
    facts: [
      { label: "Pickup", value: "Patchogue, mid-county" },
      { label: "Delivery", value: `Free within ${radius} mi, then ${fee}` },
      { label: "Included", value: `${miles} miles a day` },
      { label: "Best drive", value: "Ocean Parkway" },
    ],
    faqs: [
      {
        question: "How much is delivery in Suffolk County?",
        answer: `Free within ${radius} miles of Patchogue. Farther in the county it costs ${fee}, depending on how far we drive. We confirm the exact fee when we reply to your request.`,
      },
      {
        question: "Can I take the car to the North Fork wineries?",
        answer: `Yes. Each rental day includes ${miles} miles, which covers Patchogue to the North Fork and back with room to wander; extra miles are ${extraMile} each. Plan a designated driver for the tastings: only the driver named on the booking may drive.`,
      },
      {
        question: "Can you bring the car to a wedding venue in Suffolk?",
        answer: `Yes, for the photos, the entrance or the getaway. Delivery is free within ${radius} miles of Patchogue and ${fee} beyond. The driver must be ${age}+ and named on the booking.`,
      },
    ],
    occasions: ["wedding", "photoshoot", "event"],
    nearby: ["patchogue", "the-hamptons", "nassau-county"],
    updated: "2026-10-19",
  },
  {
    slug: "nassau-county",
    name: "Nassau County",
    label: "Nassau County",
    place: { type: "AdministrativeArea", name: "Nassau County" },
    title: "Hellcat Rental in Nassau County, NY",
    description: `Rent the ${hp} Dodge Charger Hellcat Widebody in Nassau County. Delivery to your door or free pickup in Patchogue. Gold Coast photos, Long Beach nights.`,
    lead: "West of us and closer to the city. We bring the car to you, or you drive out east for it.",
    heading: "Gold Coast estates and South Shore beaches",
    summary: `Delivery for ${fee}, or free pickup in Patchogue.`,
    body: [
      `Nassau starts about 25 miles west of Patchogue by road. Delivery is free within ${radius} miles of Patchogue and ${fee} beyond, so most Nassau addresses are in the paid zone; we quote the exact fee when we reply. Pickup in Patchogue is free and about half an hour from the county line.`,
      "Then make the most of it. The North Shore's Gold Coast is all old estates and winding roads, and Old Westbury Gardens is a favorite for wedding photos. On the South Shore, cruise to the Long Beach boardwalk or take Ocean Parkway to Jones Beach at sunset.",
      "Nassau books it for weddings, music videos and the big birthday. One rule travels with the car: only the driver named on the booking drives it.",
    ],
    facts: [
      { label: "Pickup", value: "Patchogue, about 25 miles east" },
      { label: "Delivery", value: `${fee} for most of the county` },
      { label: "Included", value: `${miles} miles a day` },
      { label: "Best drive", value: "Ocean Parkway to Jones Beach" },
    ],
    faqs: [
      {
        question: "Do you deliver to Nassau County?",
        answer: `Yes. Delivery is free within ${radius} miles of Patchogue and ${fee} beyond it, depending on distance, so most Nassau addresses pay the fee. We confirm it when we reply to your request.`,
      },
      {
        question: "Should I pick up in Patchogue instead?",
        answer: `If you don't mind the trip, yes: pickup is free, and the drive home on Sunrise Highway makes a good first hour in the car. Pickup runs every day from ${hours}.`,
      },
      {
        question: "Can I use the car for wedding photos at a Gold Coast estate?",
        answer: "Yes, as long as the venue allows cars on the grounds; many estates and gardens ask you to book photography ahead. We can deliver the car to the venue; after that, only the driver named on the booking drives it.",
      },
    ],
    occasions: ["wedding", "music-video", "birthday"],
    nearby: ["nyc", "suffolk-county", "patchogue"],
    updated: "2026-10-19",
  },
  {
    slug: "the-hamptons",
    name: "the Hamptons",
    label: "The Hamptons",
    place: { type: "Place", name: "The Hamptons" },
    title: "Hellcat Rental in the Hamptons, NY",
    description: `Drive a Dodge Charger Hellcat Widebody to Southampton, Sag Harbor and Montauk. Pickup in Patchogue, under 40 miles west, or delivery for ${fee}.`,
    lead: "Sunrise Highway runs from Patchogue to Southampton: under 40 miles, and every one counts.",
    heading: "Route 27, Dune Road and Montauk",
    summary: `Starts 25 miles east. Delivery for ${fee}, or pick it up on the way.`,
    body: [
      `Pick up in Patchogue and you can be in Southampton in under an hour, traffic allowing. Or we deliver to your rental house, hotel or venue for ${fee}, depending on how far east you are. We confirm the fee when we reply.`,
      "Out there, slow down on Main Street in Southampton or Sag Harbor, then take Dune Road along the ocean from Westhampton Beach. Montauk is the big run: the lighthouse at the end of the island, about 70 miles from Patchogue.",
      `Plan the miles. A day includes ${miles}, and Montauk and back is about ${roundTrip.montauk}, so one day costs around ${usd((roundTrip.montauk - miles) * booking.extraMileUsd)} in extra miles; two days include ${2 * miles}. Summer Fridays on Route 27 crawl east, so leave early or after dinner.`,
    ],
    facts: [
      { label: "From Patchogue", value: "Under 40 miles to Southampton" },
      { label: "Delivery", value: fee },
      { label: "Included", value: `${miles} miles a day` },
      { label: "Montauk", value: `About ${roundTrip.montauk} miles round trip` },
    ],
    faqs: [
      {
        question: "Can you deliver the car to the Hamptons?",
        answer: `Yes, to a rental house, hotel or venue. Delivery out east costs ${fee}, depending on distance, and we confirm the exact fee when we reply to your request.`,
      },
      {
        question: "Is one day enough for a trip to Montauk?",
        answer: `It works, but watch the miles. Montauk and back from Patchogue is about ${roundTrip.montauk} miles and a day includes ${miles}, so the rest is ${extraMile} a mile. A two-day rental includes ${2 * miles} miles and leaves time for the beach.`,
      },
      {
        question: "Can I book it for a Hamptons wedding?",
        answer: `Yes. We bring it to the venue for the photos and the getaway. The driver must be ${age}+ with a valid license and named on the booking.`,
      },
    ],
    occasions: ["wedding", "photoshoot", "event"],
    nearby: ["suffolk-county", "patchogue"],
    updated: "2026-10-19",
  },
  {
    slug: "nyc",
    name: "NYC",
    label: "New York City",
    place: { type: "City", name: "New York City" },
    title: "Hellcat Rental in NYC from Long Island",
    description: `Rent a ${hp} Dodge Charger Hellcat Widebody from New York City. Ride the LIRR to Patchogue and drive it back, or ask for delivery to the city.`,
    lead: `We are out on Long Island, a train ride from the city. You ride out, then drive back in ${hp}.`,
    heading: "From the city to Patchogue and back",
    summary: "LIRR to Patchogue, or delivery to the city on request.",
    body: [
      `${location.city} is on Long Island's South Shore, about 55 miles east of Midtown. Take the LIRR from Penn Station to Patchogue on the Montauk Branch: 1.5 to 2 hours, sometimes with a change at Babylon. The exact pickup spot comes with your confirmation.`,
      `Rather not ride out? Delivery to the city is on request. Send your booking request, call or text ${site.phone.display} with the address, and we reply with the delivery price before we confirm. We can deliver to JFK, priced after you book.`,
      `Then drive it like a New Yorker who planned ahead. The West Side Highway along the Hudson and the bridges at night are where this car belongs, and a garage is where it sleeps. Midtown and back from Patchogue is about ${roundTrip.midtown} miles, a little over the ${miles} a day includes. City clients book it for music videos, shoots and launch nights.`,
    ],
    facts: [
      { label: "By train", value: "LIRR to Patchogue, 1.5 to 2 hours" },
      { label: "By car", value: "About 55 miles to Midtown" },
      { label: "Delivery", value: "On request, priced after you book" },
      { label: "Included", value: `${miles} miles a day` },
    ],
    faqs: [
      {
        question: "How do I get to Patchogue from New York City?",
        answer: "By train or by car. The LIRR runs from Penn Station to Patchogue on the Montauk Branch in 1.5 to 2 hours, sometimes with a change at Babylon. By car it is about 55 miles on the Long Island Expressway or the Southern State Parkway.",
      },
      {
        question: "Do you deliver to Manhattan, Brooklyn or Queens?",
        answer: `On request. Send a booking request for your dates, then call or text ${site.phone.display} with the address. We reply with the delivery price before we confirm the booking.`,
      },
      {
        question: "Can I keep the car in the city overnight?",
        answer: "Yes, in a garage. We would not leave a widebody on a city street overnight, and neither should you.",
      },
    ],
    occasions: ["music-video", "photoshoot", "event"],
    nearby: ["nassau-county", "patchogue"],
    updated: "2026-10-20",
  },
];

export const findArea = (slug: string) => areas.find((area) => area.slug === slug);
