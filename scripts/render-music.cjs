#!/usr/bin/env node
// render-music.js — Offline renderer for Doom-style procedural music
// Synthesizes each track style as raw PCM, then encodes to OGG via ffmpeg.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const TOTAL_STEPS = 512;

const TRACK_CONFIG = {
  inferno:  { bpm: 125, name: 'Inferno' },
  darkness: { bpm: 70,  name: 'Darkness' },
  rampage:  { bpm: 155, name: 'Rampage' },
  eerie:    { bpm: 88,  name: 'Eerie' },
  doom:     { bpm: 108, name: 'Doom' },
};

// ===================== UTILITY =====================

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function makeDistortionCurve(amount) {
  const k = amount;
  const n = 44100;
  const curve = new Float64Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; ++i) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 18 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

const distortionCurve = makeDistortionCurve(75);

function applyDistortion(sample) {
  // Map sample (-1..1) through distortion curve
  const idx = Math.floor((sample + 1) * 0.5 * (distortionCurve.length - 1));
  const clamped = Math.max(0, Math.min(distortionCurve.length - 1, idx));
  return distortionCurve[clamped];
}

// ===================== SOUND SYNTHESIS =====================

// White noise buffer (reuse)
const NOISE_LEN = Math.floor(SAMPLE_RATE * 0.5);
const noiseBuffer = new Float64Array(NOISE_LEN);
for (let i = 0; i < NOISE_LEN; i++) noiseBuffer[i] = Math.random() * 2 - 1;

function renderKick(buf, offset, sampleRate) {
  // Sine sweep 150Hz -> 30Hz over 0.12s, decay 0.25s
  const duration = 0.25;
  const numSamples = Math.floor(duration * sampleRate);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 150 * Math.pow(30 / 150, t / 0.12);
    const env = 0.8 * Math.exp(-t / 0.08);
    const sample = Math.sin(2 * Math.PI * freq * t) * env;
    const idx = offset + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += sample;
  }
}

function renderSnare(buf, offset, sampleRate) {
  // Noise component: bandpass ~3000Hz, decay 0.15s
  const noiseDuration = 0.15;
  const noiseSamples = Math.floor(noiseDuration * sampleRate);
  const centerFreq = 3000;
  const bw = 2000; // bandwidth
  for (let i = 0; i < noiseSamples; i++) {
    const t = i / sampleRate;
    const env = 0.35 * Math.exp(-t / 0.04);
    // Simple bandpass: multiply by 2*cos(2*pi*f*t) then lowpass
    // Approximate: use noise * envelope * modulation
    const noiseSample = noiseBuffer[(offset + i) % noiseBuffer.length];
    const modulated = noiseSample * Math.cos(2 * Math.PI * centerFreq * t);
    const bandpassed = modulated * Math.exp(-t * 3); // decay modulation
    const sample = bandpassed * env * 3;
    const idx = offset + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += sample;
  }

  // Body: triangle 180Hz, decay 0.08s
  const bodyDuration = 0.08;
  const bodySamples = Math.floor(bodyDuration * sampleRate);
  for (let i = 0; i < bodySamples; i++) {
    const t = i / sampleRate;
    const env = 0.25 * Math.exp(-t / 0.025);
    const phase = 2 * Math.PI * 180 * t;
    // Triangle wave
    const tri = 2 * Math.abs(2 * ((phase / (2 * Math.PI)) % 1) - 1) - 1;
    const sample = tri * env;
    const idx = offset + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += sample;
  }
}

function renderHiHat(buf, offset, sampleRate) {
  const duration = 0.04;
  const numSamples = Math.floor(duration * sampleRate);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = 0.12 * Math.exp(-t / 0.008);
    const noiseSample = noiseBuffer[(offset + i) % noiseBuffer.length];
    // Highpass approximation: differentiate the noise
    const nextNoise = noiseBuffer[(offset + i + 1) % noiseBuffer.length];
    const hp = (nextNoise - noiseSample) * 0.5 + noiseSample * 0.5;
    // Simpler: just use noise * env since high frequencies dominate
    const sample = noiseSample * env * 2;
    const idx = offset + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += sample;
  }
}

