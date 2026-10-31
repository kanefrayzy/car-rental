/**
 * API layer. Components import from here and nowhere else.
 *
 * With NEXT_PUBLIC_API_URL set (e.g. http://localhost:8000/api) every function calls the
 * Laravel API in /backend. Without it, the same functions answer from an in-browser mock,
 * so the site can be developed and demonstrated with no backend running.
 * Endpoints and rules: /backend/README.md
 */
import { cars } from "@/config/cars";
import type { ContactTopic, Occasion } from "@/config/content";
import { site } from "@/config/site";
import { rentalTerms } from "@/config/terms";
import { billedDays, type TimeSlot } from "./time";
import type { IsoDate } from "./validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

/** True when the site talks to the real API. */
export const usesRealApi = API_URL !== "";

/** A failure the visitor can act on. `message` is written for them and safe to show. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Dates and "HH:MM" times are New York time. */
export type AvailabilityRequest = {
  carSlug: string;
  pickupDate: IsoDate;
  pickupTime: TimeSlot;
  returnDate: IsoDate;
  returnTime: TimeSlot;
};

export type AvailabilityResult = {
  available: boolean;
  days: number;
  pricePerDay: number;
  totalUsd: number;
};

export type BookingRequest = AvailabilityRequest & {
  name: string;
  phone: string;
  email: string;
  /** What the car is for (the Occasions cards); null when the visitor did not say. */
  occasion: Occasion | null;
  /** The "I agree to the Rental Terms" checkbox. The API refuses the request without it. */
  acceptTerms: boolean;
};

/**
 * The customer's private link to their booking page (/booking): the booking, an expiry and a
 * signature. It comes back with the request and is in every email; the API checks it.
 */
export type BookingLink = {
  bookingId: string;
  expires: string;
  signature: string;
};

export type BookingResult = {
  bookingId: string;
  status: "pending_deposit";
  depositUsd: number;
  link: BookingLink;
};

/** "returned": the owner marked the car back (admin panel, 2026-10-19). */
export type BookingStatus = "pending_deposit" | "deposit_paid" | "confirmed" | "returned" | "cancelled";

/** Everything the booking page shows. */
export type BookingDetails = {
  bookingId: string;
  status: BookingStatus;
  firstName: string;
  email: string;
  carSlug: string;
  carName: string;
  pickupDate: IsoDate;
  pickupTime: TimeSlot;
  returnDate: IsoDate;
  returnTime: TimeSlot;
  occasion: Occasion | null;
  /** ISO timestamp of the request. */
  requestedAt: string | null;
  /** ISO timestamp of the return, once the owner marked it. */
  returnedAt?: string | null;
  /** Until when an unpaid request holds its dates; null once the deposit is paid. */
  holdEndsAt: string | null;
  holdExpired: boolean;
  days: number;
  pricePerDay: number;
  rentalUsd: number;
  taxRate: number;
  taxUsd: number;
  /** False once the booking is cancelled or its documents were deleted. */
  acceptsUploads: boolean;
  documents: { license: boolean; insurance: boolean };
  depositUsd: number;
  /** The request is still waiting for its deposit: the page offers the card form. */
  awaitingDeposit: boolean;
  depositPaid: boolean;
  /** The rental itself (price plus tax), asked for once the owner confirms. */
  rentalTotalUsd: number;
  rentalDue: boolean;
  rentalPaid: boolean;
};

export type DocumentUpload = { license?: File; insurance?: File };

export type DepositIntent = {
  bookingId: string;
  amountUsd: number;
  /** Stripe PaymentIntent client secret. Null while payments are switched off. */
  clientSecret: string | null;
};

/** The booking page's address for a link; `extra` adds e.g. new=1 right after a request. */
export function bookingPagePath(link: BookingLink, extra: Record<string, string> = {}): string {
  return `/booking?${new URLSearchParams({
    booking: link.bookingId,
    expires: link.expires,
    signature: link.signature,
    ...extra,
  })}`;
}

