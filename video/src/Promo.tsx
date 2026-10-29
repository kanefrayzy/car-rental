import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Logo } from "./components/Logo";
import { Drop } from "./scenes/Drop";
import { Finale } from "./scenes/Finale";
import { Intro } from "./scenes/Intro";
import { Model } from "./scenes/Model";
import { Occasions } from "./scenes/Occasions";
import { Price } from "./scenes/Price";
import { Specs } from "./scenes/Specs";
import { at, AUDIO_START, DURATION, END, FPS } from "./timing";
import { color } from "./theme";
import { musicUnderVoice, voiceCues } from "./voice";

// The cut, bar by bar, on the soundtrack's grid (timing.ts): [first bar, last bar, scene].
const scenes: [number, number, React.FC][] = [
  [0, 4, Intro],
  [4, 6, Drop],
  [6, 10, Specs],
  [10, 14, Model],
  [14, 16, Occasions],
  [16, 18, Price],
  [18, END, Finale],
];

/** `voice`: the second cut, with the voice-over (voice.ts) and the music dipped under it. */
export const Promo: React.FC<{ voice?: boolean }> = ({ voice = false }) => (
  <AbsoluteFill style={{ backgroundColor: color.night }}>
    {scenes.map(([from, to, Scene]) => (
      <Sequence key={from} from={at(from)} durationInFrames={at(to) - at(from)} name={Scene.name}>
        <Scene />
      </Sequence>
    ))}
    <Sequence from={at(6)} durationInFrames={at(18) - at(6)} name="Watermark">
      <Watermark />
    </Sequence>
    <Audio
      src={staticFile("music.mp3")}
      startFrom={Math.round(AUDIO_START * FPS)}
      // 0.85: the track is mastered to 0 dBFS; this keeps the true peak under -1 dB.
      volume={(f) =>
        0.85 *
        interpolate(f, [DURATION - 30, DURATION - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
        (voice ? musicUnderVoice(f) : 1)
      }
    />
    {voice &&
      voiceCues.map((c) => (
        <Sequence key={c.id} from={c.from} durationInFrames={c.frames} name={`VO ${c.id}`}>
          <Audio src={staticFile(`vo/${c.id}.wav`)} playbackRate={c.rate} />
        </Sequence>
      ))}
  </AbsoluteFill>
);

/** The logo, small, at the top while the car is on screen. */
const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 0.9], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 120, opacity }}>
      <Logo width={230} animate={false} />
    </AbsoluteFill>
  );
};
