"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { LenisProvider } from "@/lib/lenis";
import { CursorProvider } from "@/lib/cursor";
import ConnectModal from "@/components/ConnectModal";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LenisProvider>
        <CursorProvider>
          {children}
          <ConnectModal />
        </CursorProvider>
      </LenisProvider>
    </ThemeProvider>
  );
}
