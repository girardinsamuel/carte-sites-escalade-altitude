import type { SiteKind } from "../data/types";

const PATHS: Record<SiteKind, string> = {
  climbing:
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  via_ferrata:
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM8.6 6.6h6.8v1.7H8.6zm0 3.4h6.8v1.7H8.6z",
  mountain:
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 5.4l3.8 6.4H8.2z",
};

/** Pictogramme du marqueur de carte pour un type de site. */
export function KindGlyph({
  kind,
  color = "currentColor",
  size = 12,
}: {
  kind: SiteKind;
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d={PATHS[kind]} fill={color} fillRule="evenodd" />
    </svg>
  );
}
