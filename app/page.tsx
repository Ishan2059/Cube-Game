import Game from "@/components/Game";

export default function Home() {
  return (
    <>
      <div id="hud">
        <div id="hud-left">
          <div id="score">0</div>
          <div id="best">BEST 0</div>
          <div id="level">LVL 1 · SPROUT</div>
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
          <div id="warning">LATCHED! Roll toward that side to crush it — or it bites</div>
        </div>
        <div id="hud-right">
          <div id="lives"></div>
        </div>
      </div>

      <button id="pause-btn" aria-label="Pause">❚❚</button>

      <div id="vignette"></div>
      <div id="damage-flash"></div>
      <div id="bite-glow"></div>
      <div id="popups"></div>
      <div id="levelup"></div>

      <div id="start-screen" className="overlay">
        <div className="hero">
          <h1>CRUSH</h1>
          <p className="tagline">Parasites climb. You are heavy. Do the math.</p>
        </div>

        <div className="how">
          <div className="hint">
            <span className="keys">
              <kbd>←</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd>
            </span>
            <span>
              Roll to move — land on parasites to squash them.
              <span className="sub">On mobile, swipe to roll.</span>
            </span>
          </div>
          <div className="hint">
            <span className="hint-icon">⚠</span>
            <span>
              If one latches on, roll <b>toward</b> that side to grind it off —
              or it <b>bites</b> after a moment, chipping your health. Grab the
              rare <b>♥</b> on the map to heal.
            </span>
          </div>
        </div>

        <button id="start-btn">ROLL OUT</button>
      </div>

      <div id="pause-screen" className="overlay hidden">
        <h1>PAUSED</h1>
        <p className="tagline">Take a breath. The horde waits.</p>
        <button id="resume-btn">RESUME</button>
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
