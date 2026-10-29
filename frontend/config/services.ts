import { charger } from "./cars";
import type { Occasion } from "./content";
import { site } from "./site";
import { rentalTerms, usd } from "./terms";

const { booking, location } = site;
const radius = booking.delivery.freeRadiusMiles;
const fee = `${usd(booking.delivery.feeMinUsd)} to ${usd(booking.delivery.feeMaxUsd)}`;
const miles = booking.includedMilesPerDay;
const age = booking.minDriverAge;
const insurance = rentalTerms.driver.insurance;
const hp = `${charger.horsepower} hp`;

export type ServiceImage = { src: string; width: number; height: number; alt: string };

export type Service = {
  slug: string;
  /** The occasion it books: the booking form and the quote form start with it chosen. */
  occasion: Occasion;
  /** As it reads before "Car Rental on Long Island" and in links: "Wedding". */
  name: string;
  /** Page title before "| Bueno Exotics" (60 characters in all) and description (155). */
  title: string;
  description: string;
  /** One line under the H1. */
  lead: string;
  /** The hero photo. Not the front view: the car card below opens on it. */
  image: ServiceImage;
  /** The heading over the body copy, and two or three short paragraphs for this occasion only. */
  heading: string;
  body: string[];
  /** Three short facts under the hero buttons. */
  badges: [string, string, string];
  faqs: { question: string; answer: string }[];
  /** Two other services linked at the bottom, by slug. */
  related: [string, string];
  /** When the copy last changed (sitemap lastmod). Change it with the copy. */
  updated: string;
};

// Real photos of the car, 16:10 crops by scripts/images.mjs. Never the straight front: the
// car card lower on the page opens on it.
const photo = {
  threeQuarter: {
    src: "/images/gallery/charger-front-three-quarter.webp",
    width: 1200,
    height: 750,
    alt: "Front three-quarter view of the silver Charger Widebody with its black hood and widebody flares",
  },
  headlights: {
    src: "/images/gallery/charger-headlights.webp",
    width: 960,
    height: 600,
    alt: "The Charger Widebody at dusk with its headlights on and red brake calipers",
  },
  rearSunset: {
    src: "/images/gallery/charger-rear.webp",
    width: 960,
    height: 600,
    alt: "The Charger Widebody at sunset, tail lights glowing, from the rear three-quarter",
  },
  tailLight: {
    src: "/images/photos/charger-tail-light.webp",
    width: 960,
    height: 600,
    alt: "Full-width tail light and SRT badge of the Charger Widebody against a sunset sky",
  },
  interior: {
    src: "/images/gallery/charger-interior.webp",
    width: 1170,
    height: 731,
    alt: "Red leather front seats and the SRT steering wheel through the open driver's door",
  },
  rearSeats: {
    src: "/images/gallery/charger-rear-seats.webp",
    width: 1170,
    height: 731,
    alt: "Red leather rear bench of the Charger through the open rear door",
  },
} satisfies Record<string, ServiceImage>;

// How shoots are priced (user, 2026-10-19): a quote per project, by time, place and whether
// the car drives in frame. Shared by the photo and video pages, and the FAQ in config/content.ts.
const shootPricing = "how long you need the car, where you are shooting, and whether it stays parked or drives in frame";

/**
 * The service pages (/services/[slug]), one per occasion in config/content.ts. Each page's copy
 * is written for its occasion: no shared template text with the name swapped in. Prices come
 * from the admin panel, so none are written here.
 */
