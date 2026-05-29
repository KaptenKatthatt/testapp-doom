// MenuSynth.ts — A pure Web Audio API synthesizer that generates a retro Doom-style metal track.
// Synthesizes double-tracked distorted guitar, deep sub-bass, kick, snare, and hi-hats.

interface SynthNote {
  step: number;
  note: number;
  duration: number;
  type: 'mute' | 'open';
}

interface BassNote {
  step: number;
  note: number;
  duration: number;
}

export class MenuSynth {
  private audioContext: AudioContext | null = null;
  private destination: AudioNode | null = null;
  private isPlaying = false;
  private nextNoteTime = 0.0;
  private currentStep = 0;
  private bpm = 125;
  private timerId: any = null;

  private lookahead = 25.0; // ms between polls
  private scheduleAheadTime = 0.1; // schedule 100ms in advance
  
  private distortionCurve: Float32Array;
  private noiseBuffer: AudioBuffer | null = null;

  // Patterns generated dynamically on construction (512 steps = ~61 seconds at 125 BPM)
  private guitarPattern: SynthNote[] = [];
  private bassPattern: BassNote[] = [];

  constructor() {
    this.distortionCurve = this.makeDistortionCurve(75);
    this.generateSong();
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 18 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.audioContext) throw new Error("AudioContext not set");
    const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds of noise
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Generates a fully fleshed out metal track of 32 bars (~61.4s)
  private generateSong() {
    const E_RIFF = [
      { step: 0, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 1, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 2, note: 52, duration: 2, type: 'open' as const },  // E3
      { step: 4, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 5, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 6, note: 50, duration: 2, type: 'open' as const },  // D3
      { step: 8, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 9, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 10, note: 48, duration: 2, type: 'open' as const }, // C3
      { step: 12, note: 40, duration: 1, type: 'mute' as const }, // E2
      { step: 13, note: 40, duration: 1, type: 'mute' as const }, // E2
      { step: 14, note: 46, duration: 2, type: 'open' as const }, // A#2
    ];

    const E_RIFF_BAR2 = [
      { step: 0, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 1, note: 40, duration: 1, type: 'mute' as const },  // E2
      { step: 2, note: 47, duration: 2, type: 'open' as const },  // B2
      { step: 4, note: 43, duration: 2, type: 'open' as const },  // G2
      { step: 6, note: 42, duration: 2, type: 'open' as const },  // Fs2
      { step: 8, note: 40, duration: 4, type: 'open' as const },  // E2
      { step: 12, note: 40, duration: 4, type: 'open' as const }, // E2
    ];

    const addRiffSegment = (barStart: number, transpose: number) => {
      const stepOffset = barStart * 16;
      
      // Bar 1 of Riff
      for (const note of E_RIFF) {
        this.guitarPattern.push({
          step: stepOffset + note.step,
          note: note.note + transpose,
          duration: note.duration,
          type: note.type
        });
        this.bassPattern.push({
          step: stepOffset + note.step,
          note: (note.note === 40 ? 28 : note.note - 12) + transpose,
          duration: note.duration
        });
      }

      // Bar 2 of Riff
      for (const note of E_RIFF_BAR2) {
        this.guitarPattern.push({
          step: stepOffset + 16 + note.step,
          note: note.note + transpose,
          duration: note.duration,
          type: note.type
        });
        this.bassPattern.push({
          step: stepOffset + 16 + note.step,
          note: (note.note === 40 ? 28 : note.note - 12) + transpose,
          duration: note.duration
        });
      }
    };

    // --- Section 1: Intro / Driving Riff (E minor) ---
    // Bars 0 - 7 (Steps 0 - 127)
    addRiffSegment(0, 0);
    addRiffSegment(2, 0);
    addRiffSegment(4, 0);
    addRiffSegment(6, 0);

    // --- Section 2: Transposed Riff (A minor - IV chord) ---
    // Bars 8 - 11 (Steps 128 - 191)
    addRiffSegment(8, 5); // Transposed up 5 semitones
    addRiffSegment(10, 5);

    // --- Section 3: Return to E minor Riff ---
    // Bars 12 - 15 (Steps 192 - 255)
    addRiffSegment(12, 0);
    addRiffSegment(14, 0);

    // --- Section 4: Epic Melody / Bridge Section ---
    // Bars 16 - 23 (Steps 256 - 383)
    // Rhythm backing plays heavy power chords: E5, C5, D5, B5 (2 bars each)
    const chords = [
      { bar: 16, note: 40, bass: 28 }, // E5
      { bar: 18, note: 36, bass: 24 }, // C5
      { bar: 20, note: 38, bass: 26 }, // D5
      { bar: 22, note: 35, bass: 23 }, // B5
    ];

    for (const chord of chords) {
      const offset = chord.bar * 16;
      for (let step = 0; step < 32; step += 2) {
        // Rhythm guitar chug
        this.guitarPattern.push({ step: offset + step, note: chord.note, duration: 2, type: 'mute' });
        this.guitarPattern.push({ step: offset + step, note: chord.note + 7, duration: 2, type: 'open' }); // Fifth of the power chord
        
        // Heavy bass root notes
        if (step % 4 === 0) {
          this.bassPattern.push({ step: offset + step, note: chord.bass, duration: 4 });
        }
      }
    }

    // High soaring lead melody
    // Bar 16-17
    this.guitarPattern.push({ step: 16 * 16, note: 59, duration: 8, type: 'open' }); // B3
    this.guitarPattern.push({ step: 16 * 16 + 8, note: 62, duration: 8, type: 'open' }); // D4
    this.guitarPattern.push({ step: 17 * 16, note: 64, duration: 16, type: 'open' }); // E4

    // Bar 18-19
    this.guitarPattern.push({ step: 18 * 16, note: 67, duration: 8, type: 'open' }); // G4
    this.guitarPattern.push({ step: 18 * 16 + 8, note: 66, duration: 8, type: 'open' }); // F#4
    this.guitarPattern.push({ step: 19 * 16, note: 64, duration: 8, type: 'open' }); // E4
    this.guitarPattern.push({ step: 19 * 16 + 8, note: 62, duration: 8, type: 'open' }); // D4

    // Bar 20-21
    this.guitarPattern.push({ step: 20 * 16, note: 57, duration: 8, type: 'open' }); // A3
    this.guitarPattern.push({ step: 20 * 16 + 8, note: 60, duration: 8, type: 'open' }); // C4
    this.guitarPattern.push({ step: 21 * 16, note: 62, duration: 16, type: 'open' }); // D4

    // Bar 22-23
    this.guitarPattern.push({ step: 22 * 16, note: 66, duration: 8, type: 'open' }); // F#4
    this.guitarPattern.push({ step: 22 * 16 + 8, note: 64, duration: 8, type: 'open' }); // E4
    this.guitarPattern.push({ step: 23 * 16, note: 62, duration: 8, type: 'open' }); // D4
    this.guitarPattern.push({ step: 23 * 16 + 8, note: 59, duration: 8, type: 'open' }); // B3

    // --- Section 5: High Register Climax / Guitar Solo ---
    // Bars 24 - 31 (Steps 384 - 511)
    // Plays the main E minor riff one octave higher for an explosive finale!
    addRiffSegment(24, 12);
    addRiffSegment(26, 12);
    addRiffSegment(28, 12);

    // Final ending chugs (Bars 30 - 31)
    const endOffset = 30 * 16;
    for (let step = 0; step < 24; step += 2) {
      this.guitarPattern.push({ step: endOffset + step, note: 40, duration: 2, type: 'mute' });
      this.bassPattern.push({ step: endOffset + step, note: 28, duration: 2 });
    }
    // Final heavy slide out chord
    this.guitarPattern.push({ step: endOffset + 24, note: 45, duration: 2, type: 'open' }); // A2
    this.guitarPattern.push({ step: endOffset + 26, note: 46, duration: 2, type: 'open' }); // A#2
    this.guitarPattern.push({ step: endOffset + 28, note: 47, duration: 4, type: 'open' }); // B2

    this.bassPattern.push({ step: endOffset + 24, note: 33, duration: 2 });
    this.bassPattern.push({ step: endOffset + 26, note: 34, duration: 2 });
    this.bassPattern.push({ step: endOffset + 28, note: 35, duration: 4 });
  }