// ---------------------------------------------------------------------------
// Real API
// ---------------------------------------------------------------------------

type ErrorBody = { message?: string; errors?: Record<string, string[]> };

/** The most specific message in a Laravel error response: the first field error, else `message`. */
function errorMessage(body: ErrorBody | null, status: number): string {
  const fieldError = body?.errors && Object.values(body.errors)[0]?.[0];
  if (fieldError) return fieldError;
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  // 4xx messages are written for visitors; 5xx ones may be technical, so they are replaced.
  if (body?.message && status < 500) return body.message;
  return `Something went wrong on our side. Try again or call ${site.phone.display}.`;
}

/**
 * The form gave up on the request itself (the visitor left the page): nothing to show.
 * Callers check `isAborted(error)` and return quietly.
 */
export class RequestAborted extends Error {
  constructor() {
    super("The request was cancelled.");
    this.name = "RequestAborted";
  }
}

export const isAborted = (error: unknown) => error instanceof RequestAborted;

export type RequestOptions = {
  /** Aborts the request (the form's own controller): it then rejects with RequestAborted. */
  signal?: AbortSignal;
};

type Limits = {
  /** Gives up after this long with `timeoutMessage` (an ApiError with status 0). */
  timeoutMs?: number;
  timeoutMessage?: string;
  /** Shown when the request never reached the server (offline, blocked). */
  networkMessage?: string;
};

