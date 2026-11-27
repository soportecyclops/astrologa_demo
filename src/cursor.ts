/** Cursor-constelación: deja estrellas que se unen con líneas finas doradas si están cerca. */
export function initTrail(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const pts: { x: number; y: number; life: number; s: number }[] = [];
  const fit = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  fit(); addEventListener('resize', fit);
  let last = { x: -999, y: -999 };
  const add = (x: number, y: number) => {
    if (Math.hypot(x - last.x, y - last.y) < 34) return;
    last = { x, y };
    pts.push({ x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 18, life: 1, s: 1 + Math.random() * 1.6 });
    if (pts.length > 26) pts.shift();
  };
  addEventListener('pointermove', (e) => add(e.clientX, e.clientY), { passive: true });
  const loop = () => {
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = pts.length - 1; i >= 0; i--) { pts[i].life -= 0.011; if (pts[i].life <= 0) pts.splice(i, 1); }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 130) {
          ctx.strokeStyle = `rgba(212,175,55,${Math.min(pts[i].life, pts[j].life) * (1 - d / 130) * 0.7})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
    }
    for (const p of pts) {
      ctx.fillStyle = `rgba(241,227,189,${p.life})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
    }
  };
  loop();
}
