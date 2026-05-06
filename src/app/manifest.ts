import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "הלווינים",
    short_name: "הלווינים",
    description: "החדר של הלווינים — צ'אט, ציורים, ומסטולון",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a1908",
    theme_color: "#0a1908",
    orientation: "portrait",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon1",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon1",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

