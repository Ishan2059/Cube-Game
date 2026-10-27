"""Original terrain-aware foley and exploration cues. No third-party recordings."""
import json
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy import signal
from build_audio import Voice, finish, seed_for, SR

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'public/audio/exploration'
DEST.mkdir(parents=True,exist_ok=True)
CUES={}

def export(name,v,peak=-19,variants=1,index=0,priority=35,cooldown=80):
    x=finish(v.x,peak)
    stem=f'{name}_{index+1:02d}'
    sf.write(DEST/(stem+'.wav'),x,SR,subtype='PCM_24')
    sf.write(DEST/(stem+'.ogg'),x,SR,format='OGG',subtype='VORBIS')
    cue=CUES.setdefault('exploration.'+name,{'files':[],'cooldownMs':cooldown,'maxVoices':2,'priority':priority})
    cue['files'].append('/audio/exploration/'+stem)

def foliage(v,length=.28,gain=1):
    # Overlapping dry leaf grains and a soft broad swish, never a bass kick.
    v.noise(length,900,6500,.11,.18*gain,attack=.025)
    for j in range(11):
      at=v.rng.uniform(.015,length*.65)
      v.noise(v.rng.uniform(.015,.04),1800,7600,.009,.07*gain,at=at,attack=.003)
    v.noise(length,230,900,.08,.07*gain,attack=.018)

def water(v,large=False):
    # Broad displacement followed by smaller falling droplets / cavity resonances.
    v.noise(.34 if large else .25,170,1650,.13,.38,attack=.012)
    v.noise(.45 if large else .28,1600,8200,.12,.28,at=.018,attack=.007)
    for j in range(14 if large else 7):
      at=v.rng.uniform(.045,.38 if large else .24)
      f=v.rng.uniform(480,2100)
      v.tone(f,f*1.3,.07,.013,.04,at=at,attack=.001,partials=(1,))
      v.noise(.025,2500,9500,.006,.055,at=at,attack=.001)

for surface in ['grass','stone','wood','mud','water','ash']:
  for i in range(4):
    v=Voice(.5,seed_for(f'roll.v2.{surface}.{i}'))
    if surface=='grass':foliage(v)
    elif surface=='stone':
      v.noise(.21,350,3700,.07,.25,attack=.008)
      for j in range(7):v.noise(.025,1400,6700,.006,.075,at=.025+j*.023,attack=.002)
    elif surface=='wood':
      # Fixed inharmonic wood modes: a small dry clack, not a pitched drum sweep.
      v.noise(.18,300,2200,.05,.28,attack=.005)
      for f,a in [(540,.055),(1230,.025),(2070,.012)]:
        v.tone(f*(1+i*.013),dur=.11,decay=.021,gain=a,at=.012,partials=(1,),attack=.002)
      v.noise(.12,1800,5200,.035,.10,at=.045,attack=.012)
    elif surface=='mud':
      v.noise(.3,110,1000,.12,.33,attack=.023)
      v.noise(.2,600,2800,.08,.12,at=.055,attack=.03)
      v.bubbles(4,.13,330,.014,at=.04)
    elif surface=='water':water(v)
    else:
      v.noise(.25,600,4200,.09,.22,attack=.015)
      v.noise(.11,2000,7200,.035,.08,at=.08,attack=.007)
    export('roll_'+surface,v,-18 if surface=='water' else -21,index=i,cooldown=120)
    CUES['exploration.roll_'+surface]['maxVoices']=1

for name in ['bush_rustle','water_exit']:
  for i in range(3):
    v=Voice(.65,seed_for(f'{name}.{i}'))
    if name=='bush_rustle':foliage(v,.42,1.2)
    else:water(v)
    export(name,v,-21,index=i,cooldown=150)

