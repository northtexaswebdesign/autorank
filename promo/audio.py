import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
BEAT = 0.5  # 120 BPM


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, r=None, curve=6.0):
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-4))
    if r is None:
        r = d
    return e * np.exp(-curve * t / r)


def lp(x, f, o=2):
    return sosfilt(butter(o, min(f, SR / 2 - 100), 'low', fs=SR, output='sos'), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, o=2):
    return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)


def sweep_filter(x, f0, f1, kind='low', steps=48):
    """Per-sample swept 2-pole state-variable filter (no block seams)."""
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))
    g = np.tan(np.pi * np.minimum(fc, SR * 0.45) / SR)
    k = 1.2
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    ic1 = ic2 = 0.0
    lo = np.empty(n); hi = np.empty(n)
    xs = x.tolist(); A1 = a1.tolist(); A2 = a2.tolist(); A3 = a3.tolist()
    for i in range(n):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
        lo[i] = v2; hi[i] = xs[i] - k * v1 - v2
    return lo if kind == 'low' else hi


def place(buf, sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    l = np.cos((pan + 1) * np.pi / 4) * gain
    r = np.sin((pan + 1) * np.pi / 4) * gain
    if sig.ndim == 1:
        buf[i:i + len(sig), 0] += sig * l * 1.414
        buf[i:i + len(sig), 1] += sig * r * 1.414
    else:
        buf[i:i + len(sig)] += sig * gain


def reverb(x, length=2.2, decay=3.2, mix=0.3, seed=1):
    r = np.random.default_rng(seed)
    t = tt(length)
    ir = np.stack([r.standard_normal(len(t)), r.standard_normal(len(t))], 1) * np.exp(-decay * t)[:, None]
    ir[:, 0] = lp(ir[:, 0], 7000); ir[:, 1] = lp(ir[:, 1], 7000)
    ir /= np.sqrt((ir ** 2).sum(0))
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix * 1.0


def note(n):  # midi -> hz
    return 440 * 2 ** ((n - 69) / 12)


# ======================= MUSIC =======================
mus = np.zeros((N, 2))
drums = np.zeros((N, 2))


def saw(f, d, detune=0.0):
    t = tt(d)
    ph = (f * (1 + detune)) * t
    return 2 * (ph - np.floor(ph + 0.5))


def supersaw(f, d):
    return sum(saw(f, d, dt) for dt in (-0.012, -0.005, 0, 0.006, 0.013)) / 5


def pad_chord(notes, d, cutoff):
    x = sum(supersaw(note(n), d) for n in notes) / len(notes)
    x = lp(x, cutoff, 2)
    e = np.minimum(1, tt(d) / 0.25) * np.minimum(1, (d - tt(d)) / 0.2)
    return x * e


def kick(d=0.45):
    t = tt(d)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.3
    return np.tanh((x + click) * 1.6)


def clap():
    d = 0.25
    t = tt(d)
    n = bp(rng.standard_normal(len(t)), 900, 5000)
    e = np.zeros(len(t))
    for k, o in enumerate((0, 0.009, 0.018)):
        i = int(o * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) * (60 if k < 2 else 18))
    return n * e * 0.8


def hat(open_=False):
    d = 0.22 if open_ else 0.05
    t = tt(d)
    n = hp(rng.standard_normal(len(t)), 7500, 4)
    return n * np.exp(-t * (14 if open_ else 90))


def pluck(f, d=0.35, bright=4000):
    t = tt(d)
    x = saw(f, d) * 0.6 + np.sin(2 * np.pi * f * 2 * t) * 0.2
    x = lp(x, bright)
    return x * np.exp(-t * 9) * np.minimum(1, t / 0.003)


def bass(f, d):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * saw(f, d)
    x = lp(x, 600)
    return np.tanh(x * 1.4) * np.minimum(1, t / 0.005) * np.minimum(1, (d - t) / 0.02)


# progression (bar = 2s starting at 0.5): notes of chords (A minor key)
Am = [57, 60, 64, 67+2-2]  # A C E G? keep triad + 7th feel
CH = {
    'Am': ([57, 60, 64, 71], 45),
    'F': ([53, 57, 60, 64], 41),
    'C': ([55, 60, 64, 67], 48),
    'G': ([55, 59, 62, 67], 43),
}
bars = [(0.0, 'Am'), (0.5, 'Am'), (2.5, 'F'), (4.5, 'C'), (6.5, 'G'), (8.5, 'Am'), (10.5, 'F'), (12.5, 'G')]

