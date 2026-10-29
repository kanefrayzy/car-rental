"use client";

import { useEffect, useState } from "react";
import type { BookingLink } from "./api";

/**
 * The link to the visitor's latest booking page, kept in this browser so the header can
 * offer "My booking" without the email. Only the signed link is stored, the same one the
 * email carries; it stops working on its own after the API's link lifetime (7 days).
 */
const KEY = "bueno:my-booking";
const CHANGED = "bueno:my-booking-changed";

function expired(link: BookingLink): boolean {
  const expires = Number(link.expires);
  // The mock's links have no expiry ("0").
  return expires > 0 && expires * 1000 < Date.now();
}

export function readSavedBooking(): BookingLink | null {
  try {
    const link = JSON.parse(localStorage.getItem(KEY) ?? "null") as BookingLink | null;
    if (!link?.bookingId || !link.expires || !link.signature) return null;
    if (expired(link)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return link;
  } catch {
    return null;
  }
}

export function saveBooking(link: BookingLink) {
  try {
    localStorage.setItem(KEY, JSON.stringify(link));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Storage blocked: the email still has the link.
  }
}

export function forgetBooking(bookingId: string) {
  try {
    if (readSavedBooking()?.bookingId !== bookingId) return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Nothing stored, nothing to forget.
  }
}

/** The saved link, or null. Null during server render and hydration, then read from storage. */
export function useSavedBooking(): BookingLink | null {
  const [link, setLink] = useState<BookingLink | null>(null);

  useEffect(() => {
    const update = () => setLink(readSavedBooking());
    update();
    // Other tabs (storage) and this tab (CHANGED) both update the header.
    window.addEventListener("storage", update);
    window.addEventListener(CHANGED, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(CHANGED, update);
    };
  }, []);

  return link;
}
