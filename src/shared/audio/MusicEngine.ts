// MusicEngine.ts — Procedural music engine generating 5 Doom-style tracks via Web Audio API
// Each track is synthesized in real-time: no external audio files needed.

export type TrackStyle = 'inferno' | 'darkness' | 'rampage' | 'eerie' | 'doom' | 'classic';

const TRACK_CONFIG: Record<TrackStyle, { bpm: number; name: string }> = {
  inferno:  { bpm: 125, name: 'Inferno' },     // Aggressive metal riff
  darkness: { bpm: 70,  name: 'Darkness' },     // Slow dark ambient
  rampage:  { bpm: 135, name: 'Rampage' },       // Heavy industrial metal
  eerie:    { bpm: 88,  name: 'Eerie' },          // Creepy exploration
  doom:     { bpm: 108, name: 'Doom' },           // Heavy epic march
  classic:  { bpm: 125, name: 'Classic' },         // Original menu track
};

interface SynthNote {
  step: number;
  note: number;
  duration: number;
  type: 'mute' | 'open' | 'clean';
}

interface BassNote {
  step: number;
  note: number;
  duration: number;
}

export const TRACK_STYLES = TRACK_CONFIG;

export class MusicEngine {
  private audioContext: AudioContext | null = null;
  private destination: AudioNode | null = null;
  private isPlaying = false;
  private currentTrack: TrackStyle | null = null;
  private nextNoteTime = 0.0;
  private currentStep = 0;
  private totalSteps = 512;
  private bpm = 125;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lookahead = 50.0; // ms between scheduler polls (was 25, raised for perf)
  private scheduleAheadTime = 0.2; // schedule 200ms ahead (was 100ms, raised for perf)
  private fadeGain: GainNode | null = null;

  private distortionCurve: Float32Array<ArrayBuffer>;
  private noiseBuffer: AudioBuffer | null = null;

  private guitarPattern: SynthNote[] = [];
  private bassPattern: BassNote[] = [];
  private guitarByStep = new Map<number, SynthNote[]>();
  private bassByStep = new Map<number, BassNote[]>();
  private drumPattern = new Map<number, 'kick' | 'snare' | 'hat' | 'crash'>();

