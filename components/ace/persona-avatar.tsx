"use client";

/** Illustrated avatars for the sample households. Drawn, not photos: they're made up.
 *  Eyes blink on their own; the parent wiggles the avatar on hover (.m-ava). */

type Face = { x: number; y: number; r: number; skin: string; hair: string; kind: "short" | "bun" | "long" | "kid" | "kid2"; glasses?: boolean };

function Head({ x, y, r, skin, hair, kind, glasses }: Face) {
  const eyeY = y + r * 0.08;
  const eyeDx = r * 0.36;
  const eye = r * 0.11;
  return (
    <g>
      {kind === "long" && <path d={`M${x - r * 1.05} ${y} Q${x - r * 1.1} ${y + r * 1.25} ${x - r * 0.6} ${y + r * 1.15} L${x + r * 0.6} ${y + r * 1.15} Q${x + r * 1.1} ${y + r * 1.25} ${x + r * 1.05} ${y} Z`} fill={hair} />}
      {kind === "bun" && <circle cx={x + r * 0.15} cy={y - r * 1.12} r={r * 0.42} fill={hair} />}
      <circle cx={x} cy={y} r={r} fill={skin} />
      {/* hair cap */}
      <path
        d={
          kind === "short"
            ? `M${x - r} ${y - r * 0.05} Q${x - r * 1.05} ${y - r * 1.15} ${x} ${y - r * 1.08} Q${x + r * 1.1} ${y - r * 1.1} ${x + r} ${y - r * 0.1} Q${x + r * 0.55} ${y - r * 0.62} ${x - r * 0.1} ${y - r * 0.5} Q${x - r * 0.6} ${y - r * 0.45} ${x - r} ${y - r * 0.05} Z`
            : kind === "kid2"
              ? `M${x - r} ${y - r * 0.1} Q${x - r} ${y - r * 1.1} ${x} ${y - r * 1.05} Q${x + r} ${y - r * 1.1} ${x + r} ${y - r * 0.1} Q${x} ${y - r * 0.75} ${x - r} ${y - r * 0.1} Z`
              : `M${x - r * 1.02} ${y + r * 0.1} Q${x - r * 1.05} ${y - r * 1.1} ${x} ${y - r * 1.08} Q${x + r * 1.05} ${y - r * 1.1} ${x + r * 1.02} ${y + r * 0.1} Q${x + r * 0.7} ${y - r * 0.55} ${x} ${y - r * 0.6} Q${x - r * 0.7} ${y - r * 0.55} ${x - r * 1.02} ${y + r * 0.1} Z`
        }
        fill={hair}
      />
      <g className="m-eyes">
        <ellipse cx={x - eyeDx} cy={eyeY} rx={eye} ry={eye * 1.25} fill="#0e0f12" />
        <ellipse cx={x + eyeDx} cy={eyeY} rx={eye} ry={eye * 1.25} fill="#0e0f12" />
      </g>
      {glasses && (
        <g fill="none" stroke="#0e0f12" strokeWidth={r * 0.07}>
          <circle cx={x - eyeDx} cy={eyeY} r={r * 0.26} />
          <circle cx={x + eyeDx} cy={eyeY} r={r * 0.26} />
          <path d={`M${x - eyeDx + r * 0.26} ${eyeY} L${x + eyeDx - r * 0.26} ${eyeY}`} />
        </g>
      )}
      <circle cx={x - r * 0.55} cy={y + r * 0.38} r={r * 0.13} fill="#ff8a8a" opacity="0.45" />
      <circle cx={x + r * 0.55} cy={y + r * 0.38} r={r * 0.13} fill="#ff8a8a" opacity="0.45" />
      <path d={`M${x - r * 0.22} ${y + r * 0.42} Q${x} ${y + r * 0.62} ${x + r * 0.22} ${y + r * 0.42}`} fill="none" stroke="#0e0f12" strokeWidth={r * 0.08} strokeLinecap="round" />
    </g>
  );
}

