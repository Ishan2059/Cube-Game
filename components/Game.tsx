"use client";

import { useEffect, useRef } from "react";
import { startGame } from "@/game/engine";
import { preloadTrailArt } from "@/game/trail-art";
import { preloadWorldArt } from "@/game/terrain";
import { preloadSkinArt } from "@/game/skin-materials";

export default function Game() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled=false;
    let dispose: (()=>void) | undefined;
    const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>("#start-screen button"));
    for(const button of buttons){button.disabled=true;button.setAttribute("aria-busy","true");}
    void Promise.all([preloadSkinArt(),preloadWorldArt(),preloadTrailArt()]).then(()=>{
      if(cancelled||!ref.current)return;
      dispose=startGame(ref.current);
      for(const button of buttons){button.disabled=false;button.removeAttribute("aria-busy");}
    });
    return()=>{cancelled=true;dispose?.();};
  }, []);

  return <div ref={ref} />;
}
