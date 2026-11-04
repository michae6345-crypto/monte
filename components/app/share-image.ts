"use client";

// "What my cards made (or cost) me": a 1080x1350 image of the year's totals, drawn on a canvas in
// the browser. Totals only: no purchases, no stores, no card numbers.

export type YearTotals = { net: number; rewards: number; credits: number; fees: number; interest: number; left: number; purchases: number; cards: number };

const usd = (n: number, sign = false) => (n < 0 ? "−" : sign && n > 0 ? "+" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function yearImage(t: YearTotals): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const font = (w: number, px: number) => `${w} ${px}px "Google Sans Flex", system-ui, -apple-system, "Segoe UI", sans-serif`;
  const mono = (px: number) => `500 ${px}px ui-monospace, "Geist Mono", Menlo, monospace`;
  const ink = "#0e0f12";
  const slate = "#6b6f78";
  const gain = "#1f7a4d";
  const loss = "#c2412d";

  // the paper
  g.fillStyle = "#f7f8fa";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#ffffff";
  roundRect(g, 70, 70, W - 140, H - 140, 36);
  g.fill();

  // the mark: a blue outlined stem and three ink bars (public/brand/favicon.svg), then the word
  const mx = 130;
  const my = 130;
  const k = 0.62;
  g.strokeStyle = "#2f45ff";
  g.lineWidth = 9 * k;
  g.strokeRect(mx + 3.5 * k, my + 3.5 * k, 19 * k, 93 * k);
  g.fillStyle = ink;
  g.fillRect(mx + 23 * k, my, 47 * k, 15 * k);
  g.fillRect(mx + 23 * k, my + 43 * k, 36 * k, 14 * k);
  g.fillRect(mx + 23 * k, my + 85 * k, 47 * k, 15 * k);
  g.font = font(500, 46);
  g.fillText("monte", mx + 70, my + 50);

  g.fillStyle = slate;
  g.font = mono(26);
  g.fillText("MY CARDS, LAST 12 MONTHS", 130, 300);

  g.fillStyle = t.net >= 0 ? gain : loss;
  g.font = font(500, 150);
  g.fillText(usd(t.net, true), 124, 450);
  g.fillStyle = slate;
  g.font = font(400, 36);
  g.fillText(t.net >= 0 ? "what they made me, after fees and interest" : "what they cost me, after every reward", 130, 510);

  // the lines
  const rows: [string, number, string][] = [
    ["rewards", t.rewards, gain],
    ["perks used", t.credits, gain],
    ["annual fees", -t.fees, loss],
    ["interest", -t.interest, loss],
  ];
  let y = 630;
  g.font = mono(34);
  for (const [label, v, color] of rows) {
    g.fillStyle = slate;
    g.fillText(label, 130, y);
    g.fillStyle = Math.abs(v) < 0.005 ? slate : color;
    const s = Math.abs(v) < 0.005 ? "$0.00" : usd(v, true);
    g.fillText(s, W - 130 - g.measureText(s).width, y);
    g.fillStyle = "#e4e6ea";
    g.fillRect(130, y + 26, W - 260, 2);
    y += 82;
  }

  if (t.left > 0.5) {
    g.fillStyle = "#eef0ff";
    roundRect(g, 130, y + 10, W - 260, 150, 24);
    g.fill();
    g.fillStyle = ink;
    g.font = font(500, 40);
    g.fillText(`${usd(t.left)} left on the table`, 170, y + 78);
    g.fillStyle = slate;
    g.font = font(400, 30);
    g.fillText("the right card every time, with the cards I already have", 170, y + 126);
  }

  g.fillStyle = slate;
  g.font = mono(26);
  g.fillText(`${t.purchases.toLocaleString()} purchases · ${t.cards} card${t.cards === 1 ? "" : "s"}`, 130, H - 190);
  g.fillStyle = ink;
  g.font = font(500, 32);
  g.fillText("Every dollar, played right.", 130, H - 140);
  g.fillStyle = "#2f45ff";
  g.font = mono(26);
  const url = "ace-eta-beryl.vercel.app/app";
  g.fillText(url, W - 130 - g.measureText(url).width, H - 140);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Share sheet where there is one (phones), else a download. */
export async function shareYear(t: YearTotals) {
  const blob = await yearImage(t);
  const file = new File([blob], "my-cards-monte.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "What my cards made me", text: "Every dollar, played right." });
    return "shared";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "downloaded";
}
