import { cacheLife } from "next/cache";
import { cars as configCars, type Car } from "@/config/cars";
import { site } from "@/config/site";

/**
 * The fleet as the site shows it: everything from config/cars.ts, with the daily price from
 * the API when there is one, so a price the owner changes in the admin panel reaches the
 * site within a minute or two. Server-side only.
 *
 * The server reaches the API at API_INTERNAL_URL (in Docker, the container's own address)
 * or else at NEXT_PUBLIC_API_URL. With neither, or while the API is unreachable (also
 * during `next build` in Docker), the config price is used.
 */
const SERVER_API_URL = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL)?.replace(/\/+$/, "");

type ApiCar = { slug: string; pricePerDay: number };

export async function getCars(): Promise<Car[]> {
  "use cache";
  // Refreshed in the background about once a minute; see the cacheLife docs.
  cacheLife("minutes");

  const prices = await fetchPrices();
  return configCars.map((car) => {
    const price = prices.get(car.slug);
    return price ? { ...car, pricePerDay: price } : car;
  });
}

async function fetchPrices(): Promise<Map<string, number>> {
  if (!SERVER_API_URL) return new Map();

  try {
    const response = await fetch(`${SERVER_API_URL}/cars`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { data } = (await response.json()) as { data: ApiCar[] };

    return new Map(
      data
        .filter((car) => Number.isInteger(car.pricePerDay) && car.pricePerDay > 0)
        .map((car) => [car.slug, car.pricePerDay]),
    );
  } catch (error) {
    console.warn(`Prices from the API are unavailable, showing the config prices: ${String(error)}`);
    return new Map();
  }
}

/**
 * What the owner sets on the admin panel's Settings page: the deposit for new requests. Same
 * caching as the prices; config/site.ts is the fallback. (The API also returns an Instagram
 * link from there; the site ignores it since 2026-10-23: social links live in site.social.)
 */
export type SiteSettings = { depositUsd: number };

export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("minutes");

  const fallback: SiteSettings = { depositUsd: site.booking.depositUsd };
  if (!SERVER_API_URL) return fallback;

  try {
    const response = await fetch(`${SERVER_API_URL}/settings`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as Partial<SiteSettings>;
    return {
      depositUsd: Number.isInteger(data.depositUsd) && data.depositUsd! > 0 ? data.depositUsd! : fallback.depositUsd,
    };
  } catch (error) {
    console.warn(`Settings from the API are unavailable, using the config: ${String(error)}`);
    return fallback;
  }
}
