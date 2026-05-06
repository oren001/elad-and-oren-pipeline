import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon192() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, #5fa05a 0%, #2d6628 40%, #0a1908 100%)",
          color: "#e7f3e6",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          fontFamily: "sans-serif",
        }}
      >
        ה
      </div>
    ),
    { ...size },
  );
}
