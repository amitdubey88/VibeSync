// src/utils/soundEffects.js

class SoundSynthesizer {
  constructor() {
    this.audioCtx = null;
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTone(freq, type, duration, startTimeOffset = 0, volume = 0.1) {
    this.init();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + startTimeOffset);

    // Envelope
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime + startTimeOffset);
    gain.gain.linearRampToValueAtTime(volume, this.audioCtx.currentTime + startTimeOffset + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + startTimeOffset + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(this.audioCtx.currentTime + startTimeOffset);
    osc.stop(this.audioCtx.currentTime + startTimeOffset + duration);
  }

  // 1. Join Room (Happy ascending tone)
  playJoin() {
    this.init();
    this.playTone(440, 'sine', 0.2, 0, 0.1);   // A4
    this.playTone(554.37, 'sine', 0.2, 0.1, 0.1); // C#5
    this.playTone(659.25, 'sine', 0.4, 0.2, 0.15); // E5
  }

  // 2. Leave Room (Soft descending tone)
  playLeave() {
    this.init();
    this.playTone(440, 'sine', 0.2, 0, 0.05);   // A4
    this.playTone(349.23, 'sine', 0.3, 0.15, 0.05); // F4
  }

  // 3. Notification (e.g., chat message) - Quick bright pop
  playNotification() {
    this.init();
    this.playTone(880, 'triangle', 0.1, 0, 0.05);
    this.playTone(1760, 'sine', 0.15, 0.05, 0.05);
  }

  // 4. Join Request (Knock knock)
  playKnock() {
    this.init();
    // Low frequency, short duration for a percussive knock
    this.playTone(150, 'square', 0.1, 0, 0.1);
    this.playTone(150, 'square', 0.1, 0.15, 0.1);
  }

  // 6. Mention Sound
  playMention() {
    this.init();
    this.playTone(880, 'sine', 0.1, 0, 0.15);
    this.playTone(1318.51, 'sine', 0.2, 0.1, 0.2); // E6
  }

  // 5. Session Ended (Dramatic / Power down)
  playSessionEnded() {
    this.init();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 1.0); // pitch drop

    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.0);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + 1.0);
  }
}

// Export a singleton instance
export const sounds = new SoundSynthesizer();
