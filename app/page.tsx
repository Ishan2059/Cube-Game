import Game from "@/components/Game";

export default function Home() {
  return (
    <>
      <div id="hud">
        <div id="hud-left">
          <div id="score">0</div>
          <div id="best">BEST 0</div>
          <div id="combo-wrap">
            <div id="combo-label"></div>
            <div id="combo-bar-outer">
              <div id="combo-bar"></div>
            </div>
          </div>
        </div>
        <div id="hud-center">
          <div id="rampage-banner">RAMPAGE!</div>
          <div id="streak"></div>
          <div id="warning">LATCHED! Roll toward that side to crush it</div>
        </div>
        <div id="hud-right">
          <div id="lives"></div>
        </div>
      </div>

      <div id="vignette"></div>
      <div id="damage-flash"></div>
      <div id="popups"></div>

      <div id="start-screen" className="overlay">
        <h1>CRUSH</h1>
        <p className="tagline">Parasites climb. You are heavy. Do the math.</p>
        <p className="controls">
          Arrow keys / WASD to roll &nbsp;·&nbsp; land on parasites to squash them
        </p>
        <p className="controls warn">
          If one latches onto a side of you, roll TOWARD that side to grind it
          into the ground.
        </p>
        <button id="start-btn">ROLL OUT</button>
      </div>

      <div id="gameover-screen" className="overlay hidden">
        <h1>OVERRUN</h1>
        <p id="final-score"></p>
        <p id="final-best"></p>
        <p id="final-stats"></p>
        <button id="restart-btn">CRUSH AGAIN (R)</button>
      </div>

      <Game />
    </>
  );
}