for name in ['door_open','door_close','chest_open','portal_enter','portal_exit','portal_locked','splash','mud_release','lava_burn','loot','coin_boost','bridge_creak']:
    v=Voice(1.8,seed_for(name))
    if name in ['door_open','door_close','chest_open','bridge_creak']:
      length=.65 if name!='door_close' else .3
      v.noise(length,140,1400,.25,.18,attack=.025,flutter=23)
      for f,a in [(340,.06),(620,.035),(920,.012)]:v.tone(f,f*.78,length,.24,a,attack=.04,partials=(1,.07),fm=.12)
      v.noise(.06,1300,4400,.018,.14,at=.03,attack=.004)
      if name=='door_close':v.noise(.12,100,950,.04,.35,at=.21,attack=.009)
      if name=='chest_open':
        v.bell(1240,at=.45,gain=.12,length=.6);v.bell(1860,at=.51,gain=.07,length=.5)
    elif name.startswith('portal_'):
      if name=='portal_locked':
        v.bell(410,gain=.12,length=.3);v.bell(320,at=.1,gain=.08,length=.35)
      else:
        v.noise(1.3,80,2400,.5,.24,attack=.22,flutter=5)
        for f,a in [(110,.12),(165,.06),(330,.025)]:v.tone(f,f*(3 if name=='portal_enter' else .7),1.3,.5,a,attack=.18,partials=(1,.05))
        v.bell(990,at=.65,gain=.05,length=.65)
    elif name=='splash':
      water(v,True)
    elif name=='mud_release':
      v.noise(.3,120,1200,.1,.25,attack=.02);v.bubbles(5,.15,220,.045)
    elif name=='lava_burn':
      v.noise(.6,1300,5800,.2,.24,attack=.02);v.cracks(5,.3,.035,body=550)
    else:
      for i,f in enumerate([1046,1318,1568]):v.bell(f,at=i*.055,gain=.12/(i+1)**.3,length=.5)
      v.noise(.12,2500,7000,.03,.025,at=.1,attack=.01)
    export(name,v,-18,priority=65,cooldown=250)

v=Voice(.4,seed_for('jump'))
v.noise(.26,650,4200,.09,.2,attack=.035)
v.noise(.09,200,900,.03,.12,at=.015,attack=.007)
export('jump',v,-22,priority=45,cooldown=150)

for kind in ['wood','stone','metal']:
  for i in range(3):
    v=Voice(.9,seed_for(f'break.{kind}.{i}'))
    v.noise(.22,120,1600,.065,.4,attack=.003)
    if kind=='wood':
      v.cracks(12,.21,.22,body=650)
      v.noise(.5,600,5600,.16,.18,at=.04,attack=.008)
    elif kind=='stone':
      v.cracks(17,.32,.2,body=1300)
      v.noise(.6,1600,7200,.19,.22,at=.04,attack=.01)
    else:
      v.cracks(8,.12,.16,body=1100)
      for f,g in [(430,.12),(997,.06),(1639,.035)]:v.tone(f,dur=.7,decay=.17,gain=g,partials=(1,),attack=.002)
    export('break_'+kind,v,-16,index=i,priority=75,cooldown=90)

for realm in ['meadow','mire','cinder','cabin']:
    v=Voice(9,seed_for('ambient.'+realm));t=np.arange(len(v.x))/SR
    raw=v.rng.standard_normal(len(t))
    lo,hi={'meadow':(180,1800),'mire':(250,2400),'cinder':(65,800),'cabin':(100,700)}[realm]
    bed=signal.sosfilt(signal.butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),raw)
    v.x+=bed*.05*(.65+.2*np.sin(t*.8)+.15*np.sin(t*1.7))
    if realm=='meadow':
      for at in [1.2,4.4,6.7]:
        v.tone(2300,3200,.12,.04,.015,at,partials=(1,),attack=.015)
        v.tone(2800,2200,.16,.06,.01,at+.15,partials=(1,),attack=.015)
    elif realm=='mire':
      for at in [1,3.5,6]:v.bubbles(4,.4,340,.009,at)
    elif realm=='cinder':
      v.cracks(12,8,.007,body=170)
    else:
      v.cracks(8,8,.004,body=240)
    # Long soft edges allow overlapping quiet ambience without loop clicks.
    v.x*=np.minimum(1,t/.7)*np.minimum(1,(9-t)/.9)
    export('ambient_'+realm,v,-31,priority=1,cooldown=6500)

(ROOT/'Audio/exploration-manifest.json').write_text(json.dumps(CUES,indent=2)+'\n')
bank=json.loads((ROOT/'game/audio-bank.json').read_text());bank.update(CUES)
(ROOT/'game/audio-bank.json').write_text(json.dumps(bank,indent=2)+'\n')
print(f'Generated {len(CUES)} exploration cues with distinct terrain foley')
