/**
 * Heading with Playfair Display italic for the first designer line.
 * Matches UXBoost-style typography for headings.
 */
export function HeadingPlayfair({
  firstLine,
  secondLine,
  as: Tag = "h1",
  size = "xl",
  className = "",
}: {
  firstLine: string;
  secondLine?: string;
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "text-2xl sm:text-3xl",
    md: "text-3xl sm:text-4xl md:text-5xl",
    lg: "text-4xl sm:text-5xl md:text-6xl",
    xl: "text-4xl sm:text-5xl md:text-6xl",
    "2xl": "text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem]",
  };

  return (
    <Tag className={`leading-[1.15] tracking-tight text-gray-900 ${sizeClasses[size]} ${className}`}>
      <span className="font-playfair italic">{firstLine}</span>
      {secondLine && (
        <>
          <br />
          <span className="font-bold">{secondLine}</span>
        </>
      )}
    </Tag>
  );
}
