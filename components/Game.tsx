"use client";

import { useEffect, useRef } from "react";
import { startGame } from "@/game/engine";

export default function Game() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // startGame appends its own <canvas> to the container and returns a
    // disposer. Returning it from useEffect kills the RAF loop, listeners,
    // and GL context on unmount — required for React StrictMode double-mount.
    return startGame(ref.current);
  }, []);

  return <div ref={ref} />;
}
