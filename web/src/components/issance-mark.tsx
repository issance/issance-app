import type { CSSProperties } from "react";
import markUrl from "./issance-mark.png";

export interface CollieMarkProps {
  size?: number;
  loading?: boolean;
  paper?: string;
  title?: string;
  className?: string;
  weight?: "full" | "header";
}

// The issance sigil. One transparent PNG used as a mask, so the mark takes the text colour like the
// rest of the interface. While loading it breathes; under reduced motion it only changes colour.
const KEYFRAMES_ID = "issance-mark-keyframes";
if (typeof document !== "undefined" && !document.getElementById(KEYFRAMES_ID)) {
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent =
    "@keyframes issance-mark-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.94)}}" +
    "@media (prefers-reduced-motion: reduce){.issance-mark{animation:none!important}}";
  document.head.append(style);
}

export function CollieMark({ size = 32, loading = false, title, className }: CollieMarkProps) {
  const mask = `url(${markUrl})`;
  const style: CSSProperties = {
    width: size,
    height: size,
    display: "inline-block",
    flex: "none",
    backgroundColor: loading ? "var(--primary, currentColor)" : "currentColor",
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    animation: loading ? "issance-mark-breathe 1.6s ease-in-out infinite" : undefined,
  };
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={["issance-mark", className].filter(Boolean).join(" ")}
      style={style}
    />
  );
}
