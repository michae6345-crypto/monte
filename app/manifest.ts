import type { MetadataRoute } from "next";

// Add to Home Screen opens straight into the app, full screen, like a wallet app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Monte: the right card, every time you pay",
    short_name: "Monte",
    description: "Names the card to use wherever you pay, counting interest as well as points.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#f7f8fa",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