function renderCrash(buf, offset, sampleRate) {
  const duration = 0.8;
  const numSamples = Math.floor(duration * sampleRate);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = 0.4 * Math.exp(-t / 0.2);
    const noiseSample = noiseBuffer[(offset + i) % noiseBuffer.length];
    // Crash has more sustain, higher frequencies
    const sample = noiseSample * env * 1.5;
    const idx = offset + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += sample;
  }
}

// One-pole lowpass filter state
class LowPassFilter {
  constructor(cutoff, sampleRate) {
    this.rc = 1 / (2 * Math.PI * cutoff);
    this.dt = 1 / sampleRate;
    this.alpha = this.dt / (this.rc + this.dt);
    this.lastOut = 0;
  }
  process(sample) {
    this.lastOut = this.lastOut + this.alpha * (sample - this.lastOut);
    return this.lastOut;
  }
}

function renderGuitarNote(buf, offset, midiNote, duration, type, sampleRate) {
  const freq = midiToFreq(midiNote);
  const numSamples = Math.floor((duration + 0.05) * sampleRate);
  const detuneFreq = freq * Math.pow(2, 8 / 1200); // +8 cents

  if (type === 'clean') {
    // Clean: sawtooth, gentle lowpass at 2500Hz
    const filter = new LowPassFilter(2500, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      if (t > duration) break;
      // Envelope
      let env;
      if (t < 0.01) {
        env = 0.15 * (t / 0.01);
      } else if (t < duration * 0.5) {
        env = 0.15 * Math.exp(-3 * (t - 0.01));
      } else if (t < duration - 0.02) {
        env = 0.06;
      } else {
        const fadeT = (t - (duration - 0.02)) / 0.02;
        env = 0.06 * (1 - fadeT);
      }
      // Sawtooth
      const phase1 = (freq * t) % 1;
      const saw1 = 2 * phase1 - 1;
      const phase2 = (detuneFreq * t) % 1;
      const saw2 = 2 * phase2 - 1;
      const sample = filter.process(0.5 * saw1 + 0.5 * saw2) * env;
      const idx = offset + i;
      if (idx >= 0 && idx < buf.length) buf[idx] += sample;
    }
  } else {
    // Distorted: sawtooth -> distortion -> lowpass at 1400Hz
    const filter = new LowPassFilter(1400, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      if (t > duration) break;
      // Envelope
      let env;
      if (type === 'mute') {
        if (t < 0.003) {
          env = 0.2 * (t / 0.003);
        } else if (t < 0.08) {
          env = 0.2 * Math.exp(-30 * (t - 0.003));
        } else if (t < duration - 0.01) {
          env = 0.01;
        } else {
          const fadeT = (t - (duration - 0.01)) / 0.01;
          env = 0.01 * (1 - fadeT);
        }
      } else { // 'open'
        if (t < 0.003) {
          env = 0.2 * (t / 0.003);
        } else if (t < 0.25) {
          env = 0.2 * Math.exp(-2 * (t - 0.003));
        } else if (t < duration - 0.02) {
          env = 0.15;
        } else {
          const fadeT = (t - (duration - 0.02)) / 0.02;
          env = 0.15 * (1 - fadeT);
        }
      }
      // Sawtooth with detune
      const phase1 = (freq * t) % 1;
      const saw1 = 2 * phase1 - 1;
      const phase2 = (detuneFreq * t) % 1;
      const saw2 = 2 * phase2 - 1;
      const mixed = 0.5 * saw1 + 0.5 * saw2;
      // Apply distortion
      const distorted = applyDistortion(mixed);
      const sample = filter.process(distorted) * env;
      const idx = offset + i;
      if (idx >= 0 && idx < buf.length) buf[idx] += sample;
    }
  }
}

