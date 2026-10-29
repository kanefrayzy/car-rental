// The cut follows the soundtrack, design/generated/audio/minimax-cinetrap.mp3 (MiniMax Music
// 2.6, chosen by the user on 2026-10-16). Measured from the file: phrases of 8 bars, the drop
// enters at 13.97 s after a silence and the next section at 41.83 s, 16 bars later, so a bar
// is 1.741 s (137.9 BPM). The video starts 4 bars before the drop and ends after the hit that
// follows the second silence (41.01-41.83 s in the track, bar 19.5-20 of the video).
export const FPS = 30;
export const BAR_SECONDS = (41.828 - 13.973) / 16;
const DROP_IN_TRACK = 14.04; // first downbeat of the drop
export const AUDIO_START = DROP_IN_TRACK - 4 * BAR_SECONDS;

/** Frame of a bar (zero-based, may be fractional) plus beats into it. */
export const at = (bar: number, beat = 0) => Math.round((bar + beat / 4) * BAR_SECONDS * FPS);
/** Frames between two bar positions. */
export const span = (from: number, to: number) => at(to) - at(from);

export const BAR = BAR_SECONDS * FPS; // 52.2 frames
export const BEAT = BAR / 4; // 13.1 frames

export const DROP = 4; // bar
export const SILENCE = 19.49; // bar where the track goes quiet before the last hit
export const FINAL_HIT = 20;
export const END = 21.5;
export const DURATION = at(END);

/** Frames from the start of a scene at bar `base` to a bar (plus beats) inside it. */
export const within = (base: number) => (bar: number, beat = 0) => at(base + bar, beat) - at(base);
