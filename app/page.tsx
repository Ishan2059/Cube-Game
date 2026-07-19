import Game from "@/components/Game";

export default function Home() {
  return (
    <>
      <div id="hud">
        <div id="hud-left">
          <div id="score">0</div>
          <div id="best">BEST 0</div>
          <div id="level">LVL 1 · SPROUT</div>
          <div id="buffs"></div>
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
      <div id="poison-glow"></div>
      <div id="popups"></div>
      <div id="levelup"></div>
      <div id="toast"></div>

      {/* ============ START / HOME ============ */}
      <div id="start-screen" className="overlay">
        <div className="screen-scroll start-scroll">
          <div className="start-topbar">
            <div className="topbar-group">
              <span className="brand">
                <span className="mini-cube brand-cube"></span>
                <span className="brand-name">CRUSH</span>
              </span>
              <div className="pill coin-pill">
                <span className="coin-disc"></span>
                <span className="pill-value gold" id="menu-coins">0</span>
              </div>
            </div>
            <div className="topbar-group">
              <div className="pill">
                <span className="pill-label">BEST</span>
                <span className="pill-value" id="menu-best">0</span>
              </div>
              <button id="top-gear" className="icon-btn round" aria-label="Settings">⚙</button>
            </div>
          </div>

          <div className="start-body">
            <div className="start-hero-cube">
              <div className="hero-cube-wrap">
                <div className="hero-glow"></div>
                <div className="hero-cube" id="hero-cube"></div>
              </div>
              <div className="skin-chip">
                SKIN · <b id="hero-skin-label">ROCKY</b>
              </div>
            </div>

            <div className="start-main">
              <h1>CRUSH</h1>
              <div className="hazard-stripe"></div>
              <p className="tagline sub">
                Parasites climb. You are heavy. <b>Do the math.</b>
              </p>
          <p id="streak-nudge"></p>
              <p className="tagline-mono">ROLL · SMASH · RAMPAGE</p>

              <div className="menu-actions">
                <button id="start-btn" className="btn primary big">
                  <span className="btn-glyph">▶</span> ROLL OUT
                </button>
                <div className="tile-grid">
                  <button id="shop-btn" className="tile">
                    <span className="tile-icon">
                      <span className="mini-cube"></span>
                    </span>
                    <span className="tile-label">SKINS</span>
                  </button>
                  <button id="board-btn" className="tile stub">
                    <span className="tile-icon ranks-icon">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                    <span className="tile-label">RANKS</span>
                  </button>
                  <button id="howto-btn" className="tile">
                    <span className="tile-icon guide-icon">?</span>
                    <span className="tile-label">GUIDE</span>
                  </button>
                  <button id="settings-btn" className="tile">
                    <span className="tile-icon gear-icon">⚙</span>
                    <span className="tile-label">SETTINGS</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ HOW TO PLAY / GUIDE ============ */}
      <div id="howto-screen" className="overlay hidden">
        <div className="screen-scroll top-anchored">
          <div className="screen-head">
            <button id="howto-back" className="icon-btn" aria-label="Back">‹</button>
            <h2 className="screen-title">HOW TO PLAY</h2>
          </div>

          <div className="card">
            <div className="group-label in-card">CONTROLS</div>
            <div className="controls-flex">
              <div className="dpad">
                <span></span>
                <span className="dpad-key">↑</span>
                <span></span>
                <span className="dpad-key">←</span>
                <span className="dpad-center">
                  <span className="mini-cube tiny"></span>
                </span>
                <span className="dpad-key">→</span>
                <span></span>
                <span className="dpad-key">↓</span>
                <span></span>
              </div>
              <p>
                Roll to move — land on parasites to squash them. On mobile,{" "}
                <b>swipe</b> to roll. Desktop: arrows / WASD, <b>P</b> to
                pause.
              </p>
            </div>
          </div>

          <div className="warn-card">
            <span className="warn-icon">⚠</span>
            <p>
              <b className="warn-title">LATCHED!</b> Roll <b>toward</b> that
              side to grind it off — or it <b>bites</b>, chipping your health.
            </p>
          </div>

          <div className="group-block">
            <div className="group-label">POWER-UPS — GRAB THESE</div>
            <div className="powerup-cards">
              <div className="powerup-card">
                <span className="powerup-icon bolt">⚡</span>
                <b>SPEED</b>
                <span>Roll fast for 10s</span>
              </div>
              <div className="powerup-card">
                <span className="powerup-icon star">★</span>
                <b>GIANT</b>
                <span>Crush 3×3 for 8s</span>
              </div>
              <div className="powerup-card">
                <span className="powerup-icon heart">♥</span>
                <b>HEAL</b>
                <span>Restores one heart</span>
              </div>
            </div>
            <p className="powerup-note">
              Power-ups pulse with a bright beacon on the ground and blink
              before vanishing — detour for them.
            </p>
          </div>

          <div className="group-block">
            <div className="group-label">THE BESTIARY — TAP A BUG</div>
            <div id="bestiary" className="bestiary"></div>
            <p className="powerup-note">
              Beware spider <b>webs</b> that slow you and scorpion{" "}
              <b>poison</b> that drains health over time. The rare <b>♥</b> on
              the map heals.
            </p>
          </div>
        </div>
      </div>

      {/* ============ SHOP / SKINS ============ */}
      <div id="shop-screen" className="overlay hidden">
        <div className="screen-scroll top-anchored">
          <div className="screen-head">
            <button id="shop-back" className="icon-btn" aria-label="Back">‹</button>
            <h2 className="screen-title">SKINS</h2>
            <div className="pill coin-pill head-pill">
              <span className="coin-disc"></span>
              <span className="pill-value gold" id="shop-coins">0</span>
            </div>
          </div>

          <div className="seg-tabs">
            <button className="seg active">SKINS</button>
            <button className="seg stub" id="tab-trails">TRAILS</button>
            <button className="seg stub" id="tab-auras">AURAS</button>
          </div>

          <div id="skin-list"></div>

          <p className="shop-hint">
            Earn coins by crushing parasites. Skins are cosmetic — pure drip.
          </p>
        </div>
      </div>

      {/* ============ SETTINGS ============ */}
      <div id="settings-screen" className="overlay hidden">
        <div className="screen-scroll top-anchored">
          <div className="screen-head spread">
            <h2 className="screen-title">SETTINGS</h2>
            <button id="settings-back" className="icon-btn" aria-label="Close">✕</button>
          </div>

          <div className="card">
            <button id="set-sound" className="setting-row">
              <span className="setting-name"><i className="row-glyph">♪</i>Sound FX</span>
              <span className="switch"><span className="knob"></span></span>
            </button>
          </div>

          <div className="group-block">
            <div className="group-label">CONTROLS</div>
            <div className="seg-tabs">
              <button className="seg active">SWIPE</button>
              <button className="seg stub" id="ctl-dpad">D-PAD</button>
              <button className="seg stub" id="ctl-tilt">TILT</button>
            </div>
          </div>

          <div className="group-block">
            <div className="group-label">GAMEPLAY</div>
            <div className="card">
              <button id="set-difficulty" className="setting-row">
                <span className="setting-name">Difficulty</span>
                <span className="seg-mini">
                  <span className="seg-opt" data-v="normal">NORMAL</span>
                  <span className="seg-opt" data-v="casual">CASUAL</span>
                </span>
              </button>
              <button id="set-haptics" className="setting-row">
                <span className="setting-name">Haptics / Vibration</span>
                <span className="switch"><span className="knob"></span></span>
              </button>
              <button id="set-colorblind" className="setting-row">
                <span className="setting-name">Colorblind Mode</span>
                <span className="switch"><span className="knob"></span></span>
              </button>
            </div>
          </div>

          <button id="reset-progress" className="btn danger">⟲ RESET PROGRESS</button>
          <p className="footer-note">
            Desktop: arrows / WASD · P or Esc to pause · Mobile: hold &amp;
            drag to roll
          </p>
        </div>
      </div>

      {/* ============ PAUSE ============ */}
      <div id="pause-screen" className="overlay translucent hidden">
        <div className="screen-scroll">
          <div className="pause-card">
            <div className="pause-head">
              <span className="pause-bars"><span></span><span></span></span>
              <h1>PAUSED</h1>
            </div>
            <p className="tagline">Take a breath. The horde waits.</p>

            <div className="pause-stats">
              <div className="ps-cell">
                <span className="ps-label">SCORE</span>
                <span className="ps-value" id="pause-score">0</span>
              </div>
              <span className="ps-div"></span>
              <div className="ps-cell">
                <span className="ps-label">BUGS</span>
                <span className="ps-value" id="pause-bugs">0</span>
              </div>
              <span className="ps-div"></span>
              <div className="ps-cell">
                <span className="ps-label">COMBO</span>
                <span className="ps-value venom" id="pause-combo">×0</span>
              </div>
            </div>

            <button id="resume-btn" className="btn primary big">
              <span className="btn-glyph">▶</span> RESUME
            </button>
            <div className="btn-row">
              <button id="pause-restart" className="btn secondary">
                <span className="row-glyph venom-glyph">⟳</span> RESTART
              </button>
              <button id="pause-settings" className="btn secondary">
                <span className="row-glyph venom-glyph">⚙</span> SETTINGS
              </button>
              <button id="pause-menu" className="btn danger">
                ⏻ QUIT
              </button>
            </div>
            <button id="pause-howto" className="pause-link">
              HOW TO PLAY →
            </button>
          </div>
        </div>
      </div>

      {/* ============ GAME OVER ============ */}
      <div id="gameover-screen" className="overlay danger-tint hidden">
        <div className="screen-scroll">
          <h1>OVERRUN</h1>
          <div className="hazard-stripe danger"></div>
          <p id="final-stats" className="cause-line"></p>

          <div className="final-block">
            <div id="newbest-chip" className="newbest hidden">★ NEW BEST</div>
            <div className="final-label">FINAL SCORE</div>
            <div id="final-score" className="final-score">0</div>
          </div>

          <div className="stat-grid">
            <div className="stat-cell">
              <span>LEVEL</span><b id="go-level">1</b>
            </div>
            <div className="stat-cell">
              <span>BUGS</span><b id="go-bugs">0</b>
            </div>
            <div className="stat-cell">
              <span>BEST</span><b id="final-best">0</b>
            </div>
            <div className="stat-cell">
              <span>COINS</span>
              <b className="gold coin-earn">
                <span className="coin-disc small"></span>
                <span id="final-coins">+0</span>
              </b>
            </div>
          </div>

          <label id="initials-label">
            USERNAME
            <input
              id="initials-input"
              maxLength={12}
              autoComplete="off"
              placeholder="player"
            />
          </label>

          <div id="leaderboard" className="hidden"></div>

          <div className="menu-actions">
            <button id="restart-btn" className="btn primary big">
              <span className="btn-glyph">⟳</span> CRUSH AGAIN{" "}
              <span className="key-hint">(R)</span>
            </button>
            <div className="btn-row">
              <button id="gameover-menu" className="btn secondary">
                <span className="row-glyph venom-glyph">⌂</span> HOME
              </button>
              <button id="gameover-ranks" className="btn secondary">
                LEADERBOARD
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ BESTIARY MODAL ============ */}
      <div id="beast-modal" className="modal hidden">
        <div className="modal-card">
          <button id="beast-close" className="icon-btn modal-close" aria-label="Close">✕</button>
          <div className="modal-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img id="beast-img" alt="" />
          </div>
          <div id="beast-title" className="modal-title"></div>
          <p id="beast-desc" className="modal-desc"></p>
        </div>
      </div>

      <Game />
    </>
  );
}
