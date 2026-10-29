import { AbsoluteFill } from "remotion";
import { useLayout } from "../theme";

/**
 * Text block in the lower part of the frame. On a phone it stays above the bottom fifth,
 * where Reels and TikTok draw their captions and buttons.
 */
export const Caption: React.FC<{ children: React.ReactNode; gap?: number; lift?: number }> = ({ children, gap = 14, lift = 0 }) => {
  const { height: H, portrait } = useLayout();
  return (
    <AbsoluteFill
      style={{
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
        textAlign: "center",
        gap,
        paddingBottom: H * ((portrait ? 0.24 : 0.13) + lift),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Center: React.FC<{ children: React.ReactNode; gap?: number; style?: React.CSSProperties }> = ({
  children,
  gap = 18,
  style,
}) => (
  <AbsoluteFill style={{ flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap, ...style }}>
    {children}
  </AbsoluteFill>
);

/** Font size that fits `text` into `max` pixels for heavy capitals (about 0.7 em a letter). */
export const fit = (text: string, base: number, max: number, em = 0.7) => Math.min(base, max / (text.length * em));
