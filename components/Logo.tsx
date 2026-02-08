import Link from "next/link";

type Props = {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
};

const iconSizes = {
  sm: 28,
  md: 36,
  lg: 44,
};

const textSizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

export function Logo({ href = "/", className = "", size = "md", variant = "dark" }: Props) {
  const isLight = variant === "light";
  const iconSize = iconSizes[size];
  const strokeColor = isLight ? "#ffffff" : "#1a1a1a";
  const dotColor = isLight ? "#93c5fd" : "#0066ff";
  const textClass = isLight ? "text-white" : "text-[#1a1a1a]";
  const aiClass = isLight ? "text-blue-200" : "text-primary";

  const icon = (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className="shrink-0"
      width={iconSize}
      height={iconSize}
      aria-hidden
    >
      {/* Thick concentric arcs - ring open at top */}
      <path
        d="M 32 12 A 14 14 0 1 1 8 12 A 14 14 0 0 1 32 12"
        fill="none"
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 28.5 14.5 A 9 9 0 1 0 11.5 14.5 A 9 9 0 0 0 28.5 14.5"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Crosshair - horizontal and vertical lines */}
      <path
        d="M 20 10 L 20 30 M 10 20 L 30 20"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Central blue dot */}
      <circle cx="20" cy="20" r="4" fill={dotColor} />
      {/* Antenna / signal lines at top */}
      <path
        d="M 16 6 Q 14 2 11 4 M 24 6 Q 26 2 29 4"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {icon}
      <span className={`font-semibold tracking-tight ${textSizes[size]}`}>
        <span className={textClass}>bugScout</span>
        <span className={aiClass}>AI</span>
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }
  return content;
}
