// Generate longer E1M1-inspired MIDI (~2 minutes)
// "At Doom's Gate" inspired — dark, heavy, driving
const MidiWriter = require('midi-writer-js');

// Track 1: Distortion Guitar — main riff
const guitar = new MidiWriter.Track();
guitar.setTempo(130);
guitar.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 30}));

// E1M1 main riff — extended to ~2 min with variations
// Using note numbers: E2=40, F#2=42, G2=43, A2=45, B2=47, C3=48, D3=50
// E3=52, F#3=54, G3=55, A3=57, B3=59, C4=60, D4=62, E4=64

const E2=40,Fs2=42,G2=43,A2=45,B2=47,C3=48,D3=50;
const E3=52,Fs3=54,G3=55,A3=57,B3=59,C4=60,D4=62,E4=64;
const G4=67,A4=69,B4=71;

// Repeating patterns — play 4 times for ~2 min at 130 BPM
const mainRiff = [
  // Pattern A (2 bars)
  [E2,'2'],[E2,'4'],[G2,'8'],[E2,'8'],[E2,'4'],
  [E2,'4'],[G2,'8'],[Fs2,'8'],[E2,'2'],
  // Pattern B (2 bars)
  [E2,'4'],[E2,'8'],[G2,'8'],[B2,'4'],[A2,'4'],
  [G2,'8'],[Fs2,'8'],[E2,'2'],
  // Pattern C (2 bars)
  [E2,'4'],[B2,'4'],[A2,'4'],[G2,'4'],
  [Fs2,'4'],[E2,'4'],[E2,'2'],
  // Pattern D (2 bars)
  [G2,'4'],[A2,'4'],[B2,'4'],[A2,'4'],
  [G2,'4'],[Fs2,'8'],[E2,'8'],[E2,'2'],
  // Variation E (2 bars)
  [E2,'4'],[G2,'4'],[A2,'8'],[B2,'8'],[A2,'4'],
  [G2,'4'],[Fs2,'4'],[E2,'2'],
  // Variation F (2 bars)
  [B2,'4'],[A2,'4'],[G2,'8'],[Fs2,'8'],[E2,'4'],
  [G2,'8'],[Fs2,'8'],[E2,'2'],
];

// Play main riff 3 times = 24 bars ≈ 44 seconds, then add more variation
for (let rep = 0; rep < 3; rep++) {
  for (const note of mainRiff) {
    guitar.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 100}));
  }
}

// Extended section — higher register riff (4 bars)
const highRiff = [
  [E3,'4'],[E3,'8'],[G3,'8'],[B3,'4'],[A3,'4'],
  [G3,'8'],[Fs3,'8'],[E3,'2'],
  [E3,'4'],[B3,'4'],[A3,'4'],[G3,'4'],
  [Fs3,'4'],[E3,'4'],[E3,'2'],
];
for (const note of highRiff) {
  guitar.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 105}));
}
for (const note of highRiff) {
  guitar.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 108}));
}

// Play main riff 2 more times
for (let rep = 0; rep < 2; rep++) {
  for (const note of mainRiff) {
    guitar.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 100}));
  }
}

// Track 2: Bass
const bass = new MidiWriter.Track();
bass.setTempo(130);
bass.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 34}));

const bassLine = [
  [E2,'2'],[E2,'4'],[E2,'8'],[G2,'8'],
  [E2,'2'],[E2,'4'],[G2,'8'],[Fs2,'8'],
  [E2,'4'],[B2,'4'],[A2,'4'],[G2,'4'],
  [Fs2,'4'],[E2,'4'],[E2,'2'],
  [E2,'4'],[B2,'4'],[A2,'4'],[G2,'4'],
  [Fs2,'4'],[E2,'4'],[E2,'2'],
  [E2,'4'],[G2,'4'],[A2,'8'],[B2,'8'],[A2,'4'],
  [G2,'4'],[Fs2,'4'],[E2,'2'],
  [B2,'4'],[A2,'4'],[G2,'8'],[Fs2,'8'],[E2,'4'],
  [G2,'8'],[Fs2,'8'],[E2,'2'],
];

// Play bass for all 8 repetitions of the main section
for (let rep = 0; rep < 8; rep++) {
  for (const note of bassLine) {
    bass.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 80}));
  }
}

// Track 3: Drums
const drums = new MidiWriter.Track();
drums.setTempo(130);
drums.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 0, channel: 9}));

const totalBars = 56; // ~2 min at 130 BPM
for (let bar = 0; bar < totalBars; bar++) {
  // Kick on 1 and 3
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 36, duration: '4', channel: 9, velocity: 100}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 42, duration: '8', channel: 9, velocity: 60}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 42, duration: '8', channel: 9, velocity: 40}));
  // Snare on 2 and 4
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 38, duration: '4', channel: 9, velocity: 100}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 36, duration: '8', channel: 9, velocity: 90}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 42, duration: '8', channel: 9, velocity: 60}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 38, duration: '4', channel: 9, velocity: 100}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 42, duration: '8', channel: 9, velocity: 50}));
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 42, duration: '8', channel: 9, velocity: 40}));
}

const write = new MidiWriter.Writer([guitar, bass, drums]);
const fs = require('fs');
fs.writeFileSync('public/audio/e1m1.mid', write.buildFile());
console.log('Generated E1M1 MIDI:', write.buildFile().length, 'bytes');
console.log('Approx duration: ~2 min at 130 BPM');