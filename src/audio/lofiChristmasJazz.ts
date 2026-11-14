/**
 * Procedural Ambient Lo-Fi Christmas Jazz Synthesizer (Web Audio API)
 * Zero external audio assets — generates warm Rhodes chords, upright bass,
 * sparse celesta/bell jazz phrases, brushed drums, and subtle vinyl crackle.
 */

interface ChordStep {
  bass: number; // MIDI note
  chord: number[]; // MIDI notes
  melody: Array<{ beatOffset: number; note: number; dur: number; vel: number }>;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 16-bar warm holiday jazz progression in F Major / D Minor (72 BPM)
const PROGRESSION: ChordStep[] = [
  // 1: Fmaj9
  {
    bass: 41,
    chord: [53, 57, 60, 64, 67],
    melody: [
      { beatOffset: 0.5, note: 72, dur: 1.4, vel: 0.52 },
      { beatOffset: 2.5, note: 76, dur: 1.2, vel: 0.45 },
    ],
  },
  // 2: Dm9
  {
    bass: 38,
    chord: [50, 53, 57, 60, 64],
    melody: [
      { beatOffset: 0.0, note: 77, dur: 1.8, vel: 0.5 },
      { beatOffset: 3.0, note: 74, dur: 0.9, vel: 0.4 },
    ],
  },
  // 3: Gm9
  {
    bass: 43,
    chord: [55, 58, 62, 65, 69],
    melody: [
      { beatOffset: 0.5, note: 74, dur: 1.5, vel: 0.48 },
      { beatOffset: 2.5, note: 70, dur: 1.2, vel: 0.42 },
    ],
  },
  // 4: C13b9 -> C9sus4
  {
    bass: 36,
    chord: [52, 58, 62, 69],
    melody: [
      { beatOffset: 0.0, note: 72, dur: 1.6, vel: 0.46 },
      { beatOffset: 2.5, note: 69, dur: 1.3, vel: 0.38 },
    ],
  },
  // 5: Am7
  {
    bass: 45,
    chord: [57, 60, 64, 67, 71],
    melody: [
      { beatOffset: 1.0, note: 79, dur: 1.6, vel: 0.48 },
      { beatOffset: 3.0, note: 76, dur: 0.9, vel: 0.42 },
    ],
  },
  // 6: D7alt
  {
    bass: 38,
    chord: [54, 60, 64, 68],
    melody: [{ beatOffset: 0.5, note: 75, dur: 2.2, vel: 0.44 }],
  },
  // 7: Gm9
  {
    bass: 43,
    chord: [55, 58, 62, 65, 69],
    melody: [
      { beatOffset: 0.0, note: 74, dur: 1.5, vel: 0.48 },
      { beatOffset: 2.0, note: 77, dur: 1.5, vel: 0.46 },
    ],
  },
  // 8: C13
  {
    bass: 36,
    chord: [52, 58, 62, 69],
    melody: [{ beatOffset: 1.5, note: 76, dur: 2.0, vel: 0.45 }],
  },
  // 9: Bbmaj9
  {
    bass: 46,
    chord: [58, 62, 65, 69, 72],
    melody: [
      { beatOffset: 0.5, note: 77, dur: 1.8, vel: 0.52 },
      { beatOffset: 2.5, note: 81, dur: 1.3, vel: 0.46 },
    ],
  },
  // 10: Bbm6
  {
    bass: 46,
    chord: [58, 61, 65, 67],
    melody: [{ beatOffset: 0.5, note: 79, dur: 2.4, vel: 0.44 }],
  },
  // 11: Am7 -> Abdim7
  {
    bass: 45,
    chord: [57, 60, 64, 67],
    melody: [
      { beatOffset: 0.0, note: 76, dur: 1.4, vel: 0.46 },
      { beatOffset: 2.5, note: 74, dur: 1.3, vel: 0.42 },
    ],
  },
  // 12: Gm9
  {
    bass: 43,
    chord: [55, 58, 62, 65, 69],
    melody: [{ beatOffset: 1.0, note: 72, dur: 2.2, vel: 0.45 }],
  },
  // 13: C9sus4
  {
    bass: 36,
    chord: [55, 58, 62, 65],
    melody: [
      { beatOffset: 0.5, note: 74, dur: 1.4, vel: 0.46 },
      { beatOffset: 2.5, note: 72, dur: 1.3, vel: 0.42 },
    ],
  },
  // 14: C7b9
  {
    bass: 36,
    chord: [52, 58, 61, 67],
    melody: [{ beatOffset: 0.5, note: 73, dur: 2.0, vel: 0.4 }],
  },
  // 15: Fmaj9
  {
    bass: 41,
    chord: [53, 57, 60, 64, 67],
    melody: [
      { beatOffset: 0.0, note: 76, dur: 1.8, vel: 0.5 },
      { beatOffset: 2.5, note: 72, dur: 1.4, vel: 0.44 },
    ],
  },
  // 16: D7#9 turnaround
  {
    bass: 38,
    chord: [54, 60, 65, 69],
    melody: [{ beatOffset: 1.5, note: 74, dur: 1.8, vel: 0.4 }],
  },
];

function createTapeSaturationCurve(amount = 8): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

function createNoiseBuffer(ctx: AudioContext, seconds: number, crackleDensity = 0): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + white * 0.029;
    b1 = 0.985 * b1 + white * 0.032;
    b2 = 0.95 * b2 + white * 0.048;
    let sample = (b0 + b1 + b2 + white * 0.02) * 0.25;

