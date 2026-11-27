// Genera un pad ambiente sin costuras (loop de 16 s) → public/audio/ambient.wav
import fs from 'node:fs';
const sr = 22050, secs = 16, n = sr * secs;
const freqs = [55, 82.5, 110, 164.8125, 220.0625, 329.625]; // múltiplos de 1/16 Hz → ciclos enteros en 16 s
const buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const t = i / sr; let v = 0;
  freqs.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t + k) * (0.5 / (k + 1.5)) * (0.6 + 0.4 * Math.sin((2 * Math.PI * (k + 1) * t) / secs)); });
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * 0.55)) * 32767), 44 + i * 2);
}
fs.mkdirSync('public/audio', { recursive: true });
fs.writeFileSync('public/audio/ambient.wav', buf);
console.log('ok', (buf.length / 1024).toFixed(0) + ' KB');