  private playGuitarNote(midiNote: number, time: number, duration: number, type: 'mute' | 'open') {
    if (!this.audioContext || !this.destination) return;

    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const distNode = this.audioContext.createWaveShaper();
    const cabinetFilter = this.audioContext.createBiquadFilter();
    const envelope = this.audioContext.createGain();

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Detuned sawtooths for massive stereophonic distortion tone
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(6, time);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(-6, time);

    // Apply amp distortion
    distNode.curve = this.distortionCurve as any;
    distNode.oversample = '4x';

    // High cut to eliminate harsh buzz, simulating a real guitar speaker cab
    cabinetFilter.type = 'lowpass';
    cabinetFilter.frequency.setValueAtTime(1400, time);
    cabinetFilter.Q.setValueAtTime(2.0, time);

    // Amplitude envelope
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(0.24, time + 0.003); // super snappy attack

    if (type === 'mute') {
      // Palm muted chunk
      envelope.gain.exponentialRampToValueAtTime(0.015, time + 0.1);
      envelope.gain.setValueAtTime(0.015, time + duration - 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    } else {
      // Open ringout
      envelope.gain.exponentialRampToValueAtTime(0.18, time + 0.25);
      envelope.gain.setValueAtTime(0.18, time + duration - 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    }

    // Node routing
    osc1.connect(distNode);
    osc2.connect(distNode);
    distNode.connect(cabinetFilter);
    cabinetFilter.connect(envelope);
    envelope.connect(this.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  private playBassNote(midiNote: number, time: number, duration: number) {
    if (!this.audioContext || !this.destination) return;

    const subOsc = this.audioContext.createOscillator();
    const gritOsc = this.audioContext.createOscillator();
    const filter = this.audioContext.createBiquadFilter();
    const envelope = this.audioContext.createGain();
    const gritGain = this.audioContext.createGain();

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Deep fundamental tone
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(freq, time);

    // Aggressive raspy bite
    gritOsc.type = 'sawtooth';
    gritOsc.frequency.setValueAtTime(freq, time);
    gritGain.gain.setValueAtTime(0.12, time);

    // Bass lowpass (removes mids/highs, leaving heavy rumble)
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, time);

    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(0.35, time + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.22, time + 0.2);
    envelope.gain.setValueAtTime(0.22, time + duration - 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    subOsc.connect(filter);
    gritOsc.connect(gritGain);
    gritGain.connect(filter);
    
    filter.connect(envelope);
    envelope.connect(this.destination);

    subOsc.start(time);
    gritOsc.start(time);
    subOsc.stop(time + duration);
    gritOsc.stop(time + duration);
  }

  private playKick(time: number) {
    if (!this.audioContext || !this.destination) return;

    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    osc.type = 'sine';
    // Deep heavy kick sweep
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.07);

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.85, time + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(gainNode);
    gainNode.connect(this.destination);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  private playSnare(time: number) {
    if (!this.audioContext || !this.destination || !this.noiseBuffer) return;

    // Snappy noise component
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, time);
    filter.Q.setValueAtTime(1.4, time);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(0.42, time + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.destination);

    // Punchy body component (swept triangle wave)
    const bodyOsc = this.audioContext.createOscillator();
    const bodyGain = this.audioContext.createGain();

    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(175, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(110, time + 0.07);

    bodyGain.gain.setValueAtTime(0, time);
    bodyGain.gain.linearRampToValueAtTime(0.35, time + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.destination);

    noiseSource.start(time);
    noiseSource.stop(time + 0.15);
    bodyOsc.start(time);
    bodyOsc.stop(time + 0.09);
  }

  private playHihat(time: number, isOpen = false) {
    if (!this.audioContext || !this.destination || !this.noiseBuffer) return;

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8500, time);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.09, time + 0.002);
    
    const duration = isOpen ? 0.2 : 0.04;
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.destination);

    noiseSource.start(time);
    noiseSource.stop(time + duration + 0.01);
  }

  private playCrash(time: number) {
    if (!this.audioContext || !this.destination || !this.noiseBuffer) return;

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.24, time + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 1.4); // nice ringout

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.destination);

