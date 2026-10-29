import { at, FPS } from "./timing";
import lengths from "./voiceover.json";

// Where each voice-over line (scripts/voiceover.mjs) starts, in bars of the cut, and how much
// it is sped up to end before the next scene (the render keeps the pitch).
const cues: { id: keyof typeof lengths; bar: number; rate?: number }[] = [
  { id: "place", bar: 0.15 },
  { id: "arrive", bar: 2 },
  { id: "entrance", bar: 3 }, // ends just before the drop
  { id: "brand", bar: 5 },
  { id: "power", bar: 6, rate: 1.25 },
  { id: "sprint", bar: 9, rate: 1.1 },
  { id: "model", bar: 11 },
  { id: "leather", bar: 13 },
  { id: "occasions", bar: 14 },
  { id: "any", bar: 15.5 },
  { id: "price", bar: 16.25 },
  { id: "book", bar: 18.05 },
  { id: "sign", bar: 20.05 },
];

export const voiceCues = cues.map((c) => {
  const rate = c.rate ?? 1;
  const from = at(c.bar);
  return { ...c, rate, from, frames: Math.ceil((lengths[c.id] / rate) * FPS) };
});

/** Music level: dipped under each line, with short ramps either side. */
export const musicUnderVoice = (frame: number) => {
  let level = 1;
  for (const c of voiceCues) {
    const down = Math.min(1, Math.max(0, (frame - (c.from - 4)) / 4));
    const up = Math.min(1, Math.max(0, (c.from + c.frames + 8 - frame) / 8));
    level = Math.min(level, 1 - 0.6 * Math.min(down, up));
  }
  return level;
};
