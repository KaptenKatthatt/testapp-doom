// AudioManager — handles all game audio (sound effects + music)
// Uses Web Audio API for low-latency playback

class AudioManager {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicVolume = 0.3;
  private sfxVolume = 0.7;
  private musicPlaying = false;
  private loaded = false;

  async init(): Promise<void> {
    if (this.audioContext) return;
    this.audioContext = new AudioContext();

    // Create gain nodes
    this.musicGain = this.audioContext.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.audioContext.destination);

    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.audioContext.destination);

    // Load all sounds
    await this.loadAll();
    this.loaded = true;
  }

  private async loadAll(): Promise<void> {
    const sounds = [
      // Shotgun
      { name: 'shotgun', file: 'dsshotgn' },
      { name: 'shotgun_cock', file: 'dssgcock' },
      // Doors
      { name: 'door_open', file: 'dsdoropn' },
      { name: 'door_close', file: 'dsdbcls' },
      { name: 'door_open_fast', file: 'dsbdopn' },
      { name: 'door_close_fast', file: 'dsbdcls' },
      // Player
      { name: 'player_hurt', file: 'dsoof' },
      { name: 'player_death', file: 'dspldeth' },
      { name: 'player_pain', file: 'dsplpain' },
      // Imp
      { name: 'imp_alert', file: 'dscacsit' },
      { name: 'imp_death', file: 'dscacdth' },
      // Zombie
      { name: 'zombie_alert', file: 'dsposit1' },
      { name: 'zombie_death', file: 'dspodth1' },
      { name: 'pistol', file: 'dspistol' },
      // Demon
      { name: 'demon_alert', file: 'dssgtsit' },
      { name: 'demon_attack', file: 'dssgtatk' },
      { name: 'demon_death', file: 'dssgtdth' },
      // Pickups
      { name: 'item_pickup', file: 'dsitemup' },
      { name: 'powerup', file: 'dsgetpow' },
      { name: 'weapon_pickup', file: 'dswpnup' },
      // Fireball
      { name: 'fireball', file: 'dsfirsht' },
      { name: 'fireball_hit', file: 'dsfirxpl' },
      { name: 'explosion', file: 'dsbarexp' },
      // Environment
      { name: 'switch', file: 'dsswtchn' },
      { name: 'teleport', file: 'dstelept' },
      { name: 'slime', file: 'dsslop' },
      { name: 'metal_step', file: 'dsmetal' },
      { name: 'footstep', file: 'dshoof' },
      { name: 'noway', file: 'dsnoway' },
    ];

    // Load OGG files (prefer OGG over WAV)
    const promises = sounds.map(async ({ name, file }) => {
      try {
        const response = await fetch(`/sounds/${file}.ogg`);
        if (!response.ok) {
          // Fallback to WAV
          const wavResponse = await fetch(`/sounds/${file}.wav`);
          if (!wavResponse.ok) return;
          const arrayBuffer = await wavResponse.arrayBuffer();
          const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
          this.buffers.set(name, audioBuffer);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
      } catch (e) {
        // Sound not found, skip silently
        console.warn(`Failed to load sound: ${name}`, e);
      }
    });

    await Promise.all(promises);
  }

  // Resume audio context (needed after user gesture)
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Play a sound effect
  play(name: string, volumeScale = 1.0): void {
    if (!this.loaded || !this.audioContext || !this.sfxGain) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    if (volumeScale !== 1.0) {
      const localGain = this.audioContext.createGain();
      localGain.gain.value = volumeScale;
      source.connect(localGain);
      localGain.connect(this.sfxGain);
    } else {
      source.connect(this.sfxGain);
    }

    source.start(0);
  }

  // Play E1M1 music (looping)
  async playMusic(): Promise<void> {
    if (!this.loaded || !this.audioContext || !this.musicGain || this.musicPlaying) return;

    try {
      // Cache the music buffer
      if (!this.musicBuffer) {
        const response = await fetch('/audio/e1m1.ogg');
        const arrayBuffer = await response.arrayBuffer();
        this.musicBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      }

      this.musicSource = this.audioContext.createBufferSource();
      this.musicSource.buffer = this.musicBuffer;
      this.musicSource.loop = true;
      this.musicSource.connect(this.musicGain);
      this.musicSource.start(0);
      this.musicPlaying = true;
    } catch (e) {
      console.warn('Failed to play music:', e);
    }
  }

  // Stop music
  stopMusic(): void {
    if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource = null;
      this.musicPlaying = false;
    }
  }

  // Set music volume (0-1)
  setMusicVolume(vol: number): void {
    this.musicVolume = vol;
    if (this.musicGain) {
      this.musicGain.gain.value = vol;
    }
  }

  // Set SFX volume (0-1)
  setSfxVolume(vol: number): void {
    this.sfxVolume = vol;
    if (this.sfxGain) {
      this.sfxGain.gain.value = vol;
    }
  }

  // Check if loaded
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton
export const audioManager = new AudioManager();