    noiseSource.start(time);
    noiseSource.stop(time + 1.5);
  }

  private scheduleDrums(step: number, time: number) {
    const isIntro = step < 128;
    const isTransposed = step >= 128 && step < 192;
    const isRiff2 = step >= 192 && step < 256;
    const isMelody = step >= 256 && step < 384;
    const isClimax = step >= 384 && step < 512;

    const subStep = step % 16;
    const bar = Math.floor(step / 16);

    // 1. Crash Cymbal on section changes and bar starts
    if (subStep === 0) {
      if (step === 0 || step === 128 || step === 192 || step === 256 || step === 384) {
        this.playCrash(time);
      } else if (isClimax && bar % 2 === 0) {
        // crash every 2 bars during climax
        this.playCrash(time);
      }
    }

    // 2. Drum Fill at the very end of the loop (steps 504 - 511)
    if (step >= 504 && step <= 511) {
      if (step < 508) {
        this.playSnare(time);
      } else {
        this.playKick(time);
        if (step % 2 === 0) this.playSnare(time);
      }
      return; // bypass normal drum patterns during the fill!
    }

    // 3. Normal Kick Patterns
    let kickSteps: number[] = [];
    if (isIntro || isTransposed) {
      kickSteps = [0, 2, 8, 10]; // standard driving double-bass
    } else if (isRiff2 || isClimax) {
      kickSteps = [0, 2, 6, 8, 10, 14]; // active double-kick
    } else if (isMelody) {
      kickSteps = [0, 4, 8, 12]; // steady four-on-the-floor metal march
    }

    if (kickSteps.includes(subStep)) {
      this.playKick(time);
    }

    // 4. Normal Snare Patterns (classic backbeat on 4 and 12)
    const snareSteps = [4, 12];
    if (snareSteps.includes(subStep)) {
      this.playSnare(time);
    }

    // 5. Hi-hat / Cymbals
    if (step % 2 === 0) {
      if (isMelody) {
        const isRideAccent = (subStep % 4 === 0);
        this.playHihat(time, isRideAccent);
      } else {
        const isOpen = (subStep === 6 || subStep === 14); // open hat before backbeat
        this.playHihat(time, isOpen);
      }
    }
  }

  private scheduleNextStep(step: number, time: number) {
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = secondsPerBeat / 4; // sixteenth notes

    // Schedule drums dynamically
    this.scheduleDrums(step, time);

    // Schedule guitar notes (supports polyphony/chords!)
    const guitarNotes = this.guitarPattern.filter(g => g.step === step);
    for (const g of guitarNotes) {
      const dur = g.duration * stepDuration;
      this.playGuitarNote(g.note, time, dur, g.type);
    }

    // Schedule bass notes
    const bassNotes = this.bassPattern.filter(b => b.step === step);
    for (const b of bassNotes) {
      const dur = b.duration * stepDuration;
      this.playBassNote(b.note, time, dur);
    }
  }

  private scheduler() {
    if (!this.audioContext || !this.isPlaying) return;

    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNextStep(this.currentStep, this.nextNoteTime);
      this.advanceStep();
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  private advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = secondsPerBeat / 4;
    this.nextNoteTime += stepDuration;

    this.currentStep = (this.currentStep + 1) % 512; // loop 512 steps
  }

  start(audioContext: AudioContext, destination: AudioNode) {
    if (this.isPlaying) return;

    this.audioContext = audioContext;
    this.destination = destination;
    this.isPlaying = true;

    if (!this.noiseBuffer) {
      this.noiseBuffer = this.createNoiseBuffer();
    }

    this.currentStep = 0;
    this.nextNoteTime = this.audioContext.currentTime + 0.05;
    
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
