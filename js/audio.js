/**
 * Web Audio 合成音效与背景音乐，不依赖任何外部音频文件。
 */
const AudioFX = (() => {
  let ctx = null;
  let master = null;
  let sfx = null;
  let music = null;
  let noiseBuffer = null;
  let soundOn = true;
  let musicOn = true;
  let musicTimer = null;
  let nextStepTime = 0;
  let step = 0;
  let musicVariant = "classic";

  const BASS_SEQ = {
    classic: [55, 55, 65.4, 55, 49, 49, 55, 49],
    survival: [49, 49, 55, 58.3, 49, 49, 65.4, 58.3],
    brawl: [82.4, 82.4, 98, 82.4, 73.4, 73.4, 82.4, 73.4]
  };

  const MELODY_SEQ = {
    classic: [220, 0, 261.6, 0, 329.6, 0, 293.7, 0, 261.6, 0, 220, 0, 196, 0, 174.6, 0],
    survival: [196, 0, 220, 233.1, 0, 261.6, 233.1, 0, 220, 0, 196, 0, 174.6, 196, 220, 233.1],
    brawl: [261.6, 0, 329.6, 349.2, 392, 349.2, 329.6, 0, 293.7, 0, 261.6, 293.7, 329.6, 392, 349.2, 329.6]
  };

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      sfx = ctx.createGain();
      sfx.gain.value = soundOn ? 0.7 : 0;
      sfx.connect(master);

      music = ctx.createGain();
      music.gain.value = musicOn ? 0.32 : 0;
      music.connect(master);

      const length = ctx.sampleRate * 1.2;
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        channel[i] = Math.random() * 2 - 1;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function setSound(on) {
    soundOn = on;
    if (ctx && sfx) {
      sfx.gain.value = on ? 0.7 : 0;
    }
  }

  function setMusic(on) {
    musicOn = on;
    if (ctx && music) {
      music.gain.value = on ? 0.32 : 0;
    }
    if (!on) stopMusic();
  }

  function tone(opts) {
    if (!soundOn || !ensure()) return;
    const when = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const type = opts.type || "square";
    const startFreq = opts.freq || 440;
    const endFreq = opts.endFreq || startFreq;
    const duration = opts.duration || 0.12;

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, when);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), when + duration);
    }
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.2, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(sfx);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function noise(opts) {
    if (!soundOn || !ensure() || !noiseBuffer) return;
    const when = ctx.currentTime + (opts.delay || 0);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(opts.filter || 1200, when);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, opts.filterEnd || 180),
      when + (opts.duration || 0.3)
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.gain || 0.25, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (opts.duration || 0.3));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfx);
    source.start(when);
    source.stop(when + (opts.duration || 0.3) + 0.02);
  }

  function shot(isPlayer) {
    tone({
      type: "square",
      freq: isPlayer ? 720 : 420,
      endFreq: 140,
      duration: 0.09,
      gain: isPlayer ? 0.18 : 0.12
    });
    noise({ duration: 0.05, filter: 2400, filterEnd: 700, gain: 0.08 });
  }

  function hit() {
    tone({ type: "triangle", freq: 330, endFreq: 90, duration: 0.13, gain: 0.18 });
    noise({ duration: 0.12, filter: 1600, filterEnd: 240, gain: 0.14 });
  }

  function explosion(size) {
    const scale = Math.min(2, Math.max(0.6, size || 1));
    noise({ duration: 0.42 * scale, filter: 1300, filterEnd: 70, gain: 0.34 * scale });
    tone({ type: "sine", freq: 96, endFreq: 34, duration: 0.4 * scale, gain: 0.28 });
  }

  function powerup() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      tone({ type: "square", freq, duration: 0.12, gain: 0.14, delay: i * 0.07 });
    });
  }

  function life() {
    [392, 523, 659, 784, 1046].forEach((freq, i) => {
      tone({ type: "triangle", freq, duration: 0.16, gain: 0.16, delay: i * 0.08 });
    });
  }

  function shield() {
    tone({ type: "sine", freq: 880, endFreq: 1320, duration: 0.5, gain: 0.12 });
    tone({ type: "sine", freq: 1760, endFreq: 2640, duration: 0.5, gain: 0.06, delay: 0.02 });
  }

  function shovel() {
    [180, 120, 180, 120].forEach((freq, i) => {
      tone({ type: "square", freq, duration: 0.1, gain: 0.16, delay: i * 0.08 });
    });
  }

  function freeze() {
    [1200, 900, 620, 330].forEach((freq, i) => {
      tone({ type: "sine", freq, duration: 0.2, gain: 0.1, delay: i * 0.11 });
    });
  }

  function gameOver() {
    [392, 311, 233, 155, 98].forEach((freq, i) => {
      tone({ type: "sawtooth", freq, duration: 0.42, gain: 0.12, delay: i * 0.18 });
    });
  }

  function win() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((freq, i) => {
      tone({ type: "triangle", freq, duration: 0.22, gain: 0.16, delay: i * 0.12 });
    });
  }

  function coin() {
    tone({ type: "square", freq: 880, duration: 0.08, gain: 0.12 });
    tone({ type: "square", freq: 1320, duration: 0.12, gain: 0.12, delay: 0.07 });
  }

  function buy() {
    [392, 523, 659, 784].forEach((freq, i) => {
      tone({ type: "triangle", freq, duration: 0.16, gain: 0.16, delay: i * 0.07 });
    });
  }

  function boxOpen() {
    noise({ duration: 0.35, filter: 900, filterEnd: 2200, gain: 0.3 });
    tone({ type: "sawtooth", freq: 180, endFreq: 720, duration: 0.35, gain: 0.12 });
    tone({ type: "triangle", freq: 1046, duration: 0.24, gain: 0.16, delay: 0.18 });
  }

  function checkin() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      tone({ type: "sine", freq, duration: 0.2, gain: 0.14, delay: i * 0.09 });
    });
  }

  function achievement() {
    [392, 523, 659, 784, 1046, 1318].forEach((freq, i) => {
      tone({ type: "square", freq, duration: 0.18, gain: 0.12, delay: i * 0.08 });
    });
  }

  function taskDone() {
    [659, 784, 1046].forEach((freq, i) => {
      tone({ type: "triangle", freq, duration: 0.14, gain: 0.15, delay: i * 0.06 });
    });
  }

  function unlock() {
    [523, 659, 784, 1046, 1568].forEach((freq, i) => {
      tone({ type: "triangle", freq, duration: 0.2, gain: 0.15, delay: i * 0.08 });
    });
  }

  function playStep(stepIndex, when) {
    const bass = BASS_SEQ[musicVariant] || BASS_SEQ.classic;
    const melody = MELODY_SEQ[musicVariant] || MELODY_SEQ.classic;
    const spb = 60 / 132 / 4;

    const bassFreq = bass[stepIndex % bass.length];
    if (bassFreq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = bassFreq;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.18, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + spb * 1.8);
      osc.connect(gain);
      gain.connect(music);
      osc.start(when);
      osc.stop(when + spb * 2);
    }

    const melodyFreq = melody[stepIndex % melody.length];
    if (melodyFreq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = melodyFreq;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.07, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + spb * 0.9);
      osc.connect(gain);
      gain.connect(music);
      osc.start(when);
      osc.stop(when + spb);
    }

    if (stepIndex % 2 === 0 && noiseBuffer && music) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 5200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.035, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(music);
      source.start(when);
      source.stop(when + 0.05);
    }
  }

  function startMusic(variant) {
    if (!ensure() || !musicOn) return;
    stopMusic();
    musicVariant = variant || "classic";
    nextStepTime = ctx.currentTime + 0.08;
    step = 0;
    musicTimer = setInterval(() => {
      if (!ctx || !music) return;
      const spb = 60 / 132 / 4;
      while (nextStepTime < ctx.currentTime + 0.3) {
        playStep(step, nextStepTime);
        nextStepTime += spb;
        step = (step + 1) % 16;
      }
    }, 90);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    resume,
    setSound,
    setMusic,
    shot,
    hit,
    explosion,
    powerup,
    life,
    shield,
    shovel,
    freeze,
    gameOver,
    win,
    coin,
    buy,
    boxOpen,
    checkin,
    achievement,
    taskDone,
    unlock,
    startMusic,
    stopMusic
  };
})();
