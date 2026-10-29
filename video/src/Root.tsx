import { Composition } from "remotion";
import { Promo } from "./Promo";
import { DURATION, FPS } from "./timing";

// 9:16 for Reels, TikTok and Shorts (the clips are generated vertical). Promo-VO is the same
// cut with a female voice-over (voice.ts).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Promo-9x16" component={Promo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    <Composition id="Promo-VO-9x16" component={Promo} defaultProps={{ voice: true }} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
  </>
);
