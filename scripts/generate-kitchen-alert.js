// Generate app-style notification WAV for kitchen KDS.
// Run: node scripts/generate-kitchen-alert.js
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT = path.join(__dirname, '..', 'app', 'static', 'kitchen-alert.wav');

function writeWav(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 30000 / peak : 1;

  const pcm = samples.map(s => {
    const v = Math.round(Math.max(-32768, Math.min(32767, s * norm)));
    return v;
  });

  const dataSize = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(pcm[i], 44 + i * 2);
  }
  fs.writeFileSync(OUT, buf);
  console.log('Wrote', OUT, buf.length, 'bytes,', (pcm.length / SAMPLE_RATE).toFixed(2), 's');
}

function addPop(samples, startSec, durationSec, volume) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(durationSec * SAMPLE_RATE);
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 55) * (1 - i / len);
    const click = rand() * 0.55 + Math.sin(2 * Math.PI * 180 * t) * 0.45;
    const idx = start + i;
    if (idx < samples.length) samples[idx] += click * volume * env;
  }
}

function addChime(samples, startSec, freq, durationSec, volume) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(durationSec * SAMPLE_RATE);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.006));
    const release = Math.pow(1 - i / len, 1.4);
    const env = attack * release;
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic = Math.sin(2 * Math.PI * freq * 2 * t) * 0.18;
    const idx = start + i;
    if (idx < samples.length) samples[idx] += (fundamental + harmonic) * volume * env;
  }
}

// App notification: soft pop + ascending 3-note chime (~0.55s)
const totalSec = 0.65;
const samples = new Float64Array(Math.ceil(totalSec * SAMPLE_RATE));

addPop(samples, 0, 0.045, 0.35);
addChime(samples, 0.055, 880, 0.09, 0.55);   // A5
addChime(samples, 0.13, 1174.66, 0.11, 0.62); // D6
addChime(samples, 0.22, 1567.98, 0.14, 0.68); // G6

writeWav(samples);
