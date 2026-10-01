import React from "react";
import { PenLine } from "lucide-react";

export default function ComposeIcon({
  size = 20,
  className,
  style,
  strokeWidth = 2,
  "aria-hidden": ariaHidden = true,
}) {
  return (
    <PenLine
      size={size}
      className={className}
      style={style}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
    />
  );
}
