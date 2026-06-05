"use client";

/** aero wordmark - "æro" set in Prata (high-contrast Didone), reads as "aero". */
export default function Logo() {
  return (
    <span
      style={{
        fontFamily: "var(--font-prata)",
        fontWeight: 400,
        fontSize: "2rem",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      æro
    </span>
  );
}
