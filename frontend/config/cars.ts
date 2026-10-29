export type SpecIcon = "horsepower" | "acceleration" | "topSpeed" | "seats";

export type CarSpec = {
  icon: SpecIcon;
  value: string;
  label: string;
};

export type CarImage = {
  /** The gallery frame and thumbnails: a 16:10 crop around the car. */
  src: string;
  /** The full-screen viewer: the whole photo, sharper there than the crop. */
  zoom?: string;
  alt: string;
};

export type Car = {
  slug: string;
  /** Short name for headings and cards. */
  name: string;
  /** Full model designation for alt text, metadata and booking summaries. */
  fullName: string;
  category: string;
  pricePerDay: number;
  currency: "USD";
  /** The four figures shown in the spec grid, in display order. */
  specs: CarSpec[];
  /** Not in the spec grid (the mockup has four slots); used in descriptions. */
  torque: string;
  /** First image is the default main gallery image. */
  gallery: CarImage[];
};

/**
 * The car is a 2023 Dodge Charger SRT Hellcat Widebody Jailbreak.
 * To switch engine variant, change CHARGER_TRIM below; every spec and the full name follow.
 * The redeye figures are PLACEHOLDER and must be checked before they are used.
 */
const chargerTrims = {
  hellcat: {
    designation: "SRT Hellcat Widebody Jailbreak",
    horsepower: 717,
    torque: "650 lb-ft",
    zeroToSixty: "3.6 s",
    topSpeed: "196 mph",
  },
  redeye: {
    designation: "SRT Hellcat Redeye Widebody Jailbreak",
    horsepower: 807,
    torque: "707 lb-ft",
    zeroToSixty: "3.5 s",
    topSpeed: "203 mph",
  },
} as const;

const CHARGER_TRIM: keyof typeof chargerTrims = "hellcat";

/** The figures of the trim in use, for copy outside the spec grid (page descriptions). */
export const charger = chargerTrims[CHARGER_TRIM];

/**
 * The fleet. Add a second car by appending to this array; the homepage renders from it.
 */
export const cars: Car[] = [
  {
    slug: "dodge-charger-widebody",
    name: "Dodge Charger Widebody",
    fullName: `2023 Dodge Charger ${charger.designation}`,
    category: "American Muscle",
    pricePerDay: 499,
    currency: "USD",
    specs: [
      { icon: "horsepower", value: `${charger.horsepower} HP`, label: "Horsepower" },
      { icon: "acceleration", value: charger.zeroToSixty, label: "0–60 mph" },
      { icon: "topSpeed", value: charger.topSpeed, label: "Top speed" },
      { icon: "seats", value: "5 seats", label: "Seating" },
    ],
    torque: charger.torque,
    // Real photos of the car (client, 2026-10-13 and 2026-10-27), cropped by scripts/images.mjs
    // from /design/car. Daylight photos first, then sunset and dusk (user, 2026-10-27: "яркие
    // картинки поставь первыми"). The gallery opens on the whole car from the front left: not a
    // front three-quarter from the right, which is the hero's angle, so on phones the two do not
    // repeat. The first five are the thumbnails; the arrows reach the rest.
    gallery: [
      {
        src: "/images/gallery/charger-left.webp",
        zoom: "/images/gallery/full/charger-left.webp",
        alt: "The whole car from the front left: satin black wheels, red calipers, black roof",
      },
      {
        src: "/images/gallery/charger-front-three-quarter.webp",
        zoom: "/images/gallery/full/charger-front-three-quarter.webp",
        alt: "Freshly washed Charger Widebody from the front three-quarter: black hood, smoked headlights, widebody flares",
      },
      {
        src: "/images/gallery/charger-interior.webp",
        zoom: "/images/gallery/full/charger-interior.webp",
        alt: "Red leather front seats and the SRT steering wheel through the open driver's door",
      },
      {
        src: "/images/gallery/charger-rear-seats.webp",
        zoom: "/images/gallery/full/charger-rear-seats.webp",
        alt: "Red leather rear bench seen through the open rear door",
      },
      {
        src: "/images/gallery/charger-rear.webp",
        zoom: "/images/gallery/full/charger-rear.webp",
        alt: "Rear three-quarter view at sunset with the full-width tail light lit",
      },
      {
        src: "/images/gallery/charger-front.webp",
        zoom: "/images/gallery/full/charger-front.webp",
        alt: "Front of the silver Charger Widebody at dusk, headlights on, black hood",
      },
      {
        src: "/images/gallery/charger-headlights.webp",
        zoom: "/images/gallery/full/charger-headlights.webp",
        alt: "Headlights on at dusk, with the hood scoop and red front side marker",
      },
    ],
  },
];
