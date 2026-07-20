import { ImageResponse } from "next/og";
import { redis } from "@/lib/redis";
import { isValidPid } from "@/lib/leaderboard-core";

export const alt = "Crush challenge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type PlayerHash = { initials?: string; best?: number | string; streak?: number | string };

// Dynamic unfurl card. Next auto-injects og:image / twitter:image from this file.
// ponytail: shows all-time best + streak from the pid hash — no extra storage.
// Per-run freshness deferred (crawlers cache og:image hard anyway).
export default async function Image({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  let name = "Crush";
  let best = "";
  let streak = 0;
  if (isValidPid(pid)) {
    const p = (await redis.hgetall(`player:${pid}`)) as PlayerHash | null;
    if (p && p.best != null) {
      name = String(p.initials || "player");
      best = (Number(p.best) || 0).toLocaleString();
      streak = Number(p.streak) || 0;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a2410 0%, #10140e 100%)",
          color: "#e8e8e0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 8, color: "#8fbf6a", display: "flex" }}>
          CRUSH · DAILY CHALLENGE
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, marginTop: 24, display: "flex" }}>{name}</div>
        {best ? (
          <div style={{ fontSize: 180, fontWeight: 900, color: "#a3d977", lineHeight: 1, display: "flex" }}>
            {best}
          </div>
        ) : (
          <div style={{ fontSize: 64, marginTop: 20, display: "flex" }}>Crush the horde</div>
        )}
        {streak > 0 && (
          <div style={{ fontSize: 44, marginTop: 24, color: "#e0b64e", display: "flex" }}>
            🔥 {streak} DAY STREAK
          </div>
        )}
        <div style={{ fontSize: 40, marginTop: 40, color: "#b5b5a8", display: "flex" }}>
          {best ? `Beat ${best} →` : "Play now →"}
        </div>
      </div>
    ),
    size,
  );
}