function renderBassNote(buf, offset, midiNote, duration, sampleRate) {
  const freq = midiToFreq(midiNote);
  const numSamples = Math.floor((duration + 0.01) * sampleRate);
  const detuneFreq = freq * Math.pow(2, 3 / 1200); // +3 cents
  const filter = new LowPassFilter(400, sampleRate);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    if (t > duration) break;
    // Envelope
    let env;
    if (t < 0.005) {
      env = 0.25 * (t / 0.005);
    } else if (t < 0.1) {
      env = 0.25 * Math.exp(-1 * (t - 0.005));
    } else if (t < duration - 0.05) {
      env = 0.2;
    } else {
      const fadeT = (t - (duration - 0.05)) / 0.05;
      env = 0.2 * (1 - fadeT);
    }
    // Sine + sawtooth through lowpass
    const sine = Math.sin(2 * Math.PI * freq * t);
    const phase = (detuneFreq * t) % 1;
    const saw = 2 * phase - 1;
    const sample = filter.process(0.6 * sine + 0.4 * saw) * env;
    const idx = offset + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += sample;
  }
}

// ===================== PATTERN DATA =====================

function generateInferno() {
  const guitarPattern = [];
  const bassPattern = [];
  const drumPattern = new Map();

  const E_RIFF = [
    { step: 0, note: 40, duration: 1, type: 'mute' },
    { step: 1, note: 40, duration: 1, type: 'mute' },
    { step: 2, note: 52, duration: 2, type: 'open' },
    { step: 4, note: 40, duration: 1, type: 'mute' },
    { step: 5, note: 40, duration: 1, type: 'mute' },
    { step: 6, note: 50, duration: 2, type: 'open' },
    { step: 8, note: 40, duration: 1, type: 'mute' },
    { step: 9, note: 40, duration: 1, type: 'mute' },
    { step: 10, note: 48, duration: 2, type: 'open' },
    { step: 12, note: 40, duration: 1, type: 'mute' },
    { step: 13, note: 40, duration: 1, type: 'mute' },
    { step: 14, note: 46, duration: 2, type: 'open' },
  ];

  const E_RIFF2 = [
    { step: 0, note: 40, duration: 1, type: 'mute' },
    { step: 1, note: 40, duration: 1, type: 'mute' },
    { step: 2, note: 47, duration: 2, type: 'open' },
    { step: 4, note: 43, duration: 2, type: 'open' },
    { step: 6, note: 42, duration: 2, type: 'open' },
    { step: 8, note: 40, duration: 4, type: 'open' },
    { step: 12, note: 40, duration: 4, type: 'open' },
  ];

  const addSegment = (barStart, transpose, riff, riff2) => {
    const sOff = barStart * 16;
    for (const n of riff) {
      guitarPattern.push({ step: sOff + n.step, note: n.note + transpose, duration: n.duration, type: n.type });
      bassPattern.push({ step: sOff + n.step, note: (n.note === 40 ? 28 : n.note - 12) + transpose, duration: n.duration });
    }
    for (const n of riff2) {
      guitarPattern.push({ step: sOff + 16 + n.step, note: n.note + transpose, duration: n.duration, type: n.type });
      bassPattern.push({ step: sOff + 16 + n.step, note: (n.note === 40 ? 28 : n.note - 12) + transpose, duration: n.duration });
    }
    for (let s = 0; s < 32; s += 2) {
      drumPattern.set(sOff + s, 'hat');
    }
    drumPattern.set(sOff + 0, 'kick');
    drumPattern.set(sOff + 8, 'kick');
    drumPattern.set(sOff + 4, 'snare');
    drumPattern.set(sOff + 12, 'snare');
  };

  addSegment(0, 0, E_RIFF, E_RIFF2);
  addSegment(2, 0, E_RIFF, E_RIFF2);
  addSegment(4, 0, E_RIFF, E_RIFF2);
  addSegment(6, 0, E_RIFF, E_RIFF2);
  addSegment(8, 5, E_RIFF, E_RIFF2);
  addSegment(10, 5, E_RIFF, E_RIFF2);
  addSegment(12, 0, E_RIFF, E_RIFF2);
  addSegment(14, 0, E_RIFF, E_RIFF2);

  // Bridge bars 16-23
  const chords = [
    { bar: 16, note: 40, bass: 28 },
    { bar: 18, note: 36, bass: 24 },
    { bar: 20, note: 38, bass: 26 },
    { bar: 22, note: 35, bass: 23 },
  ];
  for (const c of chords) {
    const off = c.bar * 16;
    for (let s = 0; s < 32; s += 2) {
      guitarPattern.push({ step: off + s, note: c.note, duration: 2, type: 'mute' });
      guitarPattern.push({ step: off + s, note: c.note + 7, duration: 2, type: 'open' });
      if (s % 4 === 0) bassPattern.push({ step: off + s, note: c.bass, duration: 4 });
    }
    drumPattern.set(off + 0, 'kick');
    drumPattern.set(off + 8, 'kick');
    drumPattern.set(off + 4, 'snare');
    drumPattern.set(off + 12, 'snare');
  }

  const melodyNotes = [
    [16, 59, 8], [16, 67, 8], [17, 64, 16],
    [18, 67, 8], [18, 66, 8], [19, 64, 8], [19, 62, 8],
    [20, 57, 8], [20, 60, 8], [21, 62, 16],
    [22, 66, 8], [22, 64, 8], [23, 62, 8], [23, 59, 8],
  ];
  for (const [bar, note, dur] of melodyNotes) {
    guitarPattern.push({ step: bar * 16, note, duration: dur, type: 'open' });
  }

  // Bars 24-31
  addSegment(24, 12, E_RIFF, E_RIFF2);
  addSegment(26, 12, E_RIFF, E_RIFF2);
  addSegment(28, 12, E_RIFF, E_RIFF2);

  const end = 30 * 16;
  for (let s = 0; s < 24; s += 2) {
    guitarPattern.push({ step: end + s, note: 40, duration: 2, type: 'mute' });
    bassPattern.push({ step: end + s, note: 28, duration: 2 });
    drumPattern.set(end + s, 'kick');
  }
  guitarPattern.push({ step: end + 24, note: 45, duration: 2, type: 'open' });
  guitarPattern.push({ step: end + 26, note: 47, duration: 2, type: 'open' });
  guitarPattern.push({ step: end + 28, note: 48, duration: 8, type: 'open' });
  drumPattern.set(end + 24, 'crash');

  return { guitarPattern, bassPattern, drumPattern };
}

function generateDarkness() {
  const guitarPattern = [];
  const bassPattern = [];
  const drumPattern = new Map();

  const drones = [
    [0, 24, 64], [64, 25, 64], [128, 23, 64], [192, 26, 64],
    [256, 24, 64], [320, 27, 64], [384, 25, 64], [448, 24, 128],
  ];
  for (const [step, note, dur] of drones) {
    bassPattern.push({ step, note, duration: dur });
    guitarPattern.push({ step, note: note + 12, duration: dur, type: 'clean' });
  }

  const chords = [
    [16, [36, 39, 43]], [80, [37, 40, 44]], [144, [35, 39, 42]], [208, [36, 40, 43]],
    [272, [37, 41, 44]], [336, [35, 38, 42]], [400, [36, 39, 43]], [464, [36, 38, 42]],
  ];
  for (const [step, notes] of chords) {
    for (const n of notes) {
      guitarPattern.push({ step, note: n, duration: 12, type: 'clean' });
    }
    drumPattern.set(step, 'kick');
  }

  for (let bar = 0; bar < 32; bar += 3) {
    const step = bar * 16;
    guitarPattern.push({ step: step + 8, note: 60 + (bar % 12), duration: 4, type: 'clean' });
  }

  for (let bar = 0; bar < 32; bar += 8) {
    drumPattern.set(bar * 16 + 8, 'snare');
  }

  return { guitarPattern, bassPattern, drumPattern };
}

