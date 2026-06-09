import type { RampageBassNote, RampageDrumHit, RampageGuitarNote, RampagePattern } from "./rampagePattern";

export function buildRampagePattern(): RampagePattern {
  const guitarPattern: RampageGuitarNote[] = [];
  const bassPattern: RampageBassNote[] = [];
  const drumPattern = new Map<number, RampageDrumHit>();

  const addRiffA = (startBar: number, bars: number): void => {
    for (let b = 0; b < bars; b++) {
      const off = (startBar + b) * 16;
      const chugSteps = [0, 2, 3, 6, 8, 10, 11];
      for (const s of chugSteps) {
        guitarPattern.push({ step: off + s, note: 38, duration: 1, type: "mute" });
        bassPattern.push({ step: off + s, note: 26, duration: 1 });
      }
      guitarPattern.push({ step: off + 14, note: 38, duration: 2, type: "open" });
      guitarPattern.push({ step: off + 14, note: 45, duration: 2, type: "open" });
      bassPattern.push({ step: off + 14, note: 26, duration: 2 });
      const kickSteps = [0, 3, 6, 8, 11, 14];
      for (const k of kickSteps) drumPattern.set(off + k, "kick");
      drumPattern.set(off + 4, "snare");
      drumPattern.set(off + 12, "snare");
      for (let s = 0; s < 16; s += 2) {
        if (!drumPattern.has(off + s)) {
          drumPattern.set(off + s, "hat");
        }
      }
    }
  };

  const addRiffB = (startBar: number, bars: number): void => {
    for (let b = 0; b < bars; b++) {
      const off = (startBar + b) * 16;
      let root = 38;
      if (b % 4 === 1) root = 39;
      else if (b % 4 === 2) root = 43;
      else if (b % 4 === 3) root = b % 8 === 7 ? 45 : 46;
      for (let s = 0; s < 16; s += 2) {
        guitarPattern.push({ step: off + s, note: root, duration: 1, type: "mute" });
        bassPattern.push({ step: off + s, note: root - 12, duration: 1 });
      }
      guitarPattern.push({ step: off + 6, note: root + 7, duration: 2, type: "open" });
      guitarPattern.push({ step: off + 14, note: root + 5, duration: 2, type: "open" });
      for (let s = 0; s < 16; s += 2) drumPattern.set(off + s, "kick");
      drumPattern.set(off + 4, "snare");
      drumPattern.set(off + 12, "snare");
      for (let s = 1; s < 16; s += 2) drumPattern.set(off + s, "hat");
      if (b % 4 === 0) {
        drumPattern.set(off, "crash");
      }
    }
  };

  addRiffA(0, 8);
  addRiffB(8, 8);

  const chords = [
    { bar: 16, note: 38, bass: 26 },
    { bar: 18, note: 34, bass: 22 },
    { bar: 20, note: 36, bass: 24 },
    { bar: 22, note: 32, bass: 20 },
  ];
  for (const c of chords) {
    const off = c.bar * 16;
    guitarPattern.push({ step: off, note: c.note, duration: 32, type: "open" });
    guitarPattern.push({ step: off, note: c.note + 7, duration: 32, type: "open" });
    bassPattern.push({ step: off, note: c.bass, duration: 32 });
    for (let s = 0; s < 32; s += 4) {
      guitarPattern.push({ step: off + s, note: c.note, duration: 2, type: "mute" });
    }
    for (let b = 0; b < 2; b++) {
      const boff = off + b * 16;
      drumPattern.set(boff, "kick");
      drumPattern.set(boff + 8, "kick");
      drumPattern.set(boff + 4, "snare");
      drumPattern.set(boff + 12, "snare");
      for (let s = 2; s < 16; s += 2) drumPattern.set(boff + s, "hat");
    }
  }

  const melody: Array<[number, number, number]> = [
    [16, 62, 8],
    [16, 65, 8],
    [17, 69, 16],
    [18, 67, 8],
    [18, 65, 8],
    [19, 63, 16],
    [20, 65, 8],
    [20, 67, 8],
    [21, 70, 16],
    [22, 69, 8],
    [22, 67, 8],
    [23, 65, 8],
    [23, 62, 8],
  ];
  for (const [bar, note, dur] of melody) {
    guitarPattern.push({ step: bar * 16, note, duration: dur, type: "open" });
  }

  for (let b = 0; b < 6; b++) {
    const off = (24 + b) * 16;
    const chugSteps = [0, 2, 3, 6, 8, 10, 11];
    for (const s of chugSteps) {
      guitarPattern.push({ step: off + s, note: 50, duration: 1, type: "mute" });
      bassPattern.push({ step: off + s, note: 26, duration: 1 });
    }
    guitarPattern.push({ step: off + 14, note: 50, duration: 2, type: "open" });
    guitarPattern.push({ step: off + 14, note: 57, duration: 2, type: "open" });
    bassPattern.push({ step: off + 14, note: 26, duration: 2 });
    for (let s = 0; s < 16; s += 2) drumPattern.set(off + s, "kick");
    drumPattern.set(off + 4, "snare");
    drumPattern.set(off + 12, "snare");
    for (let s = 1; s < 16; s += 2) drumPattern.set(off + s, "hat");
    drumPattern.set(off, "crash");
  }

  const end = 30 * 16;
  guitarPattern.push({ step: end, note: 41, duration: 4, type: "open" });
  guitarPattern.push({ step: end, note: 48, duration: 4, type: "open" });
  bassPattern.push({ step: end, note: 29, duration: 4 });
  drumPattern.set(end, "kick");
  drumPattern.set(end, "crash");
  drumPattern.set(end + 2, "snare");

  guitarPattern.push({ step: end + 4, note: 40, duration: 4, type: "open" });
  guitarPattern.push({ step: end + 4, note: 47, duration: 4, type: "open" });
  bassPattern.push({ step: end + 4, note: 28, duration: 4 });
  drumPattern.set(end + 4, "kick");
  drumPattern.set(end + 4, "crash");
  drumPattern.set(end + 6, "snare");

  guitarPattern.push({ step: end + 8, note: 39, duration: 4, type: "open" });
  guitarPattern.push({ step: end + 8, note: 46, duration: 4, type: "open" });
  bassPattern.push({ step: end + 8, note: 27, duration: 4 });
  drumPattern.set(end + 8, "kick");
  drumPattern.set(end + 8, "crash");
  drumPattern.set(end + 10, "snare");

  guitarPattern.push({ step: end + 12, note: 39, duration: 4, type: "open" });
  guitarPattern.push({ step: end + 12, note: 46, duration: 4, type: "open" });
  bassPattern.push({ step: end + 12, note: 27, duration: 4 });
  drumPattern.set(end + 12, "kick");
  drumPattern.set(end + 14, "snare");

  const finalStep = end + 16;
  guitarPattern.push({ step: finalStep, note: 38, duration: 16, type: "open" });
  guitarPattern.push({ step: finalStep, note: 45, duration: 16, type: "open" });
  bassPattern.push({ step: finalStep, note: 26, duration: 16 });
  drumPattern.set(finalStep, "kick");
  drumPattern.set(finalStep, "crash");
  drumPattern.set(finalStep + 8, "snare");

  return { guitarPattern, bassPattern, drumPattern };
}
