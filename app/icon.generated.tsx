import { ImageResponse } from "next/og"

export const runtime = "edge"

export const size = {
  width: 64,
  height: 64,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          position: "relative",
          background: "transparent",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "12px",
            top: "10px",
            width: "18px",
            height: "18px",
            borderRadius: "9999px",
            background: "#EF4444",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "30px",
            top: "8px",
            width: "20px",
            height: "20px",
            borderRadius: "9999px",
            background: "#F59E0B",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "42px",
            top: "24px",
            width: "16px",
            height: "16px",
            borderRadius: "9999px",
            background: "#EAB308",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "22px",
            top: "26px",
            width: "22px",
            height: "22px",
            borderRadius: "9999px",
            background: "#22C55E",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "10px",
            top: "34px",
            width: "16px",
            height: "16px",
            borderRadius: "9999px",
            background: "#06B6D4",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "34px",
            top: "40px",
            width: "14px",
            height: "14px",
            borderRadius: "9999px",
            background: "#3B82F6",
          }}
        />
      </div>
    ),
    {
      width: 64,
      height: 64,
    }
  )
}
