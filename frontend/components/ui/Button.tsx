import type { ButtonHTMLAttributes } from "react";
import { SpinnerIcon } from "./icons";

type Variant = "primary" | "outline";
type Size = "sm" | "md" | "lg";
type Shape = "rounded" | "pill";

export type ButtonStyle = {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  block?: boolean;
};

// Every button gives feedback: it lifts and darkens on hover, presses in on click, and
// shows a spinner while busy.
const base =
  "inline-flex items-center justify-center gap-2 font-sans font-medium whitespace-nowrap select-none transition-[background-color,border-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-deep text-white shadow-btn hover:bg-brand-press hover:shadow-[0_12px_24px_-8px_rgb(5_102_251/0.7)]",
  outline:
    "border border-line-strong bg-card text-brand-deep hover:border-brand-deep hover:bg-tint/50 hover:shadow-card",
};

const sizes: Record<Size, string> = {
  sm: "h-[2.6875rem] px-[1.875rem] text-sm", // 43: header pill
  md: "h-12 px-7 text-[0.9375rem]", // 48
  lg: "h-14 px-8 text-base", // 56: full-width mobile actions
};

/** Class string for a button look. Use on <a> when the action is a link. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  shape = "rounded",
  block = false,
}: ButtonStyle = {}) {
  const radius =
    shape === "pill" ? "rounded-full" : size === "lg" ? "rounded-btn-lg" : "rounded-btn";
  return `${base} ${variants[variant]} ${sizes[size]} ${radius} ${block ? "w-full" : ""}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyle & {
    /** Shows a spinner and blocks further clicks while an action is running. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  shape,
  block,
  loading = false,
  disabled,
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClasses({ variant, size, shape, block })} ${className}`}
      {...props}
    >
      {loading && <SpinnerIcon className="text-[1.15em]" />}
      {children}
    </button>
  );
}
