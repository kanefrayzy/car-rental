// Everything the video says comes from the site's config, so a new price or a Redeye engine
// (CHARGER_TRIM in frontend/config/cars.ts) reaches the video on the next render.
import { cars } from "../../frontend/config/cars";
import { occasions } from "../../frontend/config/content";
import { site } from "../../frontend/config/site";

export const car = cars[0];

const spec = (icon: string) => car.specs.find((s) => s.icon === icon)!.value;

/** "3.6 s" -> 3.6 with one decimal. */
const figure = (text: string) => {
  const digits = text.match(/[\d.]+/)![0];
  return { value: Number(digits), decimals: digits.split(".")[1]?.length ?? 0 };
};

export const specs = [
  { ...figure(spec("horsepower")), unit: "HP", label: "Horsepower" },
  { ...figure(car.torque), unit: "LB-FT", label: "Torque" },
  { ...figure(spec("acceleration")), unit: "SEC", label: "0–60 mph" },
  { ...figure(spec("topSpeed")), unit: "MPH", label: "Top speed" },
];

// "2023 Dodge Charger SRT Hellcat Widebody Jailbreak" -> 2023 / Dodge Charger / SRT Hellcat / Widebody Jailbreak
const [year, make, model, ...trim] = car.fullName.split(" ");
const designation = trim.join(" ");
const wide = designation.indexOf("Widebody");
export const name = {
  year,
  model: `${make} ${model}`,
  line1: wide > 0 ? designation.slice(0, wide).trim() : designation,
  line2: wide > 0 ? designation.slice(wide) : "",
};

export const seats = spec("seats");

export const occasionTitles = occasions.map((o) => o.title);

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const business = {
  price: car.pricePerDay,
  deposit: site.booking.depositUsd,
  minAge: site.booking.minDriverAge,
  miles: site.booking.includedMilesPerDay,
  phone: site.phone.display,
  domain: site.url.replace(/^https?:\/\//, ""),
  // "Exotic car rental · Patchogue, NY": short enough for one line on a phone.
  tagline: `${site.tagline.split(" in ")[0]} · ${site.location.city}, ${site.location.state}`,
  city: `${site.location.city}, ${site.location.state}`,
  region: site.location.region,
};
