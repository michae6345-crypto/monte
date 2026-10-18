"use client";

// The hero: real cards on a table, with rigid-body physics (Matter.js). Jordan's three cards
// drop on load, each carrying what it cost him; scrolling deals the rest of the market around
// them. With a mouse you can pick a card up and throw it. Touch only scrolls.

import Matter from "matter-js";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { receipt } from "@/lib/engine";
import { CardArt, shortName } from "./card-art";
import { money } from "./store";
import { Lockup } from "@/components/brand";

const MINE = JORDAN.wallet.map((h) => h.cardId);
// Jordan's first, then the market in the order it's dealt. Phones skip the last three.
const DECK = [
  ...MINE,
  "amex_platinum",
  "chase_sapphire_preferred",
  "capital_one_venture_x",
  "citi_double_cash",
  "discover_it_cash_back",
  "bilt_obsidian",
  "wells_fargo_autograph",
];
const PHONE_SKIP = new Set(["discover_it_cash_back", "bilt_obsidian", "wells_fargo_autograph"]);
const STEP = 1000 / 60;

/** Next frame, with a timer fallback for tabs that never paint (background, some projectors). */
function frame(cb: () => void) {
  let done = false;
  let b = 0;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(b);
    cb();
  };
  const a = requestAnimationFrame(run);
  b = window.setTimeout(run, 100);
  return () => {
    done = true;
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
  const [allDealt, setAllDealt] = useState(false);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const st = stage.current;
    const tr = track.current;
    if (!st || !tr) return;
    const { Engine, Bodies, Composite, Body, Constraint, Query, Sleeping } = Matter;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = rng(7);

    const engine = Engine.create({ gravity: { x: 0, y: 1.1 }, enableSleeping: true });
    let W = st.clientWidth;
    let H = st.clientHeight;
    const phone = () => W < 640;
    const cw = () => (phone() ? Math.max(104, W * 0.3) : Math.max(150, Math.min(220, W * 0.155)));
    let CW = cw();
    let CH = CW / 1.586;

    const walls: Matter.Body[] = [];
    const buildWalls = () => {
      Composite.remove(engine.world, walls.splice(0));
      const t = 400;
      walls.push(
        Bodies.rectangle(W / 2, H + t / 2 - 6, W * 3, t, { isStatic: true, friction: 0.9 }),
        Bodies.rectangle(-t / 2, H / 2 - 1200, t, H * 4 + 2400, { isStatic: true }),
        Bodies.rectangle(W + t / 2, H / 2 - 1200, t, H * 4 + 2400, { isStatic: true }),
      );
      Composite.add(engine.world, walls);
    };

    const bodies: (Matter.Body | null)[] = DECK.map(() => null);
    const shown: boolean[] = DECK.map(() => false);
    let firstLanded = false;
    const order = () => DECK.map((_, i) => i).filter((i) => !(phone() && PHONE_SKIP.has(DECK[i])));
    const live = () => bodies.filter((x): x is Matter.Body => !!x);

    const spawn = (i: number) => {
      if (bodies[i]) return;
      const mine = i < MINE.length;
      const x = mine ? W * (0.24 + i * 0.26) + (r() - 0.5) * 30 : CW / 2 + r() * (W - CW);
      const body = Bodies.rectangle(x, -CH - r() * 140, CW, CH, {
        chamfer: { radius: CW * 0.045 },
        restitution: 0.3,
        friction: 0.55,
        frictionAir: 0.014,
        density: 0.0022,
        angle: (r() - 0.5) * (mine ? 0.5 : 0.9),
        sleepThreshold: 50,
      });
      Body.setAngularVelocity(body, (r() - 0.5) * 0.1);
      Body.setVelocity(body, { x: (r() - 0.5) * 2.5, y: 2 + r() * 3 });
      bodies[i] = body;
      Composite.add(engine.world, body);
    };

    // ---- drag and throw, mouse only (touch keeps scrolling the page) ----
    let grab: Matter.Constraint | null = null;
    const local = (e: PointerEvent) => {
      const rc = st.getBoundingClientRect();
      return { x: e.clientX - rc.left, y: e.clientY - rc.top };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const p = local(e);
      const hit = Query.point(live(), p).pop();
      if (!hit) return;
      e.preventDefault();
      Sleeping.set(hit, false);
      grab = Constraint.create({
        pointA: p,
        bodyB: hit,
        pointB: { x: p.x - hit.position.x, y: p.y - hit.position.y },
        stiffness: 0.2,
        damping: 0.1,
        length: 0,
      });
      Composite.add(engine.world, grab);
      st.style.cursor = "grabbing";
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const p = local(e);
      if (grab) {
        grab.pointA = p;
        wake();
        return;
      }
      st.style.cursor = Query.point(live(), p).length ? "grab" : "";
    };
    const onUp = () => {
      if (!grab) return;
      Composite.remove(engine.world, grab);
      grab = null;
      st.style.cursor = "";
    };
    if (!reduce) {
      st.addEventListener("pointerdown", onDown);
      st.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("blur", onUp);
    }

    // ---- painting ----
    const paint = () => {
      const placed: { x: number; y: number; w: number }[] = [];
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
        if (!tg) return;
        if (!shown[i] && bd.speed < 0.6 && bd.position.y > 0) {
          shown[i] = true;
          if (!firstLanded) {
            firstLanded = true;
            setLanded(true);
          }
        }
        else if (shown[i] && bd.speed > 6) shown[i] = false;
        // above the card's top edge, kept on screen and clear of the other tags
        const w = tg.offsetWidth || 220;
        const top = bd.position.y - Math.abs(Math.sin(bd.angle)) * (CW / 2) - Math.abs(Math.cos(bd.angle)) * (CH / 2) - 10;
        const x = Math.max(8 + w / 2, Math.min(W - 8 - w / 2, bd.position.x));
        let y = Math.max(CH * 0.25, top);
        for (const p of placed) if (Math.abs(p.x - x) < (p.w + w) / 2 + 6 && Math.abs(p.y - y) < 30) y = p.y - 32;
        placed.push({ x, y, w });
        tg.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
        tg.style.opacity = shown[i] ? "1" : "0";
      });
    };

    const settle = () => {
      for (const i of order()) spawn(i);
      for (let s = 0; s < 900; s++) Engine.update(engine, STEP);
    };

    const size = () => {
      W = st.clientWidth;
      H = st.clientHeight;
      if (W < 60 || H < 60) return;
      const next = cw();
      if (Math.abs(next - CW) > 8) {
        const s = next / CW;
        live().forEach((bd) => Body.scale(bd, s, s));
        CW = next;
        CH = CW / 1.586;
      }
      els.current.forEach((el) => el && (el.style.width = `${CW}px`));
      buildWalls();
      // keep every card inside the new walls
      live().forEach((bd) => {
        const x = Math.max(CW / 2, Math.min(W - CW / 2, bd.position.x));
        const y = Math.min(H - CH / 2, bd.position.y);
        if (x !== bd.position.x || y !== bd.position.y) {
          Body.setPosition(bd, { x, y });
          Sleeping.set(bd, false);
        }
      });
      if (reduce) settle();
      else wake();
      paint();
    };

    // which cards the scroll position has dealt (Jordan's are dealt on load)
    const want = () => {
      const rect = tr.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 1;
      const ids = order();
      const extra = ids.length - MINE.length;
      return ids.slice(0, MINE.length + Math.floor(Math.min(1, p / 0.75) * extra + 1e-6));
    };

    let cancel = () => {};
    let running = false;
    let visible = true;
    let last = performance.now();
    let acc = 0;
    let lastSpawn = 0;
    let finished = false;

    const loop = () => {
      running = false;
      if (!visible) return;
      const now = performance.now();
      if (W < 60 || H < 60) {
        size();
        last = now;
        running = true;
        cancel = frame(loop);
        return;
      }
      for (const i of want()) {
        if (!bodies[i] && now - lastSpawn > 150) {
          spawn(i);
          lastSpawn = now;
        }
      }
      const done = order().every((i) => bodies[i]);
      if (done !== finished) {
        finished = done;
        setAllDealt(done);
      }
      acc += Math.min(100, now - last);
      last = now;
      let n = 0;
      while (acc >= STEP && n < 3) {
        Engine.update(engine, STEP);
        acc -= STEP;
        n++;
      }
      if (n === 3) acc = 0;
      paint();
      const asleep = live().every((bd) => bd.isSleeping);
      if (asleep && done && !grab) return; // rest until scrolling, a drag or a resize wakes us
      running = true;
      cancel = frame(loop);
    };
    function wake() {
      if (running || reduce) return;
      running = true;
      last = performance.now();
      cancel = frame(loop);
    }

    buildWalls();
    els.current.forEach((el) => el && (el.style.width = `${CW}px`));
    if (reduce) {
      size();
      settle();
      paint();
      cancel = frame(() => setAllDealt(true));
    } else wake();

    const onScroll = () => wake();
    window.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(size);
    ro.observe(st);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) wake();
    });
    io.observe(tr);

    return () => {
      cancel();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      st.removeEventListener("pointerdown", onDown);
      st.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onUp);
      Engine.clear(engine);
    };
  }, []);

  // the same scroll the hint asks for: to where the deal finishes (p = 0.75 in want())
  const dealRest = () => {
    const tr = track.current;
    if (!tr) return;
    const span = tr.offsetHeight - window.innerHeight;
    const top = tr.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + span * 0.8, behavior: "smooth" });
  };

  return (
    <div ref={track} id="top" className="relative h-[175svh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div ref={stage} className="absolute inset-0 touch-pan-y select-none">
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
                className="pointer-events-none absolute left-0 top-0 whitespace-nowrap transition-opacity duration-300"
                style={{ opacity: 0 }}
              >
                <span className={`m-tag ${i % 2 ? "m-tag-r" : ""}`}>
                  <span className="hidden sm:inline">{shortName(id)} </span>
                  <span className={tags[id].tone === "gain" ? "text-ace-gain" : "text-ace-loss"}>
                    {tags[id].text.split(" ")[0]}
                  </span>{" "}
                  <span className="hidden sm:inline">{tags[id].text.split(" ").slice(1).join(" ")}</span>
                  <span className="sm:hidden">{tags[id].text.split(" ")[1]}</span>
                </span>
              </div>
            ) : null,
          )}
        </div>

        <div className="pointer-events-none relative z-10 mx-auto max-w-5xl px-5 pt-24 text-center md:pt-28">
          <div className="mb-6 flex justify-center">
            <Lockup size={30} state={landed ? "resolved" : "breathe"} />
          </div>
          <h1 className="text-[12.5vw] sm:text-7xl md:text-[6.4rem]">
            Every card,{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span
                className="relative z-10"
                style={{ fontFamily: "var(--m-font-note)", fontVariationSettings: '"INFM" 100, "BNCE" 30', fontWeight: 600, letterSpacing: "-0.01em" }}
              >
                played right.
              </span>
              <svg viewBox="0 0 300 24" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-[0.12em] left-[-2%] h-[0.32em] w-[104%]" aria-hidden>
                <motion.path
                  d="M4 15 C 60 6, 140 4, 210 9 S 280 16, 296 8"
                  fill="none"
                  strokeWidth={7}
                  strokeLinecap="round"
                  style={{ stroke: "var(--m-accent)" }}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: landed ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
                />
              </svg>
            </span>
          </h1>
          <div className="pointer-events-auto mt-8 flex flex-wrap justify-center gap-3">
            <a href="#money" className="btn btn-primary">
              See it work <span aria-hidden>→</span>
            </a>
            <a href="#register" className="btn btn-ghost">
              Try a tap
            </a>
          </div>
          <button
            type="button"
            onClick={dealRest}
            className="m-deal pointer-events-auto mt-7 transition-opacity"
            style={{ opacity: allDealt ? 0 : 1, pointerEvents: allDealt ? "none" : undefined }}
            tabIndex={allDealt ? -1 : 0}
          >
            scroll to deal the rest of the market <span aria-hidden className="m-deal-arrow">↓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