function generateRampage() {
  const guitarPattern = [];
  const bassPattern = [];
  const drumPattern = new Map();

  const chugPattern = (startBar, root, bars) => {
    for (let b = 0; b < bars; b++) {
      const off = (startBar + b) * 16;
      for (let s = 0; s < 16; s += 2) {
        guitarPattern.push({ step: off + s, note: root, duration: 1, type: 'mute' });
        bassPattern.push({ step: off + s, note: root - 12, duration: 1 });
      }
      guitarPattern.push({ step: off + 6, note: root + 7, duration: 2, type: 'open' });
      guitarPattern.push({ step: off + 14, note: root + 5, duration: 2, type: 'open' });
      for (let s = 0; s < 16; s += 2) drumPattern.set(off + s, 'kick');
      for (let s = 4; s < 16; s += 4) drumPattern.set(off + s, 'snare');
      for (let s = 1; s < 16; s += 2) drumPattern.set(off + s, 'hat');
    }
  };

  chugPattern(0, 40, 4);
  chugPattern(4, 43, 4);
  chugPattern(8, 41, 4);
  chugPattern(12, 43, 4);

  // Breakdown bars 16-23
  const roots = [40, 40, 36, 36, 41, 41, 43, 43];
  for (let b = 0; b < 8; b++) {
    const off = (16 + b) * 16;
    const root = roots[b];
    guitarPattern.push({ step: off, note: root, duration: 4, type: 'open' });
    guitarPattern.push({ step: off + 8, note: root + 7, duration: 4, type: 'open' });
    bassPattern.push({ step: off, note: root - 12, duration: 8 });
    bassPattern.push({ step: off + 8, note: root - 12, duration: 8 });
    drumPattern.set(off, 'kick');
    drumPattern.set(off + 4, 'snare');
    drumPattern.set(off + 8, 'kick');
    drumPattern.set(off + 12, 'snare');
    for (let s = 2; s < 16; s += 2) drumPattern.set(off + s, 'hat');
  }

  chugPattern(24, 40, 2);
  chugPattern(26, 43, 2);
  chugPattern(28, 41, 2);

  // Final bars
  const end = 30 * 16;
  for (let s = 0; s < 32; s += 2) {
    guitarPattern.push({ step: end + s, note: s < 16 ? 40 : 43, duration: 1, type: 'mute' });
    bassPattern.push({ step: end + s, note: s < 16 ? 28 : 31, duration: 1 });
    drumPattern.set(end + s, s % 4 === 0 ? 'kick' : s % 4 === 2 ? 'snare' : 'hat');
  }
  drumPattern.set(end, 'crash');

  return { guitarPattern, bassPattern, drumPattern };
}

function generateEerie() {
  const guitarPattern = [];
  const bassPattern = [];
  const drumPattern = new Map();

  const chords = [
    [0, [50, 53, 57]],
    [64, [48, 52, 55]],
    [128, [46, 50, 53]],
    [192, [45, 48, 53]],
    [256, [50, 53, 57]],
    [320, [53, 57, 60]],
    [384, [48, 52, 55]],
    [448, [50, 53, 57]],
  ];

  for (const [startStep, notes] of chords) {
    for (let rep = 0; rep < 4; rep++) {
      const off = startStep + rep * 16;
      for (let i = 0; i < notes.length; i++) {
        guitarPattern.push({ step: off + i * 4, note: notes[i], duration: 6, type: 'clean' });
      }
      guitarPattern.push({ step: off + 12, note: notes[notes.length - 1] + 12, duration: 4, type: 'clean' });
    }
    bassPattern.push({ step: startStep, note: notes[0] - 24, duration: 64 });
    drumPattern.set(startStep, 'kick');
    if (startStep % 128 === 0) drumPattern.set(startStep + 32, 'snare');
  }

  const eerieHits = [
    [8, 74], [24, 71], [40, 69], [56, 67],
    [72, 74], [88, 72], [104, 69], [120, 67],
    [136, 71], [152, 69], [168, 67], [184, 66],
    [200, 74], [216, 72], [232, 71], [248, 69],
    [264, 67], [280, 66], [296, 69], [312, 71],
    [328, 74], [344, 72], [360, 71], [376, 69],
    [392, 67], [408, 69], [424, 71], [440, 74],
    [456, 72], [472, 71], [488, 69], [504, 67],
  ];
  for (const [step, note] of eerieHits) {
    guitarPattern.push({ step, note, duration: 8, type: 'clean' });
  }

  return { guitarPattern, bassPattern, drumPattern };
}