# pads
for i, (t0, c) in enumerate(bars):
    t1 = bars[i + 1][0] if i + 1 < len(bars) else 13.5
    if t1 <= t0:
        continue
    notes, root = CH[c]
    cut = 900 if t0 < 2.5 else 2600
    place(mus, pad_chord(notes, t1 - t0 + 0.15, cut), t0, 0.16)

# intro filtered arp building 0 -> 2.5
arp_notes = [69, 72, 76, 79, 81, 79, 76, 72]
step = BEAT / 4
k = 0
t = 0.0
while t < 13.4:
    c = 'Am'
    for (b0, cc) in bars:
        if t >= b0:
            c = cc
    notes = CH[c][0]
    seq = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[2] + 12, notes[1] + 12, notes[3] + 12, notes[2] + 24]
    n = seq[k % 8]
    if t < 2.5:
        bright = 500 + 3500 * (t / 2.5) ** 2
        g = 0.05 + 0.08 * (t / 2.5)
    else:
        bright, g = 3800, 0.085
    if 13.25 <= t:
        break
    place(mus, pluck(note(n), 0.3, bright), t, g, pan=0.35 if k % 2 else -0.35)
    t += step
    k += 1

# drums & bass from 2.5 to 13.25
for b in range(int((13.25 - 2.5) / BEAT) + 1):
    t0 = 2.5 + b * BEAT
    if t0 >= 13.25:
        break
    place(drums, kick(), t0, 0.9)
    if b % 2 == 1:
        place(drums, clap(), t0, 0.35)
    place(drums, hat(True), t0 + BEAT / 2, 0.10, pan=0.2)
    for s in (1, 3):
        place(drums, hat(), t0 + s * BEAT / 4, 0.06, pan=-0.25)
    # offbeat bass on chord root
    c = 'Am'
    for (b0, cc) in bars:
        if t0 >= b0:
            c = cc
    root = CH[c][1]
    place(mus, bass(note(root), BEAT / 2 * 0.9), t0 + BEAT / 2, 0.30)
    place(mus, bass(note(root), BEAT / 4 * 0.8), t0 + BEAT * 0.75 if b % 2 else t0 + BEAT * 0.25, 0.0)

# intro heartbeat sub pulse 0-2.5
for t0 in np.arange(0.5, 2.5, BEAT):
    place(drums, kick(0.3) * 0.5, t0, 0.35)

# final chord (C major add9) from 13.5 with long tail
fin = pad_chord([48, 55, 60, 64, 67, 74], 1.5, 3200)
fin *= np.exp(-tt(1.5) * 1.2)
place(mus, fin, 13.5, 0.30)
place(mus, bass(note(36), 1.4) * np.exp(-tt(1.4) * 2.0), 13.5, 0.4)
for i, n in enumerate([72, 76, 79, 84]):
    place(mus, pluck(note(n), 0.8, 6000), 13.9 + i * 0.09, 0.07, pan=(-0.4 + i * 0.27))

# sidechain pumping on music
sc = np.ones(N)
for b in range(int((13.25 - 2.5) / BEAT) + 1):
    i = int((2.5 + b * BEAT) * SR)
    d = int(0.3 * SR)
    seg_ = 1 - 0.6 * np.exp(-np.arange(d) / SR * 14)
    j = min(N, i + d)
    sc[i:j] = np.minimum(sc[i:j], seg_[: j - i])
mus *= sc[:, None]
mus = reverb(mus, 2.4, 2.6, 0.32, seed=3)

# ======================= SFX =======================
sfx = np.zeros((N, 2))


def blip(f, d=0.08, decay=40, h=0.3):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + h * np.sin(4 * np.pi * f * t)) * np.exp(-t * decay) * np.minimum(1, t / 0.002)


def pop(f0=900, f1=300, d=0.09):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 60)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 35) * np.minimum(1, t / 0.001)


def click(bright=5000, d=0.03):
    t = tt(d)
    return bp(rng.standard_normal(len(t)), 1500, bright) * np.exp(-t * 220) + 0.4 * np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 300)


def whoosh(d=0.45, f0=300, f1=6000, rev=False):
    t = tt(d)
    n = rng.standard_normal(len(t))
    y = sweep_filter(n, f0, f1, 'low')
    y = hp(y, 150)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    if rev:
        e = (t / d) ** 2.5
    out = y * e
    return out / (np.abs(out).max() + 1e-9)