export const services: Service[] = [
  {
    slug: "photoshoot-car-rental",
    occasion: "photoshoot",
    name: "Photoshoot",
    title: "Photoshoot Car Rental on Long Island",
    description: `Book the ${hp} Dodge Charger Hellcat Widebody for your photoshoot on Long Island. Delivered to your location, quoted by time, place and shot list.`,
    lead: "Silver widebody, satin black hood, red calipers. It photographs well from every side, and we bring it to you.",
    image: photo.rearSunset,
    heading: "Three strong details from one angle",
    body: [
      "The Charger reads big on camera. The widebody flares, the black hood and the red calipers all land in one frame, and the red leather inside gives you a second set of shots. Work it by the water at golden hour, under streetlights at night, or in a studio with a wide enough door.",
      `Shoots are quoted, not booked off the shelf. The price depends on ${shootPricing}. Send the details and we reply with a number.`,
      `We bring the car to your location, free within ${radius} miles of ${location.city} and ${fee} farther on Long Island. Brand shoots, car portraits, senior photos and engagement sessions are all welcome.`,
    ],
    badges: ["Quoted per shoot", "Delivered to your location", "Parked or in motion"],
    faqs: [
      {
        question: "How much does a photoshoot with the car cost?",
        answer: `It depends on three things: how many hours you need the car, where the shoot is, and whether the car only poses or drives in frame. Send the details through the quote form and we reply with a price.`,
      },
      {
        question: "Can the car drive in the shot?",
        answer: "Yes, if we plan for it. Rolling shots and drive-bys are quoted differently from a parked car, so put them on your shot list when you ask for a quote.",
      },
      {
        question: "Can you bring the car to my location?",
        answer: `Yes. Delivery is free within ${radius} miles of ${location.city} and ${fee} farther on Long Island. Shooting in a studio? Check the door first: this is a widebody.`,
      },
    ],
    related: ["music-video-car-rental", "event-car-rental"],
    updated: "2026-10-19",
  },
  {
    slug: "music-video-car-rental",
    occasion: "music-video",
    name: "Music Video",
    title: "Music Video Car Rental on Long Island",
    description: `Put a ${hp} Dodge Charger Hellcat Widebody in your music video. Delivered to your Long Island or NYC set, quoted by hours, location and driving shots.`,
    lead: "The car that owns the frame. Supercharger whine, red interior and a stance that looks expensive on any budget.",
    image: photo.tailLight,
    heading: "The shot people screenshot",
    body: [
      "Every video needs one frame people pause on. Low angle on the widebody, the full-width tail light glowing after dark, a slow pan across the red leather: the Charger gives you all three. The supercharger whine is free sound design.",
      `Video days are quoted per project: ${shootPricing}. Driving shots take planning, so put them on the shot list when you write.`,
      "We deliver to sets across Long Island and, on request, into the city. Shooting in a rented studio or a closed lot? Send the address and call time and we plan the drop-off around it.",
    ],
    badges: ["Quoted per project", "Long Island and NYC sets", "Parked or driving shots"],
    faqs: [
      {
        question: "How is a music video shoot priced?",
        answer: `Per project. The quote depends on ${shootPricing}. Send the dates, the location and the shot list, and we reply with a price.`,
      },
      {
        question: "Can we film the car driving?",
        answer: "Yes, with a plan. Rolling shots and drive-bys are quoted differently from a parked car. Racing of any kind is not allowed, on camera or off.",
      },
      {
        question: "Can you deliver to a set in New York City?",
        answer: "On request. Put the address and call time in your quote request and we include delivery in the price.",
      },
    ],
    related: ["photoshoot-car-rental", "event-car-rental"],
    updated: "2026-10-19",
  },
  {
    slug: "wedding-car-rental",
    occasion: "wedding",
    name: "Wedding",
    title: "Wedding Car Rental on Long Island",
    description: `Arrive in a ${hp} Dodge Charger Hellcat Widebody. Delivered to your Long Island venue for the photos and the getaway, free within ${radius} miles of ${location.city}.`,
    lead: "Not another white limo. A silver widebody for the entrance, the portraits and the drive away.",
    image: photo.rearSeats,
    heading: "The getaway shot your guests post",
    body: [
      "Limos blend into every wedding album. The Charger stands out in yours: silver paint next to a white dress, red leather in the close-ups, and a getaway your guests post before the cake is cut.",
      `We deliver to the venue, the hotel or your house, free within ${radius} miles of ${location.city} and ${fee} farther on Long Island. A rental runs 24 hours from pickup, so one day covers the first look, the portraits and the exit.`,
      `One thing to settle early: the driver. Whoever drives must be ${age}+, hold a valid license and ${insurance} insurance, and be named on the booking. The groom, a groomsman, a sober friend: pick before the toasts.`,
    ],
    badges: ["Delivered to your venue", "24 hours from pickup", `Driver ${age}+ on the booking`],
    faqs: [
      {
        question: "Can you deliver the car to our wedding venue?",
        answer: `Yes, or to your hotel or house. Delivery is free within ${radius} miles of ${location.city} and ${fee} farther on Long Island. We confirm the fee when we reply to your request.`,
      },
      {
        question: "Who can drive the car on the wedding day?",
        answer: `Only the driver named on the booking: ${age} or older, with a valid license and ${insurance} insurance. Choose them before the reception.`,
      },
      {
        question: "Can the car stay at the venue during the reception?",
        answer: "Yes. It is yours for 24 hours from pickup, so it can sit out front for photos all evening. Just make sure the named driver is the one who drives it away.",
      },
    ],
    related: ["prom-car-rental", "photoshoot-car-rental"],
    updated: "2026-10-19",
  },
  {
    slug: "prom-car-rental",
    occasion: "prom",
    name: "Prom",
    title: "Prom Car Rental on Long Island",
    description: `Make the prom entrance in a Dodge Charger Hellcat Widebody on Long Island. An adult ${age}+, like a parent, rents and drives it. Photos at home.`,
    lead: `The entrance everyone films. One rule up front: an adult ${age} or older, like a parent or an older sibling, rents the car and drives it.`,
    image: photo.headlights,
    heading: "Pull up, then let them film",
    body: [
      "Prom is the one night an arrival gets filmed from every angle. Roll up to the venue in a silver widebody with a red interior and the group chat has its photo before you reach the door.",
      `Here is the rule we don't bend: the renter and the driver must be ${age} or older, hold a valid license and ${insurance} insurance, and be named on the booking. Students cannot rent or drive the car. A parent, an older sibling or another adult books it and drives; the prom couple rides.`,
      `We bring the car to your house for photos before you leave, free within ${radius} miles of ${location.city}. Book early: spring weekends fill up first.`,
    ],
    badges: [`Driver ${age}+ required`, "Photos at your house", "Book early for spring"],
    faqs: [
      {
        question: "Can a high school student rent the car for prom?",
        answer: `No. The renter and the driver must be ${age} or older, with a valid license and ${insurance} insurance. Most families have a parent drive, and the students ride.`,
      },
      {
        question: "Can you bring the car to our house for prom photos?",
        answer: `Yes. Delivery is free within ${radius} miles of ${location.city} and ${fee} farther on Long Island. Pick a time before the photos and the car is in the driveway.`,
      },
      {
        question: "How long do we have the car on prom night?",
        answer: "A rental runs 24 hours from the pick-up time you choose, so an afternoon pickup covers the photos, the entrance and the ride home.",
      },
    ],
    related: ["wedding-car-rental", "birthday-car-rental"],
    updated: "2026-10-20",
  },
  {
    slug: "birthday-car-rental",
    occasion: "birthday",
    name: "Birthday",
    title: "Birthday Car Rental on Long Island",
    description: `Give them a day in a ${hp} Dodge Charger Hellcat Widebody: a birthday gift they drive, delivered to the door on Long Island. ${miles} miles a day included.`,
    lead: "A gift they drive. Show up with the keys and watch their face.",
    image: photo.interior,
    heading: "Some gifts get unwrapped. This one gets driven.",
    body: [
      `Have the car waiting in the driveway on the morning of the birthday, hand over the keys and let ${hp} do the talking. It is the present nobody forgets and nobody has to find room for.`,
      `A day includes ${miles} miles: enough for Ocean Parkway with the windows down, dinner in Port Jefferson and the long way home. Want the whole weekend? Book two days and the miles double.`,
      `Planning a surprise? The birthday driver has to be the one named on the booking, ${age}+ with a license and ${insurance} insurance. Call ${site.phone.display} and we will sort out the details quietly.`,
    ],
    badges: ["Delivered to the door", `${miles} miles a day`, `Driver ${age}+`],
    faqs: [
      {
        question: "Can I book the car as a gift for someone else?",
        answer: `Yes, but the person who drives must be the driver named on the booking: ${age} or older, with a valid license and ${insurance} insurance. Call us if you want to keep it a surprise.`,
      },
      {
        question: "How far can we drive in a day?",
        answer: `Each rental day includes ${miles} miles. Extra miles are ${usd(booking.extraMileUsd)} each, or book a second day and get another ${miles}.`,
      },
      {
        question: "Can the car be delivered as a surprise?",
        answer: `Yes. We bring it to the address and time you choose, free within ${radius} miles of ${location.city} and ${fee} farther on Long Island.`,
      },
    ],
    related: ["prom-car-rental", "event-car-rental"],
    updated: "2026-10-19",
  },
  {
    slug: "event-car-rental",
    occasion: "event",
    name: "Event",
    title: "Event Car Rental on Long Island",
    description: `Park a Dodge Charger Hellcat Widebody out front of your launch, grand opening or party on Long Island. Delivered to your venue and ready for photos.`,
    lead: "A showpiece out front. Launches, grand openings, parties and brand nights.",
    image: photo.threeQuarter,
    heading: "It does the crowd work for you",
    body: [
      "Nothing pulls people across a parking lot like a widebody Hellcat. Park it at the door of a store opening, a product launch or a backyard party and it starts the conversation before anyone says hello.",
      `It is priced like any rental: the daily rate plus tax, booked online with the regular booking form. We deliver it to your venue, free within ${radius} miles of ${location.city}, ${fee} farther on Long Island and to the city on request. The rental runs 24 hours from pickup, so setup and teardown fit easily.`,
      "Want guests to sit in it for photos? Plan for it: the car stays parked, and only the driver named on the booking moves it.",
    ],
    badges: ["Photo spot for guests", "Delivered to your venue", "24 hours from pickup"],
    faqs: [
      {
        question: "Can guests sit in the car for photos?",
        answer: "Yes, while it is parked. Only the driver named on the booking drives it, so keep the keys with them.",
      },
      {
        question: "Do you deliver to event venues?",
        answer: `Yes. Delivery is free within ${radius} miles of ${location.city}, ${fee} farther on Long Island, and to New York City on request. We confirm the fee when we reply.`,
      },
      {
        question: "How much does an event rental cost?",
        answer: "The same as any rental: the daily rate for every 24 hours from pickup, plus tax, plus delivery beyond the free area. Pick your dates and book it online like any other rental.",
      },
    ],
    related: ["photoshoot-car-rental", "birthday-car-rental"],
    updated: "2026-10-20",
  },
];

export const findService = (slug: string) => services.find((service) => service.slug === slug);

/** The page for an occasion's card (/services and the home page). */
export const serviceFor = (occasion: Occasion) => services.find((service) => service.occasion === occasion)!;
