"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { analyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics";

/** The opt-out switch on /privacy: says whether analytics is on in this browser and flips it. */
export function AnalyticsChoice() {
  const [off, setOff] = useState<boolean | null>(null);
  const [gpc, setGpc] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setOff(analyticsOptedOut());
    setGpc(!!(navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (off === null) return null;
  if (gpc) return <p role="status">Your browser sends Global Privacy Control, so analytics is off here.</p>;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p role="status" className="mt-0!">
        Analytics is <strong>{off ? "off" : "on"}</strong> in this browser.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setAnalyticsOptOut(!off);
          setOff(!off);
        }}
      >
        {off ? "Turn analytics back on" : "Turn analytics off"}
      </Button>
    </div>
  );
}
