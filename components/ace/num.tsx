"use client";

import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { money } from "./store";

/** A dollar figure. Renders its real value from the first paint (and on the server); when the
 *  value changes, it counts from the old one to the new one. */
export function Num({ value, sign, cents, className }: { value: number; sign?: boolean; cents?: boolean; className?: string }) {
  const mv = useMotionValue(value);
  const prev = useRef(value);
  const text = useTransform(mv, (v) => money(v, { sign, cents }));
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const c = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}
