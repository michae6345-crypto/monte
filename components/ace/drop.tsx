"use client";

// The hero: real cards dealt onto the table with rigid-body physics (Matter.js). A few fall on
// load; the rest are dealt as you scroll, Jordan's three last, each carrying what it cost him.
// On a mouse you can pick a card up and throw it.

import Matter from "matter-js";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { receipt } from "@/lib/engine";
import { useBrand } from "./brands";
import { CardArt, shortName } from "./card-art";
import { money } from "./store";

const DECK = [
  "amex_platinum",
  "chase_sapphire_preferred",
  "capital_one_venture_x",
  "citi_double_cash",
  "discover_it_cash_back",
  "bilt_obsidian",
  "wells_fargo_autograph",
  ...JORDAN.wallet.map((h) => h.cardId),
];
const ON_LOAD = 4;

function frame(cb: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  const a = requestAnimationFrame(run);
  const b = window.setTimeout(run, 40);
  return () => {
    cancelAnimationFrame(a);
    clearTimeout(b);
  };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function DropHero() {
  const { brand: b } = useBrand();
  const txns = useMemo(() => yearOf(JORDAN), []);
  const jr = useMemo(() => receipt(JORDAN.wallet, txns), [txns]);
  const tags = useMemo(() => {
    const m: Record<string, { text: string; tone: "gain" | "loss" }> = {};
    for (const c of jr.perCard) {
      if (c.interest > 0) m[c.cardId] = { text: `${money(-c.interest, { sign: true })} interest`, tone: "loss" };
      else if (c.fee > 0) m[c.cardId] = { text: `${money(-c.fee, { sign: true })} fee · ${money(c.credits)} perks used`, tone: "loss" };
      else m[c.cardId] = { text: `${money(c.rewards, { sign: true })} rewards`, tone: "gain" };
    }
    return m;
  }, [jr]);

  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const tagEls = useRef<(HTMLDivElement | null)[]>([]);
  const [dealt, setDealt] = useState(0);

  useEffect(() => {
    const st = stage.current;
    const tr = track.current;
    if (!st || !tr) return;
    const { Engine, Bodies, Composite, Body, Mouse, MouseConstraint, Events } = Matter;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const r = rng(7);

    const engine = Engine.create({ gravity: { x: 0, y: 1.1 } });
    let W = st.clientWidth;
    let H = st.clientHeight;
    const cw = () => (W < 640 ? Math.max(104, W * 0.29) : Math.max(150, Math.min(220, W * 0.155)));
    let CW = cw();
    let CH = CW / 1.586;

    const walls: Matter.Body[] = [];
    const buildWalls = () => {
      Composite.remove(engine.world, walls.splice(0));
      const t = 200;
      walls.push(
        Bodies.rectangle(W / 2, H + t / 2 - 6, W * 3, t, { isStatic: true, friction: 0.9 }),
        Bodies.rectangle(-t / 2, H / 2 - 1000, t, H * 4 + 2000, { isStatic: true }),
        Bodies.rectangle(W + t / 2, H / 2 - 1000, t, H * 4 + 2000, { isStatic: true }),
      );
      Composite.add(engine.world, walls);
    };
    buildWalls();

    const bodies: (Matter.Body | null)[] = DECK.map(() => null);
    const shown: boolean[] = DECK.map(() => false);
    const skip = (i: number) => W < 640 && i < 3;
    const spawn = (i: number) => {
      if (bodies[i] || skip(i)) return;
      const jordan = i >= DECK.length - JORDAN.wallet.length;
      const k = i - (DECK.length - JORDAN.wallet.length);
      const x = jordan ? W * (0.3 + k * 0.2) + (r() - 0.5) * 40 : CW / 2 + r() * (W - CW);
      const body = Bodies.rectangle(x, -CH - r() * 160, CW, CH, {
        chamfer: { radius: CW * 0.045 },
        restitution: 0.32,
        friction: 0.55,
        frictionAir: 0.014,
        density: 0.0022,
        angle: (r() - 0.5) * 0.9,
      });
      Body.setAngularVelocity(body, (r() - 0.5) * 0.12);
      Body.setVelocity(body, { x: (r() - 0.5) * 3, y: 2 + r() * 3 });
      bodies[i] = body;
      Composite.add(engine.world, body);
    };

    let mc: Matter.MouseConstraint | null = null;
    if (fine && !reduce) {
      const mouse = Mouse.create(st);
      // Matter's mouse swallows the wheel; give scrolling back to the page.
      const mm = mouse as unknown as { mousewheel: EventListener };
      st.removeEventListener("wheel", mm.mousewheel);
      st.removeEventListener("mousewheel", mm.mousewheel);
      st.removeEventListener("DOMMouseScroll", mm.mousewheel);
      mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.1 } });
      Composite.add(engine.world, mc);
      Events.on(mc, "startdrag", () => (st.style.cursor = "grabbing"));
      Events.on(mc, "enddrag", () => (st.style.cursor = ""));
    }

    const paint = () => {
      bodies.forEach((bd, i) => {
        const el = els.current[i];
        if (!el) return;
        if (!bd) {
          el.style.opacity = "0";
          return;
        }
        el.style.opacity = "1";
        el.style.transform = `translate3d(${bd.position.x - CW / 2}px, ${bd.position.y - CH / 2}px, 0) rotate(${bd.angle}rad)`;
        const tg = tagEls.current[i];
        if (tg) {
          // show once the card comes to rest; hide only while it's being thrown around
          if (!shown[i] && bd.speed < 0.5 && bd.position.y > 0) shown[i] = true;
          else if (shown[i] && bd.speed > 6) shown[i] = false;
          const top = Math.max(CH * 0.2, bd.position.y - Math.abs(Math.sin(bd.angle)) * (CW / 2) - Math.abs(Math.cos(bd.angle)) * (CH / 2) - 10);
          tg.style.transform = `translate3d(${bd.position.x}px, ${top}px, 0) translate(-50%, -100%)`;
          tg.style.opacity = shown[i] ? "1" : "0";
        }
      });
    };

    const size = () => {
      W = st.clientWidth;
      H = st.clientHeight;
      const next = cw();
      if (Math.abs(next - CW) > 8) {
        const s = next / CW;
        bodies.forEach((bd) => bd && Body.scale(bd, s, s));
        CW = next;
        CH = CW / 1.586;
        els.current.forEach((el) => el && (el.style.width = `${CW}px`));
      }
      buildWalls();
    };
    els.current.forEach((el) => el && (el.style.width = `${CW}px`));

    // how many cards the scroll position has dealt
    const target = () => {
      const rect = tr.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 1;
      return Math.min(DECK.length, ON_LOAD + Math.floor((p / 0.7) * (DECK.length - ON_LOAD) + 1e-6));
    };

    let n = 0;
    let cancel = () => {};
    let alive = true;
    let last = performance.now();
    let stagger = 0;

    if (reduce) {
      for (let i = 0; i < DECK.length; i++) spawn(i);
      for (let s = 0; s < 900; s++) Engine.update(engine, 1000 / 60);
      n = DECK.length;
      cancel = frame(() => setDealt(DECK.length));
      paint();
    } else {
      const loop = () => {
        if (!alive) return;
        const now = performance.now();
        // a tab opened in the background can have no size yet: wait for one
        if (W < 60 || H < 60) {
          if (st.clientWidth >= 60 && st.clientHeight >= 60) size();
          last = now;
          cancel = frame(loop);
          return;
        }
        const want = target();
        if (n < want && now - stagger > 140) {
          spawn(n++);
          stagger = now;
          setDealt(n);
        }
        const dt = Math.min(1000 / 30, now - last);
        last = now;
        Engine.update(engine, dt);
        paint();
        cancel = frame(loop);
      };
      cancel = frame(loop);
    }

    const ro = new ResizeObserver(size);
    ro.observe(st);
    return () => {
      alive = false;
      cancel();
      ro.disconnect();
      if (mc) Composite.remove(engine.world, mc);
      Engine.clear(engine);
    };
  }, []);

  const lost = Math.round(-jr.net);

  return (
    <div ref={track} id="top" className="relative h-[210svh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div ref={stage} className="absolute inset-x-0 bottom-0 top-0 touch-pan-y">
          {DECK.map((id, i) => (
            <div
              key={id}
              ref={(el) => {
                els.current[i] = el;
              }}
              className="absolute left-0 top-0 will-change-transform"
              style={{ opacity: 0, transformOrigin: "50% 50%" }}
            >
              <CardArt id={id} size="md" className="pointer-events-none" />
            </div>
          ))}
          {DECK.map((id, i) =>
            tags[id] ? (
              <div
                key={"t" + id}
                ref={(el) => {
                  tagEls.current[i] = el;
                }}
                className={`mono pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md border bg-ace-panel px-2.5 py-1 text-[12px] shadow-sm transition-opacity duration-300 ${
                  tags[id].tone === "gain" ? "border-ace-gain/40 text-ace-gain" : "border-ace-loss/40 text-ace-loss"
                }`}
                style={{ opacity: 0 }}
              >
                <span className="text-ace-dim">{shortName(id)}</span> {tags[id].text}
              </div>
            ) : null,
          )}
        </div>

        <div className="pointer-events-none relative z-10 mx-auto max-w-5xl px-5 pt-24 text-center md:pt-28">
          <h1 className="text-[9.5vw] font-semibold leading-[1] tracking-[-0.045em] sm:text-5xl md:text-[4.1rem]">
            Your cards are costing you.
            <span className="block text-ace-dim">{b.name} shows exactly how much.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ace-dim md:text-lg">
            {JORDAN.name}&apos;s three cards paid him <Tone tone="gain">{money(jr.rewards + jr.credits)}</Tone> last year and charged him{" "}
            <Tone tone="loss">{money(jr.fees + jr.interest)}</Tone> in fees and interest. Net{" "}
            <Tone tone="loss">−${lost.toLocaleString()}</Tone>.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap justify-center gap-3">
            <a href="#receipt" className="rounded-md bg-ace-ink px-5 py-3 font-medium text-ace-bg transition hover:bg-ace-gold">
              Read {JORDAN.name}&apos;s receipt
            </a>
            <a href="#tap" className="rounded-md border border-ace-line bg-ace-panel px-5 py-3 text-ace-ink transition hover:border-ace-ink/40">
              Try a tap
            </a>
          </div>
          <p className="mono mt-6 text-[11px] uppercase tracking-[0.2em] text-ace-dim transition-opacity" style={{ opacity: dealt >= DECK.length ? 0 : 1 }}>
            scroll to deal {JORDAN.name}&apos;s hand ↓
          </p>
        </div>
      </div>
    </div>
  );
}

function Tone({ tone, children }: { tone: "gain" | "loss"; children: ReactNode }) {
  return <span className={`tnum font-medium ${tone === "gain" ? "text-ace-gain" : "text-ace-loss"}`}>{children}</span>;
}