function generateDoom() {
  const guitarPattern = [];
  const bassPattern = [];
  const drumPattern = new Map();

  const powerChords = [
    [0, 40, 2], [2, 45, 2], [4, 43, 2], [6, 40, 2],
    [8, 42, 2], [10, 47, 2], [12, 45, 2], [14, 43, 2],
    [16, 36, 2], [18, 40, 2], [20, 43, 2], [22, 47, 2],
    [24, 45, 2], [26, 43, 2], [28, 42, 2], [30, 40, 2],
  ];

  for (const [bar, root, durBars] of powerChords) {
    const off = bar * 16;
    const durSteps = durBars * 16;
    guitarPattern.push({ step: off, note: root, duration: durSteps, type: 'open' });
    guitarPattern.push({ step: off, note: root + 7, duration: durSteps, type: 'open' });
    for (let s = 0; s < durSteps; s += 4) {
      guitarPattern.push({ step: off + s, note: root, duration: 2, type: 'mute' });
    }
    bassPattern.push({ step: off, note: root - 12, duration: 8 });
    bassPattern.push({ step: off + 8, note: root - 12, duration: 8 });
    if (durSteps > 16) {
      bassPattern.push({ step: off + 16, note: root - 12, duration: 8 });
      bassPattern.push({ step: off + 24, note: root - 12, duration: 8 });
    }
    drumPattern.set(off, 'kick');
    drumPattern.set(off + 4, 'snare');
    drumPattern.set(off + 8, 'kick');
    drumPattern.set(off + 12, 'snare');
    if (durSteps > 16) {
      drumPattern.set(off + 16, 'kick');
      drumPattern.set(off + 20, 'snare');
      drumPattern.set(off + 24, 'kick');
      drumPattern.set(off + 28, 'snare');
    }
  }

  const melody = [
    [24 * 16, 64, 8], [24 * 16 + 8, 68, 8], [25 * 16, 71, 16],
    [26 * 16, 69, 8], [26 * 16 + 8, 68, 8], [27 * 16, 66, 16],
    [28 * 16, 64, 8], [28 * 16 + 8, 63, 8], [29 * 16, 64, 16],
    [30 * 16, 68, 8], [30 * 16 + 8, 71, 8], [31 * 16, 76, 16],
  ];
  for (const [step, note, dur] of melody) {
    guitarPattern.push({ step, note, duration: dur, type: 'open' });
  }
  drumPattern.set(30 * 16, 'crash');

  return { guitarPattern, bassPattern, drumPattern };
}

// ===================== RENDER =====================

