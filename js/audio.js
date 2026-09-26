/**
 * Zero-Asset Audio Synthesizer for Captain Q HTML5
 * Generates crisp retro sound effects via native Web Audio API oscillators
 * (100% Zero-download weight, instant response, non-blocking)
 */

class SoundSynth {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx && typeof AudioContext !== "undefined") {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn("AudioContext not supported:", e);
            }
        }
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {});
        }
    }

    playTone(freq, type = "sine", duration = 0.08, gainVal = 0.1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }

    playDot() {
        this.playTone(480, "sine", 0.04, 0.04);
    }

    playTarget() {
        // Joyful two-tone chord for correct math answer
        this.playTone(523.25, "triangle", 0.12, 0.15); // C5
        setTimeout(() => this.playTone(659.25, "triangle", 0.15, 0.15), 80); // E5
        setTimeout(() => this.playTone(783.99, "triangle", 0.22, 0.18), 160); // G5
    }

    playTrap() {
        // Warning buzz for math misconception
        this.playTone(180, "sawtooth", 0.22, 0.16);
        setTimeout(() => this.playTone(130, "sawtooth", 0.28, 0.18), 100);
    }

    playSuperDot() {
        // Power-up rising pitch
        this.playTone(400, "square", 0.1, 0.12);
        setTimeout(() => this.playTone(600, "square", 0.1, 0.12), 70);
        setTimeout(() => this.playTone(850, "square", 0.15, 0.14), 140);
    }

    playGhostEaten() {
        this.playTone(300, "triangle", 0.15, 0.2);
        setTimeout(() => this.playTone(600, "sine", 0.2, 0.2), 80);
    }

    playVictory() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, "triangle", 0.25, 0.2), idx * 120);
        });
    }

    playGameOver() {
        const notes = [587.33, 523.25, 466.16, 392.00];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, "sawtooth", 0.3, 0.18), idx * 140);
        });
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
}

const audio = new SoundSynth();
