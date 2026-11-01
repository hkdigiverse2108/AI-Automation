/**
 * Festive Firecrackers & Confetti Burst for celebrations
 * Zero dependencies, high performance canvas animation with multi-stage cracker bursts
 */
export function fireCrackers() {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const scale = window.devicePixelRatio || 1;
  let width = (canvas.width = window.innerWidth * scale);
  let height = (canvas.height = window.innerHeight * scale);

  const colors = [
    '#10B981', '#059669', '#34D399', // Emerald greens
    '#F59E0B', '#FBBF24', '#D97706', // Gold / Amber
    '#EF4444', '#F43F5E',             // Ruby / Crimson
    '#8B5CF6', '#A855F7',             // Royal Purple
    '#06B6D4', '#3B82F6',             // Cyan / Blue
    '#EC4899', '#FB7185'              // Festive Pink
  ];

  const shapes = ['rect', 'circle', 'star'];
  let particles = [];

  function createFireworkBurst(originX, originY, count = 65, speedMultiplier = 1) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = (Math.random() * 8 + 4) * speedMultiplier * scale;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (Math.random() * 6 + 4) * scale,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        alpha: 1,
        decay: Math.random() * 0.012 + 0.008,
        gravity: 0.18 * scale,
        drag: 0.96,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.1 + 0.05
      });
    }
  }

  function createCannonBurst(originX, originY, angleDeg, spreadDeg = 45, count = 55) {
    const baseAngle = (angleDeg * Math.PI) / 180;
    const spread = (spreadDeg * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = (Math.random() * 12 + 10) * scale;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (Math.random() * 7 + 4) * scale,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.3 ? 'rect' : 'star',
        alpha: 1,
        decay: Math.random() * 0.009 + 0.006,
        gravity: 0.22 * scale,
        drag: 0.975,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.12 + 0.06
      });
    }
  }

  function drawStar(context, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    context.beginPath();
    context.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      context.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      context.lineTo(x, y);
      rot += step;
    }
    context.lineTo(cx, cy - outerRadius);
    context.closePath();
    context.fill();
  }

  // Stage 1: Left & Right bottom cannons
  createCannonBurst(width * 0.1, height * 0.95, -65, 40, 60);
  createCannonBurst(width * 0.9, height * 0.95, -115, 40, 60);

  // Stage 2: Center sky firecracker burst (300ms)
  setTimeout(() => {
    createFireworkBurst(width * 0.5, height * 0.35, 75, 1.2);
  }, 300);

  // Stage 3: Twin side firecracker bursts (650ms)
  setTimeout(() => {
    createFireworkBurst(width * 0.3, height * 0.4, 50, 1.0);
    createFireworkBurst(width * 0.7, height * 0.38, 50, 1.0);
  }, 650);

  // Stage 4: Finale cannon shower (1000ms)
  setTimeout(() => {
    createCannonBurst(width * 0.2, height * 0.95, -70, 35, 45);
    createCannonBurst(width * 0.8, height * 0.95, -110, 35, 45);
  }, 1000);

  let animationFrameId;
  function update() {
    ctx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.rotation += p.rotSpeed;
      p.wobble += p.wobbleSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > height + 60) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.shape === 'rect') {
        const flipScale = Math.cos(p.wobble);
        ctx.fillRect(-p.size / 2, (-p.size * flipScale) / 2, p.size, p.size * 1.6 * Math.abs(flipScale));
      } else if (p.shape === 'star') {
        drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.length > 0) {
      animationFrameId = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(animationFrameId);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  animationFrameId = requestAnimationFrame(update);
}

