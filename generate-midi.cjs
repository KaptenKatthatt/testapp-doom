// Generate E1M1 "At Doom's Gate" inspired MIDI
// This is a simplified version of the iconic Doom E1M1 theme
const MidiWriter = require('midi-writer-js');

const track = new MidiWriter.Track();
track.setTempo(130);

// E1M1 main riff - the iconic opening
// Key of E minor, the classic doom riff pattern
const E2 = 40, Fs2 = 42, G2 = 43, A2 = 45, B2 = 47, C3 = 48, D3 = 50, E3 = 52, Fs3 = 54, G3 = 55, A3 = 57, B3 = 59;
const E4 = 64, Fs4 = 66, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76;

// Distortion Guitar (program 30) - main riff
const guitar1 = new MidiWriter.Track();
guitar1.setTempo(130);
guitar1.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 30}));

// The iconic E1M1 riff pattern (simplified but recognizable)
const riff = [
  // Bar 1-2: Classic E power chord riff
  [E2, E2, '2'], [E2, '4'], [G2, '8'], [E2, '8'], [E2, '4'],
  [E2, '4'], [G2, '8'], [Fs2, '8'], [E2, '2'],
  // Bar 3-4: Rising pattern  
  [E2, '4'], [E2, '8'], [G2, '8'], [B2, '4'], [A2, '4'],
  [G2, '8'], [Fs2, '8'], [E2, '2'],
  // Bar 5-6: Descending
  [E2, '4'], [B2, '4'], [A2, '4'], [G2, '4'],
  [Fs2, '4'], [E2, '4'], [E2, '2'],
  // Bar 7-8: Turnaround
  [G2, '4'], [A2, '4'], [B2, '4'], [A2, '4'],
  [G2, '4'], [Fs2, '8'], [E2, '8'], [E2, '2'],
];

// Add riff to guitar track
for (const note of riff) {
  if (note.length === 3) {
    guitar1.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[2], velocity: 100}));
  } else {
    guitar1.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 100}));
  }
}

// Bass track (program 34 - Electric Bass)
const bass = new MidiWriter.Track();
bass.setTempo(130);
bass.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 34}));

const bassLine = [
  [E2, '2'], [E2, '4'], [E2, '8'], [G2, '8'],
  [E2, '2'], [E2, '4'], [G2, '8'], [Fs2, '8'],
  [E2, '4'], [B2, '4'], [A2, '4'], [G2, '4'],
  [Fs2, '4'], [E2, '4'], [E2, '2'],
  [E2, '4'], [B2, '4'], [A2, '4'], [G2, '4'],
  [Fs2, '4'], [E2, '4'], [E2, '2'],
];

for (const note of bassLine) {
  bass.addEvent(new MidiWriter.NoteEvent({pitch: note[0], duration: note[1], velocity: 80}));
}

// Drums track (program 0 on channel 10)
const drums = new MidiWriter.Track();
drums.setTempo(130);

// Simple drum pattern - channel 10 (9 in 0-indexed)
drums.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 0, channel: 9}));

// 8 bars of drums
for (let bar = 0; bar < 8; bar++) {
  // Kick on 1 and 3, snare on 2 and 4
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 36, duration: '4', channel: 9, velocity: 100})); // kick
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 38, duration: '4', channel: 9, velocity: 100})); // snare
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 36, duration: '4', channel: 9, velocity: 90}));  // kick
  drums.addEvent(new MidiWriter.NoteEvent({pitch: 38, duration: '4', channel: 9, velocity: 100})); // snare
  // Hi-hat 8th notes
  for (let i = 0; i < 8; i++) {
    drums.addEvent(new MidiWriter.NoteEvent({pitch: 42, duration: '8', channel: 9, velocity: 60}));
  }
}

const write = new MidiWriter.Writer([guitar1, bass, drums]);
const fs = require('fs');
fs.writeFileSync('public/audio/e1m1.mid', write.buildFile());
console.log('Generated E1M1 MIDI:', write.buildFile().length, 'bytes');