function renderTrack(style) {
  const config = TRACK_CONFIG[style];
  const bpm = config.bpm;
  const secondsPerStep = 60.0 / bpm / 4;
  const totalDuration = TOTAL_STEPS * secondsPerStep + 1.0; // extra for tail
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  console.log(`  Rendering ${style} (${bpm} BPM, ${totalDuration.toFixed(1)}s, ${totalSamples} samples)...`);

  // Generate pattern data
  let patterns;
  switch (style) {
    case 'inferno': patterns = generateInferno(); break;
    case 'darkness': patterns = generateDarkness(); break;
    case 'rampage': patterns = generateRampage(); break;
    case 'eerie': patterns = generateEerie(); break;
    case 'doom': patterns = generateDoom(); break;
  }

  const { guitarPattern, bassPattern, drumPattern } = patterns;

  // Create stereo buffer
  const leftBuf = new Float64Array(totalSamples);
  const rightBuf = new Float64Array(totalSamples);

  // Schedule all sounds
  for (const note of guitarPattern) {
    const startSample = Math.floor(note.step * secondsPerStep * SAMPLE_RATE);
    const noteDuration = note.duration * secondsPerStep;
    renderGuitarNote(leftBuf, startSample, note.note, noteDuration, note.type, SAMPLE_RATE);
    renderGuitarNote(rightBuf, startSample, note.note, noteDuration, note.type, SAMPLE_RATE);
  }

  for (const note of bassPattern) {
    const startSample = Math.floor(note.step * secondsPerStep * SAMPLE_RATE);
    const noteDuration = note.duration * secondsPerStep;
    renderBassNote(leftBuf, startSample, note.note, noteDuration, SAMPLE_RATE);
    renderBassNote(rightBuf, startSample, note.note, noteDuration, SAMPLE_RATE);
  }

  for (const [step, drumType] of drumPattern) {
    const startSample = Math.floor(step * secondsPerStep * SAMPLE_RATE);
    switch (drumType) {
      case 'kick': renderKick(leftBuf, startSample, SAMPLE_RATE); renderKick(rightBuf, startSample, SAMPLE_RATE); break;
      case 'snare': renderSnare(leftBuf, startSample, SAMPLE_RATE); renderSnare(rightBuf, startSample, SAMPLE_RATE); break;
      case 'hat': renderHiHat(leftBuf, startSample, SAMPLE_RATE); renderHiHat(rightBuf, startSample, SAMPLE_RATE); break;
      case 'crash': renderCrash(leftBuf, startSample, SAMPLE_RATE); renderCrash(rightBuf, startSample, SAMPLE_RATE); break;
    }
  }

  // Soft fade-in (0.5s) and fade-out (1s)
  const fadeInSamples = Math.floor(0.5 * SAMPLE_RATE);
  const fadeOutSamples = Math.floor(1.0 * SAMPLE_RATE);
  for (let i = 0; i < fadeInSamples; i++) {
    const gain = i / fadeInSamples;
    leftBuf[i] *= gain;
    rightBuf[i] *= gain;
  }
  for (let i = 0; i < fadeOutSamples; i++) {
    const gain = 1 - (i / fadeOutSamples);
    const idx = totalSamples - fadeOutSamples + i;
    if (idx >= 0 && idx < totalSamples) {
      leftBuf[idx] *= gain;
      rightBuf[idx] *= gain;
    }
  }

  // Clamp
  for (let i = 0; i < totalSamples; i++) {
    leftBuf[i] = Math.max(-1, Math.min(1, leftBuf[i]));
    rightBuf[i] = Math.max(-1, Math.min(1, rightBuf[i]));
  }

  // Convert to 32-bit float interleaved WAV
  return { leftBuf, rightBuf, totalSamples, totalDuration };
}

function writeWAV(leftBuf, rightBuf, totalSamples, filepath) {
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);

  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // WAV header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);       // chunk size
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // Interleave and convert to 16-bit
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const leftSample = Math.max(-1, Math.min(1, leftBuf[i]));
    const rightSample = Math.max(-1, Math.min(1, rightBuf[i]));
    const leftInt = Math.round(leftSample * 32767);
    const rightInt = Math.round(rightSample * 32767);
    buf.writeInt16LE(leftInt, offset);
    offset += 2;
    buf.writeInt16LE(rightInt, offset);
    offset += 2;
  }

  fs.writeFileSync(filepath, buf);
  console.log(`  WAV written: ${filepath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

// ===================== MAIN =====================

const outputDir = path.join(__dirname, '..', 'public', 'audio');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const styles = ['inferno', 'darkness', 'rampage', 'eerie', 'doom'];

for (const style of styles) {
  console.log(`\n=== Rendering ${TRACK_CONFIG[style].name} (${style}) ===`);
  const { leftBuf, rightBuf, totalSamples, totalDuration } = renderTrack(style);

  const wavPath = path.join(outputDir, `${style}.wav`);
  const oggPath = path.join(outputDir, `${style}.ogg`);

  // Write WAV
  writeWAV(leftBuf, rightBuf, totalSamples, wavPath);

  // Convert to OGG with ffmpeg
  console.log(`  Converting to OGG...`);
  try {
    execSync(`ffmpeg -y -i "${wavPath}" -c:a libvorbis -q:a 4 "${oggPath}" 2>/dev/null`);
    const stats = fs.statSync(oggPath);
    console.log(`  ✓ ${style}.ogg written (${(stats.size / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`  ✗ ffmpeg conversion failed:`, err.message);
    process.exit(1);
  }

  // Clean up WAV
  fs.unlinkSync(wavPath);
  console.log(`  WAV cleaned up.`);
}

console.log('\n=== All tracks rendered successfully! ===');