async function request<T>(path: string, init: RequestInit, { signal, timeoutMs, timeoutMessage, networkMessage }: RequestOptions & Limits = {}): Promise<T> {
  // One controller for both reasons to stop: the form's signal and the time limit.
  // (AbortSignal.any and AbortSignal.timeout are missing on iOS before 16 and 17.4.)
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : undefined;
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });

  let response: Response;
  let body: T | ErrorBody | null;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...init.headers },
    });
    // Read inside the time limit too: a body that never finishes is no answer either.
    body = (await response.json().catch(() => null)) as T | ErrorBody | null;
    if (controller.signal.aborted) throw controller.signal.reason;
  } catch {
    if (timedOut) {
      throw new ApiError(timeoutMessage ?? `Our server took too long to answer. Try again or call ${site.phone.display}.`);
    }
    if (signal?.aborted) throw new RequestAborted();
    throw new ApiError(networkMessage ?? `We couldn’t reach the server. Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }

  if (!response.ok) {
    throw new ApiError(errorMessage(body as ErrorBody | null, response.status), response.status);
  }
  return body as T;
}

const postJson = <T>(path: string, data?: unknown, options?: RequestOptions & Limits) =>
  request<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    },
    options,
  );

/** The mock's stand-in for a request the form cancelled. */
function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new RequestAborted();
}

// ---------------------------------------------------------------------------
// Mock (no NEXT_PUBLIC_API_URL)
// ---------------------------------------------------------------------------

const MOCK_LATENCY_MS = 700;

/** Date ranges the mock treats as already booked, e.g. ["2026-11-26", "2026-11-29"]. */
const MOCK_BOOKED_RANGES: [IsoDate, IsoDate][] = [];

const delay = (ms = MOCK_LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

async function mockAvailability(request: AvailabilityRequest, signal?: AbortSignal): Promise<AvailabilityResult> {
  await delay();
  throwIfAborted(signal);
  const car = cars.find((item) => item.slug === request.carSlug);
  if (!car) throw new ApiError("We couldn’t find that car.", 422);

  const days = billedDays(request.pickupDate, request.pickupTime, request.returnDate, request.returnTime);
  const overlapsBooking = MOCK_BOOKED_RANGES.some(
    ([from, to]) => request.pickupDate <= to && request.returnDate >= from,
  );
  return {
    available: !overlapsBooking,
    days,
    pricePerDay: car.pricePerDay,
    totalUsd: days * car.pricePerDay,
  };
}

/**
 * The mock keeps requests made in this tab (sessionStorage), so the booking page shows what
 * was asked for; any other link gets a sample booking. Uploads are remembered, files dropped.
 */
const MOCK_STORE_KEY = "bueno:mock-bookings";

type MockBooking = Pick<
  BookingRequest,
  "carSlug" | "pickupDate" | "pickupTime" | "returnDate" | "returnTime" | "name" | "email" | "occasion"
> & {
  requestedAt: string;
  documents: BookingDetails["documents"];
};

function mockStore(): Record<string, MockBooking> {
  try {
    return JSON.parse(sessionStorage.getItem(MOCK_STORE_KEY) ?? "{}") as Record<string, MockBooking>;
  } catch {
    return {};
  }
}

function saveMockStore(store: Record<string, MockBooking>) {
  try {
    sessionStorage.setItem(MOCK_STORE_KEY, JSON.stringify(store));
  } catch {
    // Private mode or blocked storage: the booking page falls back to the sample.
  }
}

function mockBookingDetails(link: BookingLink): BookingDetails {
  const saved = mockStore()[link.bookingId];
  const car = cars.find((item) => item.slug === saved?.carSlug) ?? cars[0];
  const pickupDate = saved?.pickupDate ?? "2026-11-06";
  const pickupTime = saved?.pickupTime ?? site.booking.hours.defaultTime;
  const returnDate = saved?.returnDate ?? "2026-11-09";
  const returnTime = saved?.returnTime ?? site.booking.hours.defaultTime;
  const days = billedDays(pickupDate, pickupTime, returnDate, returnTime);
  const rentalUsd = days * car.pricePerDay;
  const taxRate = rentalTerms.taxRatePercent;
  const taxUsd = Math.round(rentalUsd * taxRate) / 100;
  const requestedAt = saved?.requestedAt ?? new Date().toISOString();

  return {
    bookingId: link.bookingId,
    status: "pending_deposit",
    firstName: saved?.name.trim().split(/\s+/)[0] ?? "there",
    email: saved?.email ?? "you@example.com",
    carSlug: car.slug,
    carName: car.fullName,
    pickupDate,
    pickupTime,
    returnDate,
    returnTime,
    occasion: saved?.occasion ?? null,
    requestedAt,
    holdEndsAt: new Date(new Date(requestedAt).getTime() + site.booking.holdHours * 3_600_000).toISOString(),
    holdExpired: false,
    days,
    pricePerDay: car.pricePerDay,
    rentalUsd,
    taxRate,
    taxUsd,
    acceptsUploads: true,
    documents: saved?.documents ?? { license: false, insurance: false },
    depositUsd: site.booking.depositUsd,
    awaitingDeposit: true,
    depositPaid: false,
    rentalTotalUsd: Math.round((rentalUsd + taxUsd) * 100) / 100,
    rentalDue: false,
    rentalPaid: false,
  };
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/** How long a form waits for an answer before it says so (user, 2026-10-31: 15 s). */
export const AVAILABILITY_TIMEOUT_MS = 15_000;

// POST /api/availability
export function checkAvailability(data: AvailabilityRequest, { signal }: RequestOptions = {}): Promise<AvailabilityResult> {
  // A check books nothing, so a timeout or a lost connection just asks to try again.
  const failed = `Couldn’t check dates. Try again or call us at ${site.phone.display}.`;
  return usesRealApi
    ? postJson("/availability", data, { signal, timeoutMs: AVAILABILITY_TIMEOUT_MS, timeoutMessage: failed, networkMessage: failed })
    : mockAvailability(data, signal);
}

type ApiBookingResult = Omit<BookingResult, "link"> & {
  link: { booking: string; expires: string; signature: string };
};

// POST /api/bookings
export async function submitBookingRequest(data: BookingRequest): Promise<BookingResult> {
  if (!usesRealApi) {
    await delay(1100);
    const bookingId = `mock-${Math.random().toString(36).slice(2, 8)}`;
    const { carSlug, pickupDate, pickupTime, returnDate, returnTime, name, email, occasion } = data;
    saveMockStore({
      ...mockStore(),
      [bookingId]: {
        carSlug,
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        name,
        email,
        occasion,
        requestedAt: new Date().toISOString(),
        documents: { license: false, insurance: false },
      },
    });
    return {
      bookingId,
      status: "pending_deposit",
      depositUsd: site.booking.depositUsd,
      link: { bookingId, expires: "0", signature: "mock" },
    };
  }

  const result = await postJson<ApiBookingResult>("/bookings", data, {
    // Longer than a check: the API stores the request and queues two emails. No answer does not
    // mean nothing arrived, so the message says how to find out before sending it twice.
    timeoutMs: 30_000,
    timeoutMessage: `We didn’t get an answer in time. Your request may still have arrived: check your email in a minute, or call ${site.phone.display} before sending it again.`,
  });
  const { booking, expires, signature } = result.link;
  return { ...result, link: { bookingId: booking, expires, signature } };
}

const bookingApiPath = (link: BookingLink) =>
  `/bookings/${encodeURIComponent(link.bookingId)}/upload?${new URLSearchParams({
    expires: link.expires,
    signature: link.signature,
  })}`;

// GET /api/bookings/{id}/upload?expires=…&signature=… (the customer's signed link)
export async function getBooking(link: BookingLink): Promise<BookingDetails> {
  if (!usesRealApi) {
    await delay();
    return mockBookingDetails(link);
  }
  return request(bookingApiPath(link), { method: "GET" }, { timeoutMs: 15_000 });
}

// POST /api/bookings/{id}/upload?expires=…&signature=… (multipart/form-data)
export async function uploadDocuments(link: BookingLink, files: DocumentUpload): Promise<BookingDetails> {
  if (!usesRealApi) {
    await delay(1100);
    // The mock drops the files: nothing is uploaded or stored anywhere.
    const store = mockStore();
    const before = mockBookingDetails(link).documents;
    const documents = {
      license: before.license || !!files.license,
      insurance: before.insurance || !!files.insurance,
    };
    if (store[link.bookingId]) saveMockStore({ ...store, [link.bookingId]: { ...store[link.bookingId], documents } });
    return { ...mockBookingDetails(link), documents };
  }

  const form = new FormData();
  if (files.license) form.append("license", files.license);
  if (files.insurance) form.append("insurance", files.insurance);
  // No Content-Type header: the browser adds the multipart boundary itself.
  return request(bookingApiPath(link), { method: "POST", body: form });
}

// POST /api/bookings/{id}/rental-payment (a confirmed booking: price plus tax)
export async function createRentalPaymentIntent(bookingId: string): Promise<DepositIntent> {
  if (!usesRealApi) {
    await delay();
    return { bookingId, amountUsd: 0, clientSecret: null };
  }
  return postJson(`/bookings/${encodeURIComponent(bookingId)}/rental-payment`, undefined, { timeoutMs: 15_000 });
}

// POST /api/bookings/{id}/deposit
export async function createDepositIntent(bookingId: string): Promise<DepositIntent> {
  if (!usesRealApi) {
    await delay();
    return { bookingId, amountUsd: site.booking.depositUsd, clientSecret: null };
  }
  return postJson(`/bookings/${encodeURIComponent(bookingId)}/deposit`, undefined, { timeoutMs: 15_000 });
}

export type ContactRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** What it is for: a value from contactTopics. */
  occasion: ContactTopic;
  /** Free text such as "Jul 3 – Jul 5"; may be empty. */
  preferredDates: string;
  /** Up to 2,000 characters. */
  message: string;
  /** Honeypot: hidden from people, left empty. The API drops messages that fill it. */
  company: string;
};

// POST /api/contact (emailed to the business, Reply-To the sender; 5 an hour per IP)
export async function sendContactMessage(data: ContactRequest): Promise<void> {
  if (!usesRealApi) {
    // The mock sends nothing anywhere.
    await delay(900);
    return;
  }
  await postJson("/contact", data, {
    timeoutMs: 20_000,
    timeoutMessage: `We didn’t get an answer in time. Your message may still have arrived; to be sure, call or text ${site.phone.display}.`,
  });
}