def stereo_whoosh(d, f0, f1, pan_from=-0.8, pan_to=0.8):
    m = whoosh(d, f0, f1)
    p = np.linspace(pan_from, pan_to, len(m))
    return np.stack([m * np.cos((p + 1) * np.pi / 4), m * np.sin((p + 1) * np.pi / 4)], 1) * 1.414


def boom(d=1.6):
    t = tt(d)
    f = 30 + 70 * np.exp(-t * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 2.2)
    n = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 6) * 0.5
    crash = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 2.5) * 0.25
    return np.tanh((x + n + crash) * 1.5)


def bell(f, d=1.0):
    t = tt(d)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * dc) for m, a, dc in ((1, 1, 4), (2.01, .4, 7), (3.0, .2, 10), (4.2, .12, 14)))
    return x * np.minimum(1, t / 0.002)


def shimmer(d=0.8, base=2000):
    out = np.zeros(int(d * SR))
    for i in range(14):
        f = base * 2 ** (rng.uniform(0, 1.6))
        o = rng.uniform(0, d * 0.6)
        b = blip(f, 0.25, 18, 0.1)
        s = int(o * SR)
        out[s:s + len(b)] += b[: len(out) - s] * rng.uniform(.3, 1)
    return out / 6


def riser(d, f0=200, f1=8000):
    t = tt(d)
    n = rng.standard_normal(len(t))
    y = sweep_filter(n, f0, f1, 'low', 64)
    f = f0 / 2 + (f1 / 8 - f0 / 2) * (t / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.2
    return (y / (np.abs(y).max() + 1e-9) * 0.8 + tone) * (t / d) ** 2


def thud():
    t = tt(0.5)
    f = 50 + 120 * np.exp(-t * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    slap = bp(rng.standard_normal(len(t)), 400, 3500) * np.exp(-t * 45) * 0.8
    return np.tanh((x + slap) * 2)


def sweep_tone(d, f0, f1):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(rng.standard_normal(len(t)), 2000, 7000) * 0.25
    return x * np.sin(np.pi * t / d)


# --- Scene A
for i in range(4):
    place(sfx, pop(1400 - i * 60, 500, 0.07), 0.12 + i * 0.13 + 0.03, 0.22, pan=-0.3 + i * 0.2)
place(sfx, whoosh(0.28, 1500, 9000), 0.85, 0.18, pan=0.3)                 # strike zip
place(sfx, stereo_whoosh(0.4, 300, 5000, 0.6, -0.6), 1.05, 0.32)           # line out
place(sfx, boom(0.8) * 0.7, 1.34, 0.55)                                    # "AI." hit
place(sfx, shimmer(0.7, 2500), 1.36, 0.35)
for i in range(4):
    place(sfx, pop(1000 + i * 180, 380 + i * 60, 0.1), 1.62 + i * 0.12 + 0.05, 0.38, pan=[-0.6, 0.6, -0.5, 0.5][i])
place(sfx, riser(1.0, 250, 9000), 1.5, 0.30)
place(sfx, stereo_whoosh(0.6, 200, 4000, -0.7, 0.7), 2.15, 0.5)            # orange wipe
place(sfx, boom(1.4), 2.5, 0.65)                                           # drop

# --- Scene B (logo)
place(sfx, whoosh(0.4, 600, 8000), 2.72, 0.22)                             # A stroke
place(sfx, bell(1760, 1.2) * 0.5, 3.08, 0.32); place(sfx, bell(2637, 1.0) * 0.25, 3.08, 0.32)     # dot ding
for i in range(8):
    place(sfx, click(6000, 0.025), 3.32 + i * 0.04, 0.10, pan=-0.5 + i * 0.14)
place(sfx, shimmer(0.9, 1800), 3.62, 0.3)
place(sfx, stereo_whoosh(0.45, 300, 6000, 0.5, -0.8), 4.3, 0.35)           # exit

# --- Scene C (analyze)
place(sfx, stereo_whoosh(0.4, 400, 3000, 0.8, 0.2), 4.5, 0.25)             # card in
for i in range(16):
    place(sfx, click(5000 + rng.uniform(-800, 800), 0.03), 4.78 + i * (0.54 / 16) + rng.uniform(0, 0.006), 0.22, pan=0.4)
place(sfx, click(3000, 0.04) * 1.2, 5.40, 0.4, pan=0.4); place(sfx, pop(700, 300, 0.06), 5.40, 0.4, pan=0.4)  # button
place(sfx, sweep_tone(0.55, 400, 2400), 5.45, 0.25, pan=-0.1)              # scan
for i in range(22):
    tk = 5.65 + 0.95 * (1 - (1 - i / 21) ** (1 / 3)) if False else 5.65 + i * 0.043
    place(sfx, blip(900 + i * 55, 0.035, 90, 0.1), tk, 0.10, pan=0.3)
place(sfx, bell(1318.5, 0.9) * 0.6, 6.6, 0.3, pan=0.3)
place(sfx, bell(1975.5, 1.1) * 0.6, 6.68, 0.3, pan=0.3)
place(sfx, stereo_whoosh(0.4, 300, 6000, 0.3, -0.9), 6.75, 0.32)

# --- Scene D (plan)
place(sfx, pop(500, 120, 0.18) * 1.2, 7.12, 0.45)                          # pillar
for i in range(6):
    a0 = 7.3 + i * 0.14
    place(sfx, whoosh(0.18, 2000, 9000), a0 - 0.05, 0.08, pan=[-0.5, 0.5, 0, -0.5, 0.5, 0][i])
    place(sfx, pop(1300 + i * 120, 500, 0.08), a0 + 0.12, 0.28, pan=[-0.5, 0.5, 0, -0.5, 0.5, 0][i])
place(sfx, bell(1567.98, 0.9) * 0.6, 8.72, 0.28, pan=0.4)                  # highlight
place(sfx, shimmer(0.5, 2600), 8.74, 0.2, pan=0.4)
place(sfx, stereo_whoosh(0.4, 300, 6000, 0.6, -0.8), 9.2, 0.32)

# --- Scene E (write & publish)
place(sfx, stereo_whoosh(0.45, 300, 3000, 0.9, 0.2), 9.5, 0.28)
place(sfx, pop(800, 250, 0.12), 9.82, 0.3, pan=0.2)                        # cover
for i in range(14):
    place(sfx, click(5500 + rng.uniform(-700, 700), 0.025), 9.95 + i * 0.04, 0.16, pan=0.35)
for i in range(4):
    place(sfx, pop(1500 + i * 150, 600, 0.07), 10.55 + i * 0.12, 0.25, pan=0.3)
scale = [72, 74, 76, 79, 81, 84, 88]
for i in range(7):
    m = blip(note(scale[i]), 0.18, 22, 0.25)
    place(sfx, m, 10.74 + i * 0.075, 0.16, pan=-0.3 + i * 0.1)
place(sfx, whoosh(0.2, 1000, 8000, rev=True), 11.15, 0.25)
place(sfx, thud(), 11.45, 0.62, pan=0.3)                                   # stamp
place(sfx, stereo_whoosh(0.4, 300, 6000, 0.3, -0.9), 11.8, 0.32)

# --- Scene F (cited)
place(sfx, blip(1046.5, 0.09, 40) + 0, 12.15, 0.25, pan=0.3)               # message sent
place(sfx, blip(1568, 0.12, 30), 12.22, 0.22, pan=0.3)
place(sfx, stereo_whoosh(0.35, 400, 3000, -0.6, 0.0), 12.3, 0.2)
place(sfx, bell(2093, 1.2) * 0.6, 13.0, 0.32, pan=-0.3); place(sfx, bell(3136, 0.8) * 0.3, 13.0, 0.32, pan=-0.3)
place(sfx, shimmer(0.6, 3000), 13.05, 0.3, pan=-0.3)
place(sfx, riser(0.5, 400, 10000), 13.0, 0.25)
place(sfx, whoosh(0.5, 200, 6000, rev=True), 13.0, 0.35)

# --- Scene G (end)
place(sfx, boom(1.5), 13.5, 0.7)
place(sfx, whoosh(0.35, 800, 8000), 13.62, 0.18)
place(sfx, bell(1760, 1.4) * 0.5, 13.93, 0.3)
place(sfx, pop(900, 350, 0.1), 14.18, 0.32)
place(sfx, shimmer(0.8, 2200), 14.2, 0.2)

sfx = reverb(sfx, 1.2, 4.5, 0.18, seed=5)

# ======================= MIX =======================
mix = mus * 0.9 + drums * 0.75 + sfx * 1.0
# fades
t = np.arange(N) / SR
mix *= np.minimum(1, t / 0.02)[:, None]
mix *= np.clip((15.0 - t) / 0.6, 0, 1)[:, None] ** 1.5
# soft limiter / normalise
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix /= np.abs(mix).max() / 0.95
wavfile.write('audio.wav', SR, (mix * 32767).astype(np.int16))
wavfile.write('music_only.wav', SR, (np.tanh((mus * 0.9 + drums * 0.75) * 1.3) * 0.8 * 32767).astype(np.int16))
print('ok', np.abs(mix).max())