    if (crackleDensity > 0 && Math.random() < crackleDensity) {
      sample += (Math.random() * 2 - 1) * 0.42;
    }
    data[i] = Math.max(-1, Math.min(1, sample));
  }
  return buffer;
}

export class LofiChristmasJazzPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private wetBus: GainNode | null = null;
  private vinylSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private schedulerId: number | null = null;
  private nextBarTime = 0;
  private currentBarIndex = 0;

  private readonly bpm = 72;
  private readonly beatSec = 60 / 72;
  private readonly barSec = (60 / 72) * 4;

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;

    // Warm master output chain: lowpass tape warmth -> soft saturation -> master gain -> speakers
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;

    const tapeLowpass = ctx.createBiquadFilter();
    tapeLowpass.type = 'lowpass';
    tapeLowpass.frequency.value = 2850;
    tapeLowpass.Q.value = 0.65;

    const shaper = ctx.createWaveShaper();
    shaper.curve = createTapeSaturationCurve(1.65);
    shaper.oversample = '2x';

    const dryBus = ctx.createGain();
    dryBus.gain.value = 0.85;

    const wetBus = ctx.createGain();
    wetBus.gain.value = 0.36;

    // Warm stereo-feel feedback delay room ambience
    const delayL = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.36;
    const delayR = ctx.createDelay(1.0);
    delayR.delayTime.value = 0.54;

    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 1450;

    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.34;

    wetBus.connect(delayL);
    delayL.connect(fbFilter);
    fbFilter.connect(fbGain);
    fbGain.connect(delayR);
    delayR.connect(delayL);

    delayL.connect(tapeLowpass);
    delayR.connect(tapeLowpass);
    dryBus.connect(tapeLowpass);

    tapeLowpass.connect(shaper);
    shaper.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.masterGain = masterGain;
    this.dryBus = dryBus;
    this.wetBus = wetBus;
    this.noiseBuffer = createNoiseBuffer(ctx, 4.0, 0.00055);

    return ctx;
  }

  private startVinylBed() {
    if (!this.ctx || !this.dryBus || !this.noiseBuffer || this.vinylSource) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 0.6;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.022;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    src.start();

    this.vinylSource = src;
  }

  private stopVinylBed() {
    if (this.vinylSource) {
      try {
        this.vinylSource.stop();
        this.vinylSource.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.vinylSource = null;
    }
  }

  private triggerRhodesNote(freq: number, startTime: number, dur: number, vel: number) {
    if (!this.ctx || !this.dryBus || !this.wetBus) return;
    const ctx = this.ctx;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    // Subtle analog pitch drift (lo-fi wow)
    osc1.detune.setValueAtTime((Math.random() - 0.5) * 9, startTime);
    osc2.detune.setValueAtTime((Math.random() - 0.5) * 12, startTime);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.14 * vel, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.015, startTime + Math.min(dur, 0.45));

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.095 * vel, startTime + 0.028);
    env.gain.exponentialRampToValueAtTime(0.038 * vel, startTime + Math.max(0.25, dur * 0.45));
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc1.connect(env);
    osc2.connect(overtoneGain);
    overtoneGain.connect(env);

    env.connect(this.dryBus);
    env.connect(this.wetBus);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + dur + 0.05);
    osc2.stop(startTime + dur + 0.05);
  }

  private triggerBassNote(freq: number, startTime: number, dur: number, vel = 1.0) {
    if (!this.ctx || !this.dryBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, startTime);
    lp.frequency.exponentialRampToValueAtTime(190, startTime + dur * 0.7);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.19 * vel, startTime + 0.032);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(lp);
    lp.connect(env);
    env.connect(this.dryBus);

    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
  }

  private triggerCelestaNote(freq: number, startTime: number, dur: number, vel: number) {
    if (!this.ctx || !this.dryBus || !this.wetBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 7, startTime);

    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(freq * 3, startTime);

    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.08 * vel, startTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.085 * vel, startTime + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(env);
    chime.connect(chimeGain);
    chimeGain.connect(env);

    env.connect(this.dryBus);
    env.connect(this.wetBus);

    osc.start(startTime);
    chime.start(startTime);
    osc.stop(startTime + dur + 0.05);
    chime.stop(startTime + dur + 0.05);
  }

  private triggerBrushHit(startTime: number, accent = 1.0) {
    if (!this.ctx || !this.dryBus || !this.noiseBuffer) return;
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3400;
    hp.Q.value = 0.8;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.022 * accent, startTime + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.dryBus);

    src.start(startTime, Math.random() * 2.5, 0.16);
  }

  private triggerSoftKick(startTime: number) {
    if (!this.ctx || !this.dryBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.14);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.14, startTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

    osc.connect(env);
    env.connect(this.dryBus);

    osc.start(startTime);
    osc.stop(startTime + 0.24);
  }

  private scheduleBar(barIndex: number, barStartTime: number) {
    const step = PROGRESSION[barIndex % PROGRESSION.length];
    const nextStep = PROGRESSION[(barIndex + 1) % PROGRESSION.length];

    // 1. Rolled Rhodes jazz chord on beat 1 (plus gentle ghost re-strike on beat 3.5 occasionally)
    step.chord.forEach((midi, idx) => {
      const strumOffset = idx * 0.028 + Math.random() * 0.01;
      const vel = 0.78 + Math.random() * 0.18;
      this.triggerRhodesNote(midiToFreq(midi), barStartTime + strumOffset, this.barSec * 0.92, vel);
    });

    // Subtle harmonic anticipation on beat 3.5 for lush lo-fi flow
    if (barIndex % 2 === 1) {
      const anticipationTime = barStartTime + this.beatSec * 3.5;
      step.chord.slice(1, 4).forEach((midi, idx) => {
        this.triggerRhodesNote(
          midiToFreq(midi),
          anticipationTime + idx * 0.02,
          this.beatSec * 0.75,
          0.35
        );
      });
    }

    // 2. Warm upright bass on beat 1 & gentle chromatic/fifth pickup on beat 3.5
    this.triggerBassNote(midiToFreq(step.bass), barStartTime, this.beatSec * 2.6, 0.95);
    const pickupMidi = Math.random() > 0.45 ? nextStep.bass + 7 : step.bass + 7;
    this.triggerBassNote(
      midiToFreq(pickupMidi),
      barStartTime + this.beatSec * 2.95,
      this.beatSec * 0.95,
      0.62
    );

    // 3. Sparse, nostalgic celesta/bell jazz melody phrases
    for (const m of step.melody) {
      const humanJitter = (Math.random() - 0.5) * 0.024;
      const t = barStartTime + m.beatOffset * this.beatSec + humanJitter;
      this.triggerCelestaNote(midiToFreq(m.note), t, m.dur * this.beatSec, m.vel);
    }

    // 4. Soft brushed jazz swing percussion (kick on 1 & 2.66, brushes on 2 & 4 + swing offbeats)
    this.triggerSoftKick(barStartTime);
    this.triggerSoftKick(barStartTime + this.beatSec * 2.66);
    this.triggerBrushHit(barStartTime + this.beatSec * 1.0, 1.0);
    this.triggerBrushHit(barStartTime + this.beatSec * 1.66, 0.5);
    this.triggerBrushHit(barStartTime + this.beatSec * 3.0, 0.95);
    this.triggerBrushHit(barStartTime + this.beatSec * 3.66, 0.48);
  }

  private scheduleAhead = () => {
    if (!this.isPlaying || !this.ctx) return;
    const lookAhead = 0.6;
    while (this.nextBarTime < this.ctx.currentTime + lookAhead) {
      this.scheduleBar(this.currentBarIndex, this.nextBarTime);
      this.nextBarTime += this.barSec;
      this.currentBarIndex = (this.currentBarIndex + 1) % PROGRESSION.length;
    }
  };

  public async play(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (this.isPlaying) return;
    this.isPlaying = true;

    this.startVinylBed();

    if (this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.68, now + 0.55);
    }

    this.nextBarTime = ctx.currentTime + 0.08;
    this.scheduleAhead();
    this.schedulerId = window.setInterval(this.scheduleAhead, 180);
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.35);

      const ctxRef = this.ctx;
      window.setTimeout(() => {
        if (!this.isPlaying && ctxRef.state === 'running') {
          this.stopVinylBed();
          void ctxRef.suspend();
        }
      }, 380);
    }
  }

  public dispose(): void {
    this.isPlaying = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    this.stopVinylBed();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.dryBus = null;
    this.wetBus = null;
    this.noiseBuffer = null;
  }
}
