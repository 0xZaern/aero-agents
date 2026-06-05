"use client";

import { ReactNode, CSSProperties, MouseEvent } from "react";

interface Props {
  children: ReactNode;
  href?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** kept for API compatibility; the magnetic follow was removed */
  strength?: number;
}

/** Plain button/link. (The cursor-follow "magnetic" drift was removed.) */
export default function MagneticButton({ children, href = "#", className = "", style, onClick }: Props) {
  return (
    <a href={href} className={className} style={style} onClick={onClick}>
      {children}
    </a>
  );
}
