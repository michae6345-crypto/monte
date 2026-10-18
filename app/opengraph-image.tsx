import { ImageResponse } from "next/og";

// The link preview (Devpost, iMessage, Slack): the 𝔼 mark, the wordmark and the line.
export const alt = "Monte: every card, played right.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  const ink = "#0e0f12";
  const blue = "#2f45ff";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", background: "#f7f8fa", color: ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* the 𝔼: hollow blue stem, three ink bars */}
          <div style={{ display: "flex", position: "relative", width: 56, height: 80 }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 18, height: 80, border: `6px solid ${blue}` }} />
            <div style={{ position: "absolute", left: 18, top: 0, width: 38, height: 11, background: ink }} />
            <div style={{ position: "absolute", left: 18, top: 35, width: 29, height: 10, background: ink }} />
            <div style={{ position: "absolute", left: 18, top: 69, width: 38, height: 11, background: ink }} />
          </div>
          <div style={{ display: "flex", fontSize: 64, letterSpacing: "-0.04em" }}>
            <span style={{ color: "#a3a7af" }}>[</span>
            <span>monte</span>
            <span style={{ color: blue }}>]</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 104, lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 600 }}>
          <span>Every card,</span>
          <span style={{ borderBottom: `10px solid ${blue}`, alignSelf: "flex-start", paddingBottom: 6 }}>played right.</span>
        </div>
        <div style={{ display: "flex", marginTop: 44, fontSize: 30, color: ink }}>
          What your credit cards really cost, the right card for every purchase, and 1,000 simulated years.
        </div>
      </div>
    ),
    size,
  );
}
