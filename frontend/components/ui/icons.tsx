import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path d="M6.6 2.5c.5 0 .9.3 1.1.8l1.5 3.6c.2.5.1 1-.3 1.4L7.2 10c1.200 2.800 3.600 5.300 6.800 6.800l1.700-1.700c.4-.4.9-.5 1.400-.3l3.600 1.500c.5.200.8.600.8 1.100v2.700c0 .800-.700 1.400-1.500 1.400C10.300 21 3 13.700 2.500 4c0-.800.600-1.500 1.400-1.500h2.700Z" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.500" y="5" width="17" height="15.500" rx="2.500" />
      <path d="M3.500 10h17M8 3v4M16 3v4" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5.500" width="18" height="13" rx="2.500" />
      <path d="m4 7.500 8 5.500 8-5.500" />
    </Icon>
  );
}

/** A speech bubble: "Text us". */
export function MessageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.500 4.500h13a2 2 0 0 1 2 2v8.500a2 2 0 0 1-2 2H11l-4.500 3.500V17H5.500a2 2 0 0 1-2-2V6.500a2 2 0 0 1 2-2Z" />
      <path d="M8 9.500h8M8 12.500h5" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.500" />
      <path d="M12 7.500V12l3 2" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.500 6.500h17M3.500 12h17M3.500 17.500h17" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="m5.500 5.500 13 13M18.500 5.500l-13 13" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.500 12h15M13.500 6l6 6-6 6" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="m5 12.500 4.500 4.500L19 7.500" />
    </Icon>
  );
}

/** Busy indicator for buttons. The label next to it also changes, so it is decorative. */
export function SpinnerIcon({ className = "", ...props }: IconProps) {
  return (
    <Icon strokeWidth={2.5} className={`animate-spin ${className}`} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Icon>
  );
}

/** Solid map pin with a punched-out centre. Tip is at the bottom centre of the box. */
export function PinIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path
        fillRule="evenodd"
        d="M12 23.500c-.400 0-.700-.200-1-.500C8.400 20 4.500 15 4.500 10.200 4.500 5.900 7.800 2.500 12 2.500s7.500 3.400 7.500 7.700c0 4.800-3.900 9.800-6.500 12.800-.300.300-.600.500-1 .500Zm0-10.200a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path d="M12 2.800 14.800 8.600l6.300.900-4.600 4.400 1.100 6.300L12 17.200l-5.600 3 1.100-6.300L2.900 9.500l6.300-.900L12 2.800Z" />
    </Icon>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.500" y="3.500" width="17" height="17" rx="4.500" />
      <circle cx="12" cy="12" r="3.800" />
      <circle cx="16.900" cy="7.100" r="0.900" fill="currentColor" stroke="none" />
    </Icon>
  );
}
