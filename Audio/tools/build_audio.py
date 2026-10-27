"""Original CubeCrush sound design. Rebuild with Python 3.12 and requirements.txt.

No recordings, network calls, sample packs, or generative service are used.
Each variant has a stable seed. All paths are relative to this Audio folder.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
TAU = 2 * np.pi
CATALOG: list[dict] = []
BUFFERS: dict[str, np.ndarray] = {}


def seed_for(name):
    return int.from_bytes(hashlib.sha256(name.encode()).digest()[:8], "little")


class Voice:
    def __init__(self, duration, seed):
        self.x = np.zeros(round(duration * SR))
        self.rng = np.random.default_rng(seed)

    def add(self, x, at=0, gain=1):
        start = round(at * SR)
        count = min(len(x), len(self.x) - start)
        if count > 0:
            self.x[start:start + count] += x[:count] * gain

    def tone(self, frequency, end=None, dur=.15, decay=.045, gain=1,
             at=0, attack=.002, partials=(1, .12), fm=0):
        t = np.arange(round(dur * SR)) / SR
        end = frequency if end is None else end
        f = frequency * (end / frequency) ** (t / max(dur, .001))
        phase = TAU * np.cumsum(f) / SR
        if fm:
            phase += fm * np.sin(phase * 1.47) * np.exp(-t / .045)
        y = sum(a * np.sin(phase * (i + 1)) for i, a in enumerate(partials))
        env = (1 - np.exp(-t / attack)) * np.exp(-t / decay)
        fade = min(len(t), round(.012 * SR))
        env[-fade:] *= np.linspace(1, 0, fade) ** 2
        self.add(y * env, at, gain)

    def noise(self, dur=.12, lo=150, hi=3000, decay=.03, gain=1,
              at=0, attack=.001, flutter=0):
        count = round(dur * SR)
        t = np.arange(count) / SR
        raw = self.rng.standard_normal(count)
        sos = signal.butter(2, [lo, hi], btype="bandpass", fs=SR, output="sos")
        y = signal.sosfilt(sos, raw)
        env = (1 - np.exp(-t / attack)) * np.exp(-t / decay)
        if flutter:
            env *= .65 + .35 * np.sin(TAU * flutter * t)
        fade = min(count, round(.012 * SR))
        env[-fade:] *= np.linspace(1, 0, fade) ** 2
        self.add(y * env, at, gain)

    def bell(self, freq, at=0, gain=.5, length=.45):
        # Slightly inharmonic mallet, softened high partials, no square-wave buzz.
        for ratio, amp, decay in [(1, 1, .10), (2.002, .24, .065), (2.76, .08, .035)]:
            self.tone(freq * ratio, dur=length, decay=decay * (length / .35),
                      gain=gain * amp, at=at, partials=(1,), attack=.0015)

    def bubbles(self, amount=6, spread=.1, base=400, gain=.25, at=0):
        for i in range(amount):
            f = base * self.rng.uniform(.55, 1.8)
            self.tone(f, f * self.rng.uniform(.28, .6), dur=.095,
                      decay=self.rng.uniform(.013, .03), gain=gain * self.rng.uniform(.4, 1),
                      at=at + self.rng.uniform(0, spread), partials=(1, .18), fm=.65)

    def cracks(self, amount=5, spread=.055, gain=.5, at=0, body=450):
        for i in range(amount):
            when = at + self.rng.uniform(0, spread)
            self.noise(.045, 800, 6500, .007, gain * self.rng.uniform(.5, 1), when)
            f = body * self.rng.uniform(.8, 1.8)
            self.tone(f, f * .65, .06, .012, gain * .18, when, partials=(1, .3))


def impact(v, heavy=False, at=0, gain=1):
    f = v.rng.uniform(105, 127) if heavy else v.rng.uniform(145, 175)
    v.tone(f, 43 if heavy else 69, .23, .055 if heavy else .035, .8 * gain, at)
    v.tone(320 if heavy else 460, 180, .085, .014, .19 * gain, at, partials=(1, .26, .08))
    v.noise(.13, 130, 2100, .024, .5 * gain, at)
    v.noise(.05, 2200, 6000, .009, .14 * gain, at)


# Identity -> body pitch, viscosity, shell density, liquid droplets.
CREATURES = {
    "worm": (330, .10, 0, 8), "bug": (260, .055, 5, 4),
    "spider": (225, .065, 3, 5), "scorpion": (170, .05, 9, 3),
    "beetle": (125, .045, 12, 3), "slug": (280, .145, 0, 12),
    "termite": (370, .04, 7, 3), "hornet": (420, .04, 5, 3),
    "mosquito": (540, .03, 3, 5), "pillbug": (150, .045, 10, 3),
    "flea": (580, .025, 4, 2), "locust": (320, .045, 7, 3),
    "eggsac": (350, .13, 2, 14), "spitter": (190, .14, 2, 10),
    "generic": (300, .075, 3, 7),
}


def splat(v, creature):
    pitch, wet, shell, drops = CREATURES[creature]
    pitch *= v.rng.uniform(.91, 1.09)
    # Noise closes in three bands; droplets and damped body form the wet impact.
    v.tone(pitch, pitch * .24, .23, wet * .42, .5, partials=(1, .2), fm=1.15)
    v.noise(.08, 400, 4200, .012, .7)
    v.noise(.15, 170, 1500, wet * .45, .8, .008)
    v.noise(.24, 100, 650, wet * .65, .45, .024)
    v.bubbles(drops, wet, pitch * 1.5, .27)
    if shell:
        v.cracks(shell, .065, .55, body=pitch * 2)
    if creature in ("hornet", "mosquito"):
        v.tone(pitch, 95, .11, .025, .12, partials=(1, .35, .2), fm=1.5)
    if creature == "spider":
        v.noise(.16, 1600, 6200, .025, .12, .025)


def synth(kind, seed, arg=None):
    v = Voice(2.4, seed)
    if kind == "splat":
        splat(v, arg)
    elif kind in ("roll", "heavy", "crush", "multi"):
        impact(v, kind != "roll")
        if kind == "roll":
            v.noise(.12, 230, 1600, .025, .16, .026)
        if kind == "crush":
            v.cracks(4, .035, .2, body=300)
        if kind == "multi":
            impact(v, True, .035, .55)
            v.bubbles(14, .17, 230, .23)
            v.cracks(10, .1, .5)
    elif kind == "knock":
        v.tone(230, 135, .13, .024, .7, partials=(1, .2, .09))
        v.noise(.07, 420, 3800, .014, .35)
        v.tone(680, 480, .055, .008, .12)
    elif kind in ("crack", "deflect"):
        impact(v, False, gain=.3)
        v.cracks(12 if kind == "crack" else 3, .09, .65, body=620)
        if kind == "deflect":
            v.bell(740, gain=.19, length=.2)
    elif kind == "latch":
        v.noise(.12, 1200, 5000, .024, .25)
        v.tone(510, 690, .12, .032, .36, fm=1)
        v.tone(310, 170, .09, .02, .28, at=.055)
    elif kind == "bite":
        v.cracks(5, .025, .6, body=270)
        v.bubbles(4, .035, 190, .32)
        v.tone(170, 67, .2, .047, .65, partials=(1, .22))
    elif kind == "hurt":
        impact(v, True, gain=.4)
        v.tone(280, 95, .3, .065, .55, partials=(1, .3, .1), fm=.7)
        v.noise(.17, 150, 1100, .036, .3)
    elif kind == "spit":
        v.bubbles(4, .025, 520, .3)
        v.tone(700, 140, .14, .03, .7, fm=1.8)
        v.noise(.09, 900, 4100, .018, .38)
    elif kind in ("acid_land", "acid_hit"):
        splat(v, "spitter")
        v.noise(.45, 1900, 6300, .11, .18, .04, flutter=45)
        if kind == "acid_hit":
            v.tone(230, 78, .27, .055, .5, partials=(1, .18), at=.025)
    elif kind in ("web", "slime", "release"):
        v.bubbles(6 if kind == "slime" else 2, .12, 290, .22)
        if kind == "web":
            for i, f in enumerate([760, 540, 340]):
                v.tone(f, f * .55, .18, .04, .24, i * .025, partials=(1, .32), fm=1.3)
        elif kind == "slime":
            v.tone(390, 90, .25, .065, .5, fm=2)
            v.noise(.24, 160, 1100, .06, .4)
        else:
            v.tone(260, 720, .15, .036, .3)
            v.noise(.09, 1500, 5600, .02, .14)
    elif kind == "hatch":
        v.bubbles(18, .32, 290, .32)
        v.cracks(8, .18, .35)
        for i in range(4):
            v.noise(.08, 1200, 4500, .017, .2, .19 + i * .055)
    elif kind in ("hop", "lunge", "dig", "curl"):
        if kind == "hop":
            v.tone(210, 650, .11, .022, .35, fm=.5)
            v.noise(.06, 1000, 4000, .012, .18)
        elif kind == "lunge":
            v.noise(.2, 600, 4800, .042, .4, attack=.015)
            v.tone(170, 370, .14, .035, .22)
        elif kind == "dig":
            v.cracks(12, .18, .3, body=220)
            v.noise(.32, 90, 900, .08, .4)
        else:
            v.cracks(5, .08, .22, body=500)
            v.tone(430, 180, .18, .04, .35)
    elif kind in ("poison", "poison_tick", "daze", "low_health"):
        if kind == "poison":
            v.bubbles(5, .2, 210, .2)
            for i, f in enumerate([370, 349, 277]):
                v.tone(f, dur=.28, decay=.07, gain=.22, at=i * .095, fm=.4)
        elif kind == "poison_tick":
            v.bubbles(2, .02, 130, .25)
            v.tone(110, 70, .12, .025, .22)
        elif kind == "daze":
            for i in range(3):
                v.tone(650 - i * 80, 390 + i * 60, .19, .055, .28, i * .08, fm=1.5)
        else:
            for at in [0, .18]:
                v.tone(88, 62, .18, .038, .6, at)
                v.tone(176, 124, .14, .025, .22, at)
    elif kind == "ui":
        f, ending, texture = arg
        jitter = v.rng.uniform(.97, 1.03)
        v.tone(f * jitter, ending * jitter, .10, .014, .6, partials=(1, .08))
        v.noise(.055, 1200, 6500, .008, texture)
        v.tone(f * .49, ending * .55, .07, .012, .14)
    elif kind == "swish":
        up = bool(arg)
        v.noise(.18, 500, 4800, .04, .35, attack=.012)
        v.tone(330 if up else 610, 610 if up else 270, .14, .03, .18)
        v.tone(920 if up else 740, dur=.09, decay=.018, gain=.14, at=.045)
    elif kind == "error":
        for i, f in enumerate([294, 261]):
            v.tone(f, dur=.15, decay=.032, gain=.45, at=i * .085, partials=(1, .2))
        v.noise(.055, 150, 1000, .01, .17)
    elif kind == "equip":
        v.tone(320, 220, .1, .02, .4)
        v.cracks(2, .016, .12, at=.055)
        v.bell(arg or 880, .085, .24, .24)
    elif kind == "score":
        v.bell(arg, gain=.42, length=.19)
        v.tone(arg / 2, dur=.08, decay=.018, gain=.12)
    elif kind == "coin":
        v.bell(1174.66 * v.rng.uniform(.985, 1.015), gain=.35, length=.26)
        v.bell(1760, .045, .24, .24)
        v.noise(.03, 3500, 8500, .006, .07)
    elif kind == "xp_tick":
        drift = v.rng.uniform(.975, 1.025)
        v.tone(440 * drift, 880 * drift, .14, .025, .4, partials=(1, .12))
        v.bell(1174.66 * drift, .045, .16, .16)
    elif kind == "motif":
        notes, gap, length, body = arg
        for i, f in enumerate(notes):
            v.bell(f, i * gap, .36, length)
            if body:
                v.tone(f / 4, dur=length, decay=.11, gain=.13, at=i * gap, partials=(1, .1))
        v.noise(.2, 1500, 7000, .05, .06, attack=.02)
    elif kind == "speed":
        v.noise(.38, 900, 6000, .08, .23, attack=.02)
        v.tone(220, 880, .35, .11, .32, partials=(1, .16))
        for i, f in enumerate([587.33, 880, 1174.66]):
            v.bell(f, .10 + i * .07, .24, .32)
    elif kind == "giant":
        impact(v, True, gain=.55)
        v.tone(70, 220, .45, .13, .6, partials=(1, .25, .1))
        for i, f in enumerate([293.66, 440, 587.33]):
            v.bell(f, .14 + i * .085, .3, .48)
    elif kind == "rampage":
        impact(v, True, gain=.6)
        for i, f in enumerate([293.66, 369.99, 440, 587.33, 880]):
            v.bell(f, .04 + i * .075, .33, .52)
        v.noise(.35, 700, 4800, .075, .17, at=.04, attack=.018)
    elif kind == "end":
        for i, f in enumerate([440, 369.99, 293.66, 146.83]):
            v.bell(f, i * .15, .33, .65)
        v.tone(110, 55, .45, .10, .3)
    else:
        raise ValueError(kind)
    return v.x


def finish(x, peak_db, stereo=False):
    x = signal.sosfilt(signal.butter(2, 35, "highpass", fs=SR, output="sos"), x)
    x = signal.sosfilt(signal.butter(2, 13000, "lowpass", fs=SR, output="sos"), x)
    if stereo:
        # Dry center with quiet asymmetric early reflections. Mono compatible.
        left, right = x.copy(), x.copy()
        for dest, delay, gain in [(left, .037, .15), (right, .049, .15),
                                  (left, .083, .07), (right, .101, .07)]:
            n = round(delay * SR)
            dest[n:] += x[:-n] * gain
        x = np.column_stack([left, right])
    peak = np.max(np.abs(x))
    if peak < 1e-10:
        raise ValueError("Silent synthesis")
    x *= 10 ** (peak_db / 20) / peak
    # Preserve a short natural tail, cut only content below -72 dBFS.
    level = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    active = np.flatnonzero(level > 10 ** (-72 / 20))
    end = min(len(x), max(round(.065 * SR), int(active[-1]) + round(.018 * SR)))
    x = x[:end]
    n = min(round(.012 * SR), len(x) // 4)
    fade = np.linspace(1, 0, n) ** 2
    x[-n:] *= fade[:, None] if x.ndim == 2 else fade
    x[0] = 0
    x[-1] = 0
    return x


def add(category, name, kind, arg=None, variants=1, peak=-10,
        trigger="", source="new", cooldown=80, priority=40, stereo=False, optional=False):
    entry = dict(id=f"{category}.{name}", category=category, name=name.replace("_", " ").title(),
                 trigger=trigger, source=source, priority=priority, cooldownMs=cooldown,
                 maxVoices=1 if category in ("ui", "session", "shop") else 3,
                 optional=optional, loop=False, nominalPeakDbFS=peak,
                 variantSelection="shuffle bag; no immediate repeat", assets=[])
    for index in range(variants):
        asset_id = f"{name}_{index + 1:02d}"
        x = finish(synth(kind, seed_for(f"{category}/{asset_id}"), arg), peak, stereo)
        directory = ROOT / "wav" / category
        directory.mkdir(parents=True, exist_ok=True)
        web_directory = ROOT / "ogg" / category
        web_directory.mkdir(parents=True, exist_ok=True)
        wav = directory / f"{asset_id}.wav"
        ogg = web_directory / f"{asset_id}.ogg"
        rng = np.random.default_rng(seed_for(asset_id + "dither"))
        dither = (rng.random(x.shape) - rng.random(x.shape)) / (2 ** 23)
        dither[[0, -1]] = 0
        sf.write(wav, x + dither, SR, subtype="PCM_24")
        sf.write(ogg, x, SR, format="OGG", subtype="VORBIS")
        entry["assets"].append(dict(wav=wav.relative_to(ROOT).as_posix(),
                                    ogg=ogg.relative_to(ROOT).as_posix(),
                                    duration=round(len(x) / SR, 4),
                                    channels=1 if x.ndim == 1 else 2))
        if index == 0:
            BUFFERS[entry["id"]] = x
    CATALOG.append(entry)


def build_catalog():
    for creature in CREATURES:
        add("kills", creature, "splat", creature, 3, -9,
            f"Crush {creature}; one kill cue per impact, chosen from the most prominent victim.",
            "game/engine.ts:crushList → playSplat()", 60, 65)
    for name, kind, variants, peak, trigger, source in [
        ("cube_roll", "roll", 4, -15, "Cube finishes one roll", "playThud(false) / roll completion"),
        ("heavy_land", "heavy", 3, -10, "Giant cube lands", "playThud / giant landing"),
        ("crush_impact", "crush", 3, -13, "Stone body under a kill splat", "playThud(false) / crushList"),
        ("heavy_crush", "heavy", 3, -10, "Heavy crush body under a splat", "playThud(true) / crushList"),
        ("multikill", "multi", 3, -8, "Multiple victims in one landing; replaces individual splats", "crushList killed > 1"),
        ("obstacle_knock", "knock", 3, -14, "Blocked by rock or pit", "playKnock / tryRoll"),
        ("armor_crack", "crack", 3, -10, "First hit breaks armored beetle shell", "playKnock / hp > 1"),
        ("armor_deflect", "deflect", 3, -13, "Moving pillbug or giant acid block", "playKnock / CURLED or BLOCKED"),
        ("parasite_latch", "latch", 3, -13, "Parasite attaches to cube", "playLatch / attached transition"),
        ("parasite_bite", "bite", 3, -10, "Bite damage connects", "playBite / applyBite"),
        ("player_hurt", "hurt", 2, -10, "Generic damage fallback", "playHurt exported but currently unused"),
    ]:
        add("gameplay", name, kind, variants=variants, peak=peak, trigger=trigger,
            source="game/engine.ts: " + source, cooldown=80, priority=70 if "bite" in name else 50)
    for name, kind, variants, peak, trigger, source in [
        ("acid_spit", "spit", 3, -13, "Spitter launches glob", "playSpit / launchSpit"),
        ("acid_land", "acid_land", 3, -15, "Acid misses and hits ground", "glob impact / dropHazard"),
        ("acid_hit", "acid_hit", 2, -10, "Acid damages player", "playBite / applySpitHit"),
        ("web_snare", "web", 2, -13, "Cube contacts a web", "playLatch / WEBBED"),
        ("slime_stick", "slime", 2, -13, "Cube contacts slime", "playLatch / STUCK"),
        ("snare_release", "release", 2, -18, "Slow or stall effect ends", "slowT / stallT transition to zero"),
        ("poison_start", "poison", 1, -13, "Scorpion applies poison", "poisonT = POISON_TIME"),
        ("poison_tick", "poison_tick", 2, -23, "Optional poison feedback, at most once a second", "poisonT health drain"),
        ("daze_start", "daze", 1, -13, "Hornet reverses controls", "dazeT = DAZE_TIME"),
        ("egg_hatch", "hatch", 3, -11, "Egg sac releases a brood", "playRampage / hatchEggSac"),
        ("locust_lunge", "lunge", 2, -18, "Locust begins a two-tile dash nearby", "locust dashT"),
        ("flea_hop", "hop", 2, -23, "Optional nearby flea hop", "flea movement"),
        ("termite_dig", "dig", 2, -21, "Optional nearby termite pit creation", "dropHazard pit"),
        ("pillbug_curl", "curl", 2, -22, "Optional nearby pillbug movement start", "pillbug moveT"),
        ("low_health", "low_health", 1, -17, "Low-health threshold crossing; do not loop rapidly", "lives threshold"),
    ]:
        add("hazards", name, kind, variants=variants, peak=peak, trigger=trigger,
            source="game/engine.ts: " + source, cooldown=1000 if name in ("poison_tick", "low_health") else 150,
            priority=75 if name in ("acid_hit", "low_health") else 45,
            optional=name in ("poison_tick", "flea_hop", "termite_dig", "pillbug_curl"))
    notes = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98]
    for i, f in enumerate(notes, 1):
        add("rewards", f"score_gain_{i}", "score", f, peak=-20,
            trigger=f"Positive score gain at combo tier {i}; coalesce kills within 70 ms",
            source="game/engine.ts:addKill after S.score += pts", cooldown=70, priority=30)
    add("rewards", "coin_pickup", "coin", variants=3, peak=-15,
        trigger="Small coin reward", source="playCoin small reward fallback", priority=45)
    add("rewards", "xp_tick", "xp_tick", variants=3, peak=-21,
        trigger="XP tally tick; capped rate", source="Planned XP results UI", cooldown=90, priority=20)
    motifs = [
        ("rewards", "coin_payout", [1174.66, 880, 1174.66, 1760], .07, .42, False, -12, "Run coins awarded", "playCoin / gameOver"),
        ("rewards", "xp_award", [440, 659.25, 880], .09, .44, False, -14, "XP tally completes", "Planned XP UI"),
        ("rewards", "xp_level_up", [440, 587.33, 739.99, 880, 1174.66], .095, .6, True, -9, "Player XP level increases", "Planned account progression"),
        ("rewards", "level_up", [587.33, 739.99, 880, 1174.66], .075, .5, True, -10, "Gameplay level threshold crossed", "playRampage / announceLevel"),
        ("rewards", "personal_best", [587.33, 880, 1174.66, 1479.98, 1760], .11, .7, True, -9, "A run beats the previous personal best", "gameOver / prevBest comparison"),
        ("rewards", "combo_2", [587.33, 739.99], .065, .25, False, -17, "Combo reaches x2", "addKill / combo milestone"),
        ("rewards", "combo_4", [739.99, 880, 1174.66], .06, .3, False, -16, "Combo reaches x4", "addKill / combo milestone"),
        ("rewards", "combo_8", [880, 1174.66, 1479.98], .055, .35, False, -15, "Combo reaches x8", "addKill / combo milestone"),
        ("rewards", "tally_finish", [880, 1174.66], .07, .32, False, -15, "Results count completes", "Results UI"),
        ("powerups", "heal", [587.33, 739.99, 987.77], .085, .42, False, -12, "Heart pickup restores health", "playHeal / collectHeart"),
        ("powerups", "spawn", [880, 1174.66], .075, .3, False, -21, "A nearby pickup appears", "spawnHeart / spawnPowerup"),
        ("powerups", "expire", [880, 659.25, 440], .06, .27, False, -18, "Speed or giant effect ends", "speedT / giantT crosses zero"),
        ("powerups", "rampage_end", [587.33, 440, 293.66], .06, .24, False, -19, "Rampage ends", "endCombo / wasRampage"),
        ("shop", "purchase", [880, 1174.66, 1479.98], .08, .45, False, -12, "Purchase is confirmed", "playCoin / buildSkinItem, buildTrailItem, buildAuraItem onBuy"),
        ("shop", "unlock", [587.33, 739.99, 880, 1174.66, 1479.98], .085, .55, True, -10, "New cosmetic reveal; replaces purchase cue when both occur", "Planned unlock reveal"),
        ("ui", "save_success", [739.99, 987.77], .08, .28, False, -17, "Server confirms save", "engine.ts scoreSaved = true / rename success"),
        ("ui", "login_success", [587.33, 880], .09, .32, False, -16, "Login completes", "Planned account login"),
        ("ui", "reset_complete", [440, 587.33], .09, .3, False, -17, "Reset completes successfully", "menus.ts resetProgress success"),
        ("session", "ready", [587.33, 880, 1174.66], .09, .35, False, -15, "Loading completes after user has enabled sound", "Loading screen"),
        ("session", "start", [293.66, 440, 587.33, 880], .07, .42, True, -10, "Run begins", "resetGame success / S.running"),
        ("session", "restart", [440, 587.33, 880], .065, .32, True, -12, "Restarted run begins", "resetGame on replay"),
    ]
    for category, name, sequence, gap, length, body, peak, trigger, source in motifs:
        add(category, name, "motif", (sequence, gap, length, body), peak=peak,
            trigger=trigger, source=source, cooldown=350, priority=85 if body else 55, stereo=body)
    add("powerups", "speed", "speed", peak=-11, trigger="Speed pickup", source="playHeal / bolt pickup", priority=80, stereo=True)
    add("powerups", "giant", "giant", peak=-10, trigger="Giant pickup", source="playRampage / star pickup", priority=80, stereo=True)
    add("powerups", "rampage_start", "rampage", peak=-9, trigger="Rampage begins", source="playRampage / addKill wasRampage", priority=90, stereo=True, cooldown=500)
    add("session", "game_over", "end", peak=-11, trigger="Run ends", source="gameOver / S.running false", cooldown=1000, priority=95, stereo=True)
    ui_specs = [
        ("hover", 1500, 1150, .06, 2, -26, "Optional navigation hover; no sound on every pointer movement"),
        ("press", 850, 590, .18, 3, -19, "Button commits an action"),
        ("navigate", 980, 1200, .13, 2, -19, "Navigate to a new screen"),
        ("back", 980, 610, .1, 1, -20, "Return to previous screen"),
        ("tab_switch", 1150, 900, .13, 2, -20, "Skins / Trails / Auras or All / Owned tab changes"),
        ("toggle_on", 620, 1100, .08, 1, -20, "Setting enabled"),
        ("toggle_off", 1100, 620, .08, 1, -21, "Setting disabled; mute applies immediately"),
        ("slider_tick", 1250, 1050, .04, 2, -27, "Optional discrete slider step; rate limited"),
        ("guide_select", 1000, 1350, .09, 2, -21, "Select another creature"),
        ("notification", 1174.66, 1174.66, .02, 1, -23, "Noncritical notification"),
        ("save_pending", 740, 880, .02, 1, -24, "Save request starts once; never loop while pending"),
        ("retry", 660, 990, .10, 1, -21, "User retries a failed save"),
        ("logout", 880, 440, .08, 1, -22, "User signs out"),
    ]
    for name, f, end, texture, count, peak, trigger in ui_specs:
        add("ui", name, "ui", (f, end, texture), count, peak, trigger,
            "menus.ts / itemModal.ts / planned redesigned interface", 100, 15,
            optional=name in ("hover", "slider_tick", "save_pending"))
    for category, name, up, trigger in [
        ("ui", "modal_open", True, "Open item, creature, or leaderboard modal"),
        ("ui", "modal_close", False, "Close modal"),
        ("session", "pause", False, "Pause begins"),
        ("session", "resume", True, "Gameplay resumes"),
    ]:
        add(category, name, "swish", up, peak=-20, trigger=trigger, source="Menu/modal or setPause transition", priority=35)
    for category, name, trigger in [
        ("ui", "error", "Action fails or form submitted with invalid input"),
        ("ui", "save_failed", "Server confirms save failure; never on ordinary typing"),
        ("ui", "reset_arm", "Destructive reset awaits confirmation"),
        ("shop", "insufficient_coins", "Attempted purchase lacks coins; only on actual attempt"),
    ]:
        add(category, name, "error", peak=-18, trigger=trigger, source="Existing menu / save validation paths", priority=65, cooldown=400)
    for name, f in [("equip_skin", 880), ("equip_trail", 1174.66), ("equip_aura", 987.77)]:
        add("shop", name, "equip", f, peak=-16, trigger=name.replace("_", " "), source="menus.ts onEquip", priority=50)
    add("rewards", "tally_tick", "ui", (950, 810, .04), 3, -24, "Results score counter tick", "Results UI", 60, 15)
    add("rewards", "combo_break", "ui", (420, 240, .05), peak=-22, trigger="Combo expires without damage; suppress when a damage cue plays", source="endCombo", priority=20)


def save_demo(name, timeline, duration):
    mix = np.zeros((round(duration * SR), 2))
    markers = []
    for at, cue_id, gain in timeline:
        x = BUFFERS[cue_id]
        if x.ndim == 1:
            x = np.column_stack([x, x])
        start = round(at * SR)
        count = min(len(x), len(mix) - start)
        mix[start:start + count] += x[:count] * gain
        markers.append(dict(at=at, cue=cue_id, gain=gain))
    peak = np.max(np.abs(signal.resample_poly(mix, 4, 1, axis=0)))
    if peak > 10 ** (-3 / 20):
        mix *= 10 ** (-3 / 20) / peak
    directory = ROOT / "previews"
    directory.mkdir(exist_ok=True)
    sf.write(directory / (name + ".wav"), mix, SR, subtype="PCM_24")
    return dict(file=f"previews/{name}.wav", duration=duration, markers=markers)


def build_demos():
    events = [(0.2, "ui.navigate", 1), (.7, "ui.tab_switch", 1),
              (1.2, "shop.equip_skin", 1), (2, "session.start", 1)]
    for i in range(12):
        at = 3 + i * .36
        events.append((at, "gameplay.cube_roll", 1))
        if i in (1, 3, 4, 6, 7, 8):
            creature = ["worm", "bug", "spider", "slug", "beetle", "hornet"][[1, 3, 4, 6, 7, 8].index(i)]
            events += [(at, "kills." + creature, .9), (at + .045, "rewards.score_gain_" + str(min(i, 8)), 1)]
    events += [(7.6, "hazards.acid_spit", 1), (8.15, "hazards.acid_hit", 1),
               (8.9, "powerups.heal", 1), (10, "powerups.speed", 1),
               (11, "gameplay.multikill", 1), (11.15, "powerups.rampage_start", 1),
               (12.3, "gameplay.heavy_land", 1), (12.3, "kills.scorpion", .8),
               (12.35, "rewards.score_gain_8", 1), (13.1, "rewards.level_up", 1),
               (14.6, "session.pause", 1), (15.3, "session.resume", 1),
               (16.2, "gameplay.parasite_bite", 1), (16.55, "session.game_over", 1),
               (18, "rewards.coin_payout", 1), (19, "rewards.xp_award", 1),
               (20, "ui.save_success", 1)]
    demos = [save_demo("gameplay_mix", events, 21)]
    names = [n for n in CREATURES if n != "generic"]
    demos.append(save_demo("all_14_creature_kills", [(.25 + i * .8, "kills." + n, 1) for i, n in enumerate(names)], 11.8))
    return demos


def verify():
    rows, errors, hashes, content_hashes = [], [], set(), set()
    for entry in CATALOG:
        for asset in entry["assets"]:
            wav = ROOT / asset["wav"]
            x, rate = sf.read(wav, always_2d=True)
            web, web_rate = sf.read(ROOT / asset["ogg"], always_2d=True)
            peak = float(np.max(np.abs(x)))
            true_peak = float(np.max(np.abs(signal.resample_poly(x, 4, 1, axis=0))))
            dc = float(np.max(np.abs(np.mean(x, axis=0))))
            rms = float(np.sqrt(np.mean(x * x)))
            digest = hashlib.sha256(wav.read_bytes()).hexdigest()
            content_digest = hashlib.sha256(np.round(x * 32767).astype(np.int16).tobytes()).hexdigest()
            checks = {
                "sample_rate": rate == SR == web_rate,
                "non_silent": rms > 1e-5,
                "finite": bool(np.all(np.isfinite(x)) and np.all(np.isfinite(web))),
                "headroom": true_peak < 10 ** (-5.5 / 20),
                "ogg_headroom": float(np.max(np.abs(web))) < .85,
                "dc_offset": dc < .0005,
                "quiet_edges": float(np.max(np.abs(x[[0, -1]]))) < .00001,
                "decode_length": abs(len(web) - len(x)) <= 2,
                "unique_pcm": digest not in hashes,
                "distinct_at_16_bit": content_digest not in content_hashes,
            }
            hashes.add(digest)
            content_hashes.add(content_digest)
            if not all(checks.values()):
                errors.append({"file": asset["wav"], "failed": [k for k, ok in checks.items() if not ok]})
            rows.append(dict(file=asset["wav"], peakDbFS=round(20 * np.log10(peak), 2),
                             estimatedTruePeakDbTP=round(20 * np.log10(true_peak), 2),
                             rmsDbFS=round(20 * np.log10(rms), 2), dcOffset=dc,
                             sha256=digest, checks=checks))
    report = dict(status="pass" if not errors else "fail", cueCount=len(CATALOG),
                  variationCount=len(rows), wavCount=len(rows), oggCount=len(rows),
                  sampleRate=SR, errors=errors, files=rows,
                  review="Automated signal and decode checks. Listen in preview.html for perceptual review; no claim of human listening approval.")
    (ROOT / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    if errors:
        raise RuntimeError(json.dumps(errors))
    return report


def main():
    build_catalog()
    demos = build_demos()
    manifest = dict(name="CubeCrush / Tactile Arcade", version=1, sampleRate=SR,
                    masters="48 kHz / 24-bit PCM WAV", web="48 kHz Ogg Vorbis",
                    creation="Original deterministic procedural synthesis; no third-party recordings or samples.",
                    integrationStatus="Asset pack only; game/audio.ts and live game are unchanged.",
                    cues=CATALOG, previews=demos)
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    # Embedded data works when the preview is opened directly as a local file.
    (ROOT / "catalog.js").write_text("window.CUBE_AUDIO = " + json.dumps(manifest) + ";\n", encoding="utf-8")
    result = verify()
    print(json.dumps({k: result[k] for k in ["status", "cueCount", "variationCount", "wavCount", "oggCount", "errors"]}))


if __name__ == "__main__":
    main()