function Body({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  return <path d={`M${x - w / 2} ${y + w * 0.9} Q${x - w / 2} ${y} ${x} ${y} Q${x + w / 2} ${y} ${x + w / 2} ${y + w * 0.9} Z`} fill={color} />;
}

export function PersonaAvatar({ id, size = 56 }: { id: string; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="m-ava shrink-0" aria-hidden>
      <defs>
        <clipPath id={`ava-${id}`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#ava-${id})`}>
        {id === "jordan" && (
          <>
            <rect width="64" height="64" fill="#e3e8ff" />
            <Body x={32} y={46} w={40} color="#2f45ff" />
            {/* hoodie strings */}
            <path d="M28 47 L27 55 M36 47 L37 55" stroke="#e3e8ff" strokeWidth="1.6" strokeLinecap="round" />
            <Head x={32} y={30} r={13} skin="#c98b62" hair="#24180f" kind="short" />
          </>
        )}
        {id === "maya" && (
          <>
            <rect width="64" height="64" fill="#eef0ff" />
            {/* a paper plane: she travels for work */}
            <path d="M47 11 L58 7 L52 17 L50.5 13.5 Z" fill="#ffffff" stroke="#2f45ff" strokeWidth="0.9" strokeLinejoin="round" className="m-plane" />
            <Body x={32} y={47} w={38} color="#0e0f12" />
            <path d="M24 49 Q32 55 40 49" fill="none" stroke="#8c9bff" strokeWidth="3.2" strokeLinecap="round" />
            <Head x={32} y={31} r={12.5} skin="#f1c7a3" hair="#5a2d1a" kind="bun" glasses />
          </>
        )}
        {id === "parks" && (
          <>
            <rect width="64" height="64" fill="#e3e8ff" />
            <Body x={20} y={44} w={22} color="#0e0f12" />
            <Body x={44} y={44} w={22} color="#2f45ff" />
            <Head x={20} y={31} r={8.5} skin="#e8b98f" hair="#111111" kind="short" />
            <Head x={44} y={31} r={8.5} skin="#e8b98f" hair="#1b1b1b" kind="long" />
            <Body x={26} y={54} w={14} color="#8c9bff" />
            <Body x={39} y={54} w={14} color="#2f45ff" />
            <Head x={26} y={47} r={6} skin="#eec39b" hair="#141414" kind="kid2" />
            <Head x={39} y={47} r={6} skin="#eec39b" hair="#141414" kind="bun" />
          </>
        )}
        {id === "sam" && (
          <>
            <rect width="64" height="64" fill="#eef0ff" />
            <Body x={32} y={47} w={38} color="#0e0f12" />
            {/* backpack straps: a student */}
            <path d="M23 49 L22 60 M41 49 L42 60" stroke="#8c9bff" strokeWidth="3" strokeLinecap="round" />
            <Head x={32} y={31} r={12.5} skin="#8d5a3b" hair="#1a120c" kind="kid2" />
          </>
        )}
        {id === "rosa" && (
          <>
            <rect width="64" height="64" fill="#e3f1fb" />
            {/* a sparkle: she runs a cleaning business */}
            <path d="M51 9 L52.6 13.4 L57 15 L52.6 16.6 L51 21 L49.4 16.6 L45 15 L49.4 13.4 Z" fill="#2f45ff" className="m-plane" />
            <Body x={32} y={47} w={38} color="#2f45ff" />
            <path d="M26 50 L26 60 L38 60 L38 50" fill="#ffffff" opacity="0.9" />
            <Head x={32} y={31} r={12.5} skin="#d9a27a" hair="#2b1a12" kind="long" />
          </>
        )}
      </g>
    </svg>
  );
}

/** What each household would say about its wallet, in the hand-note font beside the picked one. */
export const PERSONA_LINE: Record<string, string> = {
  jordan: "three cards, no idea which one to use",
  maya: "I want the points to pay for flights",
  parks: "two cards, and a balance we keep meaning to pay",
  sam: "one card. is that enough?",
  rosa: "some months are great, some aren't",
};