  constructor() {
    this.distortionCurve = this.makeDistortionCurve(75);
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = amount;
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 18 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private makeNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 });
    const size = this.audioContext.sampleRate * 0.5;
    const buffer = this.audioContext.createBuffer(1, size, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; ++i) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ===================== PATTERN GENERATORS =====================

  private generateInferno(): void {
    // Heavy metal E minor riff (same style as original MenuSynth)
    const E_RIFF: SynthNote[] = [
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

    const E_RIFF2: SynthNote[] = [
      { step: 0, note: 40, duration: 1, type: 'mute' },
      { step: 1, note: 40, duration: 1, type: 'mute' },
      { step: 2, note: 47, duration: 2, type: 'open' },
      { step: 4, note: 43, duration: 2, type: 'open' },
      { step: 6, note: 42, duration: 2, type: 'open' },
      { step: 8, note: 40, duration: 4, type: 'open' },
      { step: 12, note: 40, duration: 4, type: 'open' },
    ];

    const addSegment = (barStart: number, transpose: number, riff: SynthNote[], riff2: SynthNote[]): void => {
      const sOff = barStart * 16;
      for (const n of riff) {
        this.guitarPattern.push({ step: sOff + n.step, note: n.note + transpose, duration: n.duration, type: n.type });
        this.bassPattern.push({ step: sOff + n.step, note: (n.note === 40 ? 28 : n.note - 12) + transpose, duration: n.duration });
      }
      for (const n of riff2) {
        this.guitarPattern.push({ step: sOff + 16 + n.step, note: n.note + transpose, duration: n.duration, type: n.type });
        this.bassPattern.push({ step: sOff + 16 + n.step, note: (n.note === 40 ? 28 : n.note - 12) + transpose, duration: n.duration });
      }
      // Drums: kick on 1,3; snare on 5,13; hat every 2
      for (let s = 0; s < 32; s += 2) {
        this.drumPattern.set(sOff + s, 'hat');
      }
      this.drumPattern.set(sOff + 0, 'kick');
      this.drumPattern.set(sOff + 8, 'kick');
      this.drumPattern.set(sOff + 4, 'snare');
      this.drumPattern.set(sOff + 12, 'snare');
    };

    // Bars 0-7: E minor riff
    addSegment(0, 0, E_RIFF, E_RIFF2);
    addSegment(2, 0, E_RIFF, E_RIFF2);
    addSegment(4, 0, E_RIFF, E_RIFF2);
    addSegment(6, 0, E_RIFF, E_RIFF2);
    // Bars 8-11: Transposed to A minor
    addSegment(8, 5, E_RIFF, E_RIFF2);
    addSegment(10, 5, E_RIFF, E_RIFF2);
    // Bars 12-15: Back to E minor
    addSegment(12, 0, E_RIFF, E_RIFF2);
    addSegment(14, 0, E_RIFF, E_RIFF2);
    // Bars 16-23: Bridge with melody
    const chords = [
      { bar: 16, note: 40, bass: 28 },
      { bar: 18, note: 36, bass: 24 },
      { bar: 20, note: 38, bass: 26 },
      { bar: 22, note: 35, bass: 23 },
    ];
    for (const c of chords) {
      const off = c.bar * 16;
      for (let s = 0; s < 32; s += 2) {
        this.guitarPattern.push({ step: off + s, note: c.note, duration: 2, type: 'mute' });
        this.guitarPattern.push({ step: off + s, note: c.note + 7, duration: 2, type: 'open' });
        if (s % 4 === 0) this.bassPattern.push({ step: off + s, note: c.bass, duration: 4 });
      }
      this.drumPattern.set(off + 0, 'kick');
      this.drumPattern.set(off + 8, 'kick');
      this.drumPattern.set(off + 4, 'snare');
      this.drumPattern.set(off + 12, 'snare');
    }
    // Melody over bridge
    const melodyNotes: Array<[number, number, number]> = [
      [16, 59, 8], [16, 67, 8], [17, 64, 16],
      [18, 67, 8], [18, 66, 8], [19, 64, 8], [19, 62, 8],
      [20, 57, 8], [20, 60, 8], [21, 62, 16],
      [22, 66, 8], [22, 64, 8], [23, 62, 8], [23, 59, 8],
    ];
    for (const [bar, note, dur] of melodyNotes) {
      this.guitarPattern.push({ step: bar * 16, note, duration: dur, type: 'open' });
    }
    // Bars 24-31: Octave-up finale
    addSegment(24, 12, E_RIFF, E_RIFF2);
    addSegment(26, 12, E_RIFF, E_RIFF2);
    addSegment(28, 12, E_RIFF, E_RIFF2);
    // Final chugs
    const end = 30 * 16;
    for (let s = 0; s < 24; s += 2) {
      this.guitarPattern.push({ step: end + s, note: 40, duration: 2, type: 'mute' });
      this.bassPattern.push({ step: end + s, note: 28, duration: 2 });
      this.drumPattern.set(end + s, 'kick');
    }
    this.guitarPattern.push({ step: end + 24, note: 45, duration: 2, type: 'open' });
    this.guitarPattern.push({ step: end + 26, note: 47, duration: 2, type: 'open' });
    this.guitarPattern.push({ step: end + 28, note: 48, duration: 8, type: 'open' });
    this.drumPattern.set(end + 24, 'crash');
  }

  private generateDarkness(): void {
    // Slow dark ambient — dissonant drones, sparse hits, deep bass
    const drones: Array<[number, number, number]> = [
      // [step, midiNote, duration_in_steps]
      [0, 24, 64],    // C1 drone
      [64, 25, 64],   // C#1 drone
      [128, 23, 64],  // B0 drone
      [192, 26, 64],  // D1 drone
      [256, 24, 64],  // C1 again
      [320, 27, 64],  // D#1 drone
      [384, 25, 64],  // C#1
      [448, 24, 128], // C1 final
    ];
    for (const [step, note, dur] of drones) {
      this.bassPattern.push({ step, note, duration: dur });
      this.guitarPattern.push({ step, note: note + 12, duration: dur, type: 'clean' });
    }
    // Sparse dissonant chords
    const chords: Array<[number, number[]]> = [
      [16, [36, 39, 43]],    // Cm
      [80, [37, 40, 44]],    // C#m
      [144, [35, 39, 42]],   // Bm
      [208, [36, 40, 43]],   // Cm7
      [272, [37, 41, 44]],   // C#m7
      [336, [35, 38, 42]],   // Bdimm
      [400, [36, 39, 43]],   // Cm
      [464, [36, 38, 42]],   // Cdim
    ];
    for (const [step, notes] of chords) {
      for (const n of notes) {
        this.guitarPattern.push({ step, note: n, duration: 12, type: 'clean' });
      }
      this.drumPattern.set(step, 'kick');
    }
    // Sparse bell-like hits
    for (let bar = 0; bar < 32; bar += 3) {
      const step = bar * 16;
      this.guitarPattern.push({ step: step + 8, note: 60 + (bar % 12), duration: 4, type: 'clean' });
    }
    // Very sparse snare every 8 bars
    for (let bar = 0; bar < 32; bar += 8) {
      this.drumPattern.set(bar * 16 + 8, 'snare');
    }
  }

  private generateRampage(): void {
    // Rampage (Dark Metal Version) — heavy drop-D thrash groove in D phrygian
    // Root D2 (38) and bass D1 (26). Tempo: 135 BPM
    
    // Helper to add Riff A (Crushing Drop-D Groove)
    const addRiffA = (startBar: number, bars: number): void => {
      for (let b = 0; b < bars; b++) {
        const off = (startBar + b) * 16;
        
        // Catchy syncopated guitar chugs:
        // Steps: 0, 2, 3, 6, 8, 10, 11, 14
        const chugSteps = [0, 2, 3, 6, 8, 10, 11];
        for (const s of chugSteps) {
          this.guitarPattern.push({ step: off + s, note: 38, duration: 1, type: 'mute' });
          this.bassPattern.push({ step: off + s, note: 26, duration: 1 });
        }
        // Heavy open power chord on step 14 (D5 = 38 & 45)
        this.guitarPattern.push({ step: off + 14, note: 38, duration: 2, type: 'open' });
        this.guitarPattern.push({ step: off + 14, note: 45, duration: 2, type: 'open' });
        this.bassPattern.push({ step: off + 14, note: 26, duration: 2 });
        
        // Massive rolling double-kick drum pattern
        // Kick on 0, 3, 6, 8, 11, 14
        const kickSteps = [0, 3, 6, 8, 11, 14];
        for (const k of kickSteps) this.drumPattern.set(off + k, 'kick');
        
        // Snare on 4, 12
        this.drumPattern.set(off + 4, 'snare');
        this.drumPattern.set(off + 12, 'snare');
        
        // Hats on even steps for constant drive
        for (let s = 0; s < 16; s += 2) {
          if (!this.drumPattern.has(off + s)) {
            this.drumPattern.set(off + s, 'hat');
          }
        }
      }
    };

    // Helper to add Riff B (Sinister Phrygian assault)
    const addRiffB = (startBar: number, bars: number): void => {
      for (let b = 0; b < bars; b++) {
        const off = (startBar + b) * 16;
        
        // Determine moving root based on which bar we are in
        // Alternating roots in D phrygian: Eb2 (39), G2 (43), Bb2 (46), A2 (45), Eb2 (39), D2 (38)
        let root = 38; // D2
        if (b % 4 === 1) root = 39; // Eb2
        else if (b % 4 === 2) root = 43; // G2
        else if (b % 4 === 3) root = b % 8 === 7 ? 45 : 46; // A2 or Bb2
        
        // Driving chugs on moving roots
        for (let s = 0; s < 16; s += 2) {
          this.guitarPattern.push({ step: off + s, note: root, duration: 1, type: 'mute' });
          this.bassPattern.push({ step: off + s, note: root - 12, duration: 1 });
        }
        
        // Accented open hits at 6 and 14
        this.guitarPattern.push({ step: off + 6, note: root + 7, duration: 2, type: 'open' });
        this.guitarPattern.push({ step: off + 14, note: root + 5, duration: 2, type: 'open' });
        
        // Drum beat: kick every 2, snare on 4 and 12
        for (let s = 0; s < 16; s += 2) this.drumPattern.set(off + s, 'kick');
        this.drumPattern.set(off + 4, 'snare');
        this.drumPattern.set(off + 12, 'snare');
        for (let s = 1; s < 16; s += 2) this.drumPattern.set(off + s, 'hat');
        
        // Crash cymbal at the beginning of each 4-bar block
        if (b % 4 === 0) {
          this.drumPattern.set(off, 'crash');
        }
      }
    };

    // 1. Section A: Intro / Crushing Groove (bars 0-7)
    addRiffA(0, 8);

    // 2. Section B: Sinister Phrygian Assault (bars 8-15)
    addRiffB(8, 8);

    // 3. Section C: Melodic Gothic Bridge (bars 16-23)
    // Slow crushing half-time groove with soaring lead melody
    const chords = [
      { bar: 16, note: 38, bass: 26 }, // D5 power chord
      { bar: 18, note: 34, bass: 22 }, // Bb5 power chord
      { bar: 20, note: 36, bass: 24 }, // C5 power chord
      { bar: 22, note: 32, bass: 20 }, // G#5 power chord
    ];
    for (const c of chords) {
      const off = c.bar * 16;
      
      // Massive slow power chords held for 2 bars (32 steps)
      this.guitarPattern.push({ step: off, note: c.note, duration: 32, type: 'open' });
      this.guitarPattern.push({ step: off, note: c.note + 7, duration: 32, type: 'open' });
      
      // Bass deep root drone
      this.bassPattern.push({ step: off, note: c.bass, duration: 32 });
      
      // Heavy palm-muted chugs ticking underneath the sustained chords
      for (let s = 0; s < 32; s += 4) {
        this.guitarPattern.push({ step: off + s, note: c.note, duration: 2, type: 'mute' });
      }
      
      // Half-time slow stomping drums
      for (let b = 0; b < 2; b++) {
        const boff = off + b * 16;
        this.drumPattern.set(boff, 'kick');
        this.drumPattern.set(boff + 8, 'kick');
        this.drumPattern.set(boff + 4, 'snare');
        this.drumPattern.set(boff + 12, 'snare');
        for (let s = 2; s < 16; s += 2) this.drumPattern.set(boff + s, 'hat');
      }
    }
    
    // Soaring high-pitched lead guitar melody over bridge
    // Scale: D phrygian (D4=62, Eb4=63, F4=65, G4=67, A4=69, Bb4=70, C5=72, D5=74)
    const melody: Array<[number, number, number]> = [
      [16, 62, 8],  // D4
      [16, 65, 8],  // F4
      [17, 69, 16], // A4
      [18, 67, 8],  // G4
      [18, 65, 8],  // F4
      [19, 63, 16], // Eb4
      [20, 65, 8],  // F4
      [20, 67, 8],  // G4
      [21, 70, 16], // Bb4
      [22, 69, 8],  // A4
      [22, 67, 8],  // G4
      [23, 65, 8],  // F4
      [23, 62, 8],  // D4
    ];
    for (const [bar, note, dur] of melody) {
      this.guitarPattern.push({ step: bar * 16, note, duration: dur, type: 'open' });
    }

    // 4. Section D: Climax & Outro (bars 24-31)
    // Transpose the Crushing Groove an octave higher for screaming intensity
    for (let b = 0; b < 6; b++) {
      const off = (24 + b) * 16;
      
      // Screaming guitar chugs an octave up (D3 = 50)
      const chugSteps = [0, 2, 3, 6, 8, 10, 11];
      for (const s of chugSteps) {
        this.guitarPattern.push({ step: off + s, note: 50, duration: 1, type: 'mute' });
        this.bassPattern.push({ step: off + s, note: 26, duration: 1 }); // bass stays low!
      }
      this.guitarPattern.push({ step: off + 14, note: 50, duration: 2, type: 'open' });
      this.guitarPattern.push({ step: off + 14, note: 57, duration: 2, type: 'open' }); // A3 fifth
      this.bassPattern.push({ step: off + 14, note: 26, duration: 2 });
      
      // Intense driving kick and snare
      for (let s = 0; s < 16; s += 2) this.drumPattern.set(off + s, 'kick');
      this.drumPattern.set(off + 4, 'snare');
      this.drumPattern.set(off + 12, 'snare');
      for (let s = 1; s < 16; s += 2) this.drumPattern.set(off + s, 'hat');
      this.drumPattern.set(off, 'crash');
    }
    
    // Outro (bars 30-31): heavy chromatic descending power chords
    const end = 30 * 16;
    
    // F5 power chord (41 + 48)
    this.guitarPattern.push({ step: end, note: 41, duration: 4, type: 'open' });
    this.guitarPattern.push({ step: end, note: 48, duration: 4, type: 'open' });
    this.bassPattern.push({ step: end, note: 29, duration: 4 });
    this.drumPattern.set(end, 'kick');
    this.drumPattern.set(end, 'crash');
    this.drumPattern.set(end + 2, 'snare');
    
    // E5 power chord (40 + 47)
    this.guitarPattern.push({ step: end + 4, note: 40, duration: 4, type: 'open' });
    this.guitarPattern.push({ step: end + 4, note: 47, duration: 4, type: 'open' });
    this.bassPattern.push({ step: end + 4, note: 28, duration: 4 });
    this.drumPattern.set(end + 4, 'kick');
    this.drumPattern.set(end + 4, 'crash');
    this.drumPattern.set(end + 6, 'snare');
    
    // Eb5 power chord (39 + 46)
    this.guitarPattern.push({ step: end + 8, note: 39, duration: 4, type: 'open' });
    this.guitarPattern.push({ step: end + 8, note: 46, duration: 4, type: 'open' });
    this.bassPattern.push({ step: end + 8, note: 27, duration: 4 });
    this.drumPattern.set(end + 8, 'kick');
    this.drumPattern.set(end + 8, 'crash');
    this.drumPattern.set(end + 10, 'snare');
    
    // Eb5 quick repeat / final slide setup
    this.guitarPattern.push({ step: end + 12, note: 39, duration: 4, type: 'open' });
    this.guitarPattern.push({ step: end + 12, note: 46, duration: 4, type: 'open' });
    this.bassPattern.push({ step: end + 12, note: 27, duration: 4 });
    this.drumPattern.set(end + 12, 'kick');
    this.drumPattern.set(end + 14, 'snare');
    
    // Bar 31 final chord: D5 (38 + 45) sustained out
    const finalStep = end + 16;
    this.guitarPattern.push({ step: finalStep, note: 38, duration: 16, type: 'open' });
    this.guitarPattern.push({ step: finalStep, note: 45, duration: 16, type: 'open' });
    this.bassPattern.push({ step: finalStep, note: 26, duration: 16 });
    
    this.drumPattern.set(finalStep, 'kick');
    this.drumPattern.set(finalStep, 'crash');
    this.drumPattern.set(finalStep + 8, 'snare');
  }

  private generateEerie(): void {
    // Creepy exploration — clean arpeggiated chords, ambient bass, minimal percussion
    // D minor: D E F G A Bb C
    const chords: Array<[number, number[]]> = [
      [0, [50, 53, 57]],    // Dm
      [64, [48, 52, 55]],   // C
      [128, [46, 50, 53]],  // Bb
      [192, [45, 48, 53]],  // Am
      [256, [50, 53, 57]],  // Dm
      [320, [53, 57, 60]],  // F
      [384, [48, 52, 55]],  // C
      [448, [50, 53, 57]],  // Dm
    ];

    for (const [startStep, notes] of chords) {
      // Arpeggiate each chord
      for (let rep = 0; rep < 4; rep++) {
        const off = startStep + rep * 16;
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (note === undefined) continue;
          this.guitarPattern.push({ step: off + i * 4, note, duration: 6, type: 'clean' });
        }
        // High melody note
        const lastNote = notes.at(-1);
        if (lastNote !== undefined) {
          this.guitarPattern.push({ step: off + 12, note: lastNote + 12, duration: 4, type: 'clean' });
        }
      }
      // Bass drone
      const bassRoot = notes[0];
      if (bassRoot !== undefined) {
        this.bassPattern.push({ step: startStep, note: bassRoot - 24, duration: 64 });
      }

      // Very sparse percussion
      this.drumPattern.set(startStep, 'kick');
      if (startStep % 128 === 0) this.drumPattern.set(startStep + 32, 'snare');
    }

    // Ambient high notes
    const eerieHits: Array<[number, number]> = [
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
      this.guitarPattern.push({ step, note, duration: 8, type: 'clean' });
    }
  }

  private generateDoom(): void {
    // Heavy epic power chord march — E major, big chords, marching snare
    // E major: E F# G# A B C# D#
    const powerChords: Array<[number, number, number]> = [
      // [bar, root, duration_bars]
      [0, 40, 2],   // E
      [2, 45, 2],   // A
      [4, 43, 2],   // G#
      [6, 40, 2],   // E
      [8, 42, 2],   // F#
      [10, 47, 2],  // B
      [12, 45, 2],  // A
      [14, 43, 2],  // G#
      // Bridge: minor shift
      [16, 36, 2],  // C
      [18, 40, 2],  // E
      [20, 43, 2],  // G#
      [22, 47, 2],  // B
      [24, 45, 2],  // A
      [26, 43, 2],  // G#
      [28, 42, 2],  // F#
      [30, 40, 2],  // E final
    ];

    for (const [bar, root, durBars] of powerChords) {
      const off = bar * 16;
      const durSteps = durBars * 16;
      // Power chord: root + fifth
      this.guitarPattern.push({ step: off, note: root, duration: durSteps, type: 'open' });
      this.guitarPattern.push({ step: off, note: root + 7, duration: durSteps, type: 'open' });
      // Rhythm chugs under the chord
      for (let s = 0; s < durSteps; s += 4) {
        this.guitarPattern.push({ step: off + s, note: root, duration: 2, type: 'mute' });
      }
      // Bass
      this.bassPattern.push({ step: off, note: root - 12, duration: 8 });
      this.bassPattern.push({ step: off + 8, note: root - 12, duration: 8 });
      if (durSteps > 16) {
        this.bassPattern.push({ step: off + 16, note: root - 12, duration: 8 });
        this.bassPattern.push({ step: off + 24, note: root - 12, duration: 8 });
      }
      // Marching drums
      this.drumPattern.set(off, 'kick');
      this.drumPattern.set(off + 4, 'snare');
      this.drumPattern.set(off + 8, 'kick');
      this.drumPattern.set(off + 12, 'snare');
      if (durSteps > 16) {
        this.drumPattern.set(off + 16, 'kick');
        this.drumPattern.set(off + 20, 'snare');
        this.drumPattern.set(off + 24, 'kick');
        this.drumPattern.set(off + 28, 'snare');
      }
    }

    // Triumphant melody over the last section
    const melody: Array<[number, number, number]> = [
      [24 * 16, 64, 8],  // E4
      [24 * 16 + 8, 68, 8], // A4
      [25 * 16, 71, 16],    // B4
      [26 * 16, 69, 8],    // A4
      [26 * 16 + 8, 68, 8], // G#4
      [27 * 16, 66, 16],   // F#4
      [28 * 16, 64, 8],    // E4
      [28 * 16 + 8, 63, 8], // D#4
      [29 * 16, 64, 16],   // E4
      [30 * 16, 68, 8],    // A4
      [30 * 16 + 8, 71, 8], // B4
      [31 * 16, 76, 16],   // E5
    ];
    for (const [step, note, dur] of melody) {
      this.guitarPattern.push({ step, note, duration: dur, type: 'open' });
    }
    // Final crash
    this.drumPattern.set(30 * 16, 'crash');
  }

  // ===================== AUDIO PLAYBACK =====================

  private buildStepIndex(): void {
    this.guitarByStep.clear();
    this.bassByStep.clear();
    for (const n of this.guitarPattern) {
      const list = this.guitarByStep.get(n.step);
      if (list) list.push(n);
      else this.guitarByStep.set(n.step, [n]);
    }
    for (const n of this.bassPattern) {
      const list = this.bassByStep.get(n.step);
      if (list) list.push(n);
      else this.bassByStep.set(n.step, [n]);
    }
  }

  private generateTrack(style: TrackStyle): void {
    this.guitarPattern = [];
    this.bassPattern = [];
    this.drumPattern = new Map();
    this.bpm = TRACK_CONFIG[style].bpm;

    switch (style) {
      case 'inferno': this.generateInferno(); break;
      case 'darkness': this.generateDarkness(); break;
      case 'rampage': this.generateRampage(); break;
      case 'eerie': this.generateEerie(); break;
      case 'doom': this.generateDoom(); break;
      case 'classic': this.generateInferno(); break;  // Classic = Inferno pattern (same as original menu)
    }
    this.buildStepIndex();
  }

  start(audioContext: AudioContext, destination: AudioNode, track?: TrackStyle): void {
    if (this.isPlaying) this.stop();
    this.currentTrack = track ?? 'inferno';

    this.audioContext = audioContext;
    this.generateTrack(this.currentTrack);

    // Create fade gain for smooth transitions
    this.fadeGain = audioContext.createGain();
    this.fadeGain.gain.setValueAtTime(0, audioContext.currentTime);
    this.fadeGain.gain.linearRampToValueAtTime(0.7, audioContext.currentTime + 0.5);
    this.fadeGain.connect(destination);
    this.destination = this.fadeGain;

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = audioContext.currentTime + 0.1;
    this.scheduler();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.fadeGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.fadeGain.gain.linearRampToValueAtTime(0, now + 0.3);
    }
  }

  switchTrack(style: TrackStyle): void {
    if (style === this.currentTrack) return;
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stop();
    this.currentTrack = style;
    if (wasPlaying && this.audioContext && this.fadeGain) {
      this.start(this.audioContext, this.fadeGain.context.createGain());
      // Reconnect properly
      this.stop();
      if (!this.audioContext) return;
      this.generateTrack(style);
      this.fadeGain = this.audioContext.createGain();
      this.fadeGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.fadeGain.gain.linearRampToValueAtTime(0.7, this.audioContext.currentTime + 1.0);
      const dest = this.destination;
      if (!dest) return;
      this.fadeGain.connect(dest);
      this.destination = this.fadeGain;
      this.isPlaying = true;
      this.currentStep = 0;
      this.nextNoteTime = this.audioContext.currentTime + 0.1;
      this.scheduler();
    }
  }

  setVolume(vol: number): void {
    if (this.fadeGain && this.audioContext) {
      this.fadeGain.gain.setValueAtTime(vol * 0.7, this.audioContext.currentTime);
    }
  }

  getCurrentTrack(): TrackStyle | null {
    return this.currentTrack;
  }

  private scheduler(): void {
    if (!this.isPlaying || !this.audioContext) return;
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      const secondsPerStep = 60.0 / this.bpm / 4;
      this.nextNoteTime += secondsPerStep;
      this.currentStep = (this.currentStep + 1) % this.totalSteps;
    }
    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  private scheduleNote(step: number, time: number): void {
    // Drums
    const drum = this.drumPattern.get(step);
    if (drum) {
      switch (drum) {
        case 'kick': this.playKick(time); break;
        case 'snare': this.playSnare(time); break;
        case 'hat': this.playHiHat(time); break;
        case 'crash': this.playCrash(time); break;
      }
    }

    const stepDur = 60 / this.bpm / 4;
    const guitarNotes = this.guitarByStep.get(step);
    if (guitarNotes) {
      for (const note of guitarNotes) {
        this.playGuitarNote(note.note, time, note.duration * stepDur, note.type);
      }
    }

    const bassNotes = this.bassByStep.get(step);
    if (bassNotes) {
      for (const note of bassNotes) {
        this.playBassNote(note.note, time, note.duration * stepDur);
      }
    }
  }

  private playGuitarNote(midiNote: number, time: number, duration: number, type: 'mute' | 'open' | 'clean'): void {
    if (!this.audioContext || !this.destination) return;

    const freq = this.midiToFreq(midiNote);
    const osc = this.audioContext.createOscillator();
    const filter = this.audioContext.createBiquadFilter();
    const envelope = this.audioContext.createGain();

    // Single oscillator with detune for stereo width (lighter than dual)
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime(8, time); // Slight detune for richness

    if (type === 'clean') {
      // Clean tone: no distortion, gentle filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, time);
      filter.Q.setValueAtTime(0.5, time);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(0.15, time + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.06, time + duration * 0.5);
      envelope.gain.setValueAtTime(0.06, time + duration - 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(envelope);
    } else {
      // Distorted tone: use WaveShaper for crunch
      const distNode = this.audioContext.createWaveShaper();
      distNode.curve = this.distortionCurve;
      distNode.oversample = '2x'; // 2x instead of 4x for better performance

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);
      filter.Q.setValueAtTime(1.5, time);

      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(0.2, time + 0.003);

      if (type === 'mute') {
        envelope.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
        envelope.gain.setValueAtTime(0.01, time + duration - 0.01);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      } else {
        envelope.gain.exponentialRampToValueAtTime(0.15, time + 0.25);
        envelope.gain.setValueAtTime(0.15, time + duration - 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      }

      osc.connect(distNode);
      distNode.connect(filter);
      filter.connect(envelope);
    }

    envelope.connect(this.destination);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private playBassNote(midiNote: number, time: number, duration: number): void {
    if (!this.audioContext || !this.destination) return;

    const freq = this.midiToFreq(midiNote);
    const subOsc = this.audioContext.createOscillator();
    const gritOsc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq, time);

    gritOsc.type = 'sawtooth';
    gritOsc.frequency.setValueAtTime(freq, time);
    gritOsc.detune.setValueAtTime(3, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, time);
    filter.Q.setValueAtTime(2, time);

    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(0.25, time + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.2, time + 0.1);
    envelope.gain.setValueAtTime(0.2, time + duration - 0.05);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    subOsc.connect(filter);
    gritOsc.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.destination);

    subOsc.start(time);
    gritOsc.start(time);
    subOsc.stop(time + duration);
    gritOsc.stop(time + duration);
  }

  private playKick(time: number): void {
    if (!this.audioContext || !this.destination) return;

    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);

    envelope.gain.setValueAtTime(0.8, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

    osc.connect(envelope);
    envelope.connect(this.destination);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private playSnare(time: number): void {
    if (!this.audioContext || !this.destination) return;

    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.makeNoiseBuffer();
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, time);
    noiseFilter.Q.setValueAtTime(0.7, time);
    const noiseEnvelope = this.audioContext.createGain();
    noiseEnvelope.gain.setValueAtTime(0.35, time);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(this.destination);
    noise.start(time);
    noise.stop(time + 0.15);

    // Body
    const osc = this.audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    const oscEnv = this.audioContext.createGain();
    oscEnv.gain.setValueAtTime(0.25, time);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    osc.connect(oscEnv);
    oscEnv.connect(this.destination);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  private playHiHat(time: number): void {
    if (!this.audioContext || !this.destination) return;

    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.makeNoiseBuffer();
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);
    const envelope = this.audioContext.createGain();
    envelope.gain.setValueAtTime(0.12, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.destination);
    noise.start(time);
    noise.stop(time + 0.04);
  }

  private playCrash(time: number): void {
    if (!this.audioContext || !this.destination) return;

    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.makeNoiseBuffer();
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4000, time);
    const envelope = this.audioContext.createGain();
    envelope.gain.setValueAtTime(0.4, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);

    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.destination);
    noise.start(time);
    noise.stop(time + 0.8);
  }
}