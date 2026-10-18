import { cn } from "@/lib/utils";

/** The 𝔼: a double-struck E whose stem is drawn hollow (an outline you can see through, in the
 *  blue accent) and whose three bars are solid ink. Colours come from the brand tokens, so it follows dark mode.
 *  `mono` draws everything in currentColor (for a single-colour context: a stamp, a favicon
 *  on a coloured ground, a printout). */
export function MonteMark({
  size = 24,
  mono,
  className,
  title,
}: {
  /** Height in px, or a CSS length such as "0.72em" to sit in running text. Width is 0.7 × height.
   *  Below 14px use the favicon instead. */
  size?: number | string;
  mono?: boolean;
  className?: string;
  /** Pass a title when the mark stands alone; leave it out beside the wordmark. */
  title?: string;
}) {
  const stem = mono ? "currentColor" : "var(--m-accent)";
  const bar = mono ? "currentColor" : "var(--m-ink)";
  return (
    <svg
      viewBox="0 0 70 100"
      width={typeof size === "number" ? size * 0.7 : undefined}
      height={typeof size === "number" ? size : undefined}
      style={typeof size === "string" ? { height: size, width: `calc(${size} * 0.7)` } : undefined}
      className={cn("inline-block shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="3.5" y="3.5" width="19" height="93" fill="none" stroke={stem} strokeWidth="7" />
      <rect x="23" y="0" width="47" height="13" fill={bar} />
      <rect x="23" y="44" width="36" height="12" fill={bar} />
      <rect x="23" y="87" width="47" height="13" fill={bar} />
    </svg>
  );
}

export type BracketState = "rest" | "breathe" | "computing" | "resolved";

/** 𝔼[monte]. The lockup is always mark + brackets + lower-case name; never the name alone in
 *  a header, never with a different word inside the brackets (that's what <Expect> is for). */
export function Lockup({
  size = 22,
  state = "rest",
  showMark = true,
  className,
}: {
  /** Font size of the wordmark in px; the mark scales with it. */
  size?: number;
  state?: BracketState;
  showMark?: boolean;
  className?: string;
}) {
  const closeState = state === "resolved" ? "resolved" : state === "computing" ? "computing" : undefined;
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ fontSize: size, gap: size * 0.12 }}
      aria-label="Monte"
      role="img"
    >
      {showMark && <MonteMark size={size * 0.8} className="mr-[0.08em]" />}
      <span
        aria-hidden
        className={cn("inline-flex items-baseline", state === "breathe" && "m-breathe")}
        style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.05em", lineHeight: 1 }}
      >
        <span className="m-br" data-state={closeState}>
          [
        </span>
        <span style={{ color: "var(--m-ink)" }}>monte</span>
        <span className="m-br m-br-close" data-state={closeState}>
          ]
        </span>
      </span>
    </span>
  );
}
