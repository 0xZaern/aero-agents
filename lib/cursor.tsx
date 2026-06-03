"use client";

import { createContext, useContext, ReactNode } from "react";

type Variant = "default" | "hover" | "card";
const CursorContext = createContext<{ setVariant: (v: Variant) => void }>({ setVariant: () => {} });
export const useCursor = () => useContext(CursorContext);

/**
 * Kept for API compatibility. The custom follower cursor was removed in favour
 * of the native arrow (theme-tinted in globals.css), so these handlers are now
 * no-ops - spreading them onto elements stays harmless.
 */
export function useCursorHover(variant: Variant = "hover") {
  const { setVariant } = useCursor();
  return {
    onMouseEnter: () => setVariant(variant),
    onMouseLeave: () => setVariant("default"),
  };
}

export function CursorProvider({ children }: { children: ReactNode }) {
  return <CursorContext.Provider value={{ setVariant: () => {} }}>{children}</CursorContext.Provider>;
}
