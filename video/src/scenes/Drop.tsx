import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Clip } from "../components/Clip";
import { Flash, Shake, Streaks } from "../components/Fx";
import { Logo } from "../components/Logo";
import { LogoPortal } from "../components/Transitions";
import { Kicker } from "../components/Type";
import { business } from "../data";
import { BEAT, within } from "../timing";
import { logoAspect } from "../../../frontend/components/ui/logoPaths";
import { color, useLayout } from "../theme";
import { burnoutContinues } from "./Intro";
import { firstSpecShot } from "./Specs";

// Bars 4-6, the drop. The logo slams in letter by letter over the burnout smoke; in the last
// half bar the first spec shot appears inside the letters and the camera flies through one.
const t = within(4);

export const Drop: React.FC = () => {
  const frame = useCurrentFrame();
  const { height: H } = useLayout();
  const centerY = H * 0.42;
  const portal = { fill: t(1.5), fly: t(1.72), end: t(2) };
  // The portal draws its own copy of the logo; the swap happens in one frame, under a flash.
  const hide = frame < portal.fill ? 1 : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: color.night }}>
      <Clip name="rear-burnout" from={burnoutContinues} brightness={0.42} shade={0.5} push={0.08} />
      <Streaks count={10} seed="drop" opacity={0.6} />
      <Shake hits={[0, t(1)]} strength={30}>
        <AbsoluteFill style={{ opacity: hide }}>
          <AbsoluteFill style={{ alignItems: "center", paddingTop: centerY - 900 / logoAspect / 2 }}>
            <Logo width={900} stagger={BEAT / 2} />
          </AbsoluteFill>
          <Sequence from={t(1)}>
            <AbsoluteFill style={{ alignItems: "center", paddingTop: centerY + 150 }}>
              <Kicker size={30} color={color.white}>
                {business.tagline}
              </Kicker>
            </AbsoluteFill>
          </Sequence>
        </AbsoluteFill>
      </Shake>
      <LogoPortal width={900} centerY={centerY} {...portal}>
        <Sequence from={portal.fill} layout="absolute-fill">
          <Clip
            name={firstSpecShot.clip}
            from={firstSpecShot.at - (portal.end - portal.fill) / 30}
            brightness={1}
            shade={0}
            push={0}
          />
        </Sequence>
      </LogoPortal>
      <Flash length={12} />
      <Sequence from={t(1)}>
        <Flash length={6} strength={0.5} />
      </Sequence>
      <Sequence from={portal.fill}>
        <Flash length={5} strength={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
};
