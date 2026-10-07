import React, { useEffect, useRef } from 'react';

/**
 * Lightweight canvas orbital environment — stars, rings, particles, central core.
 * Respects prefers-reduced-motion. GPU-friendly transforms only on canvas.
 */
export default function OrbitalBackground({ variant = 'full' }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let dpr = 1;

    const isLight = () => !document.documentElement.classList.contains('dark');

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Generate static stars once
    const starCount = variant === 'minimal' ? 40 : 80;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      opacity: Math.random() * 0.5 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
    }));

    const orbitCount = variant === 'minimal' ? 2 : 3;
    const orbits = Array.from({ length: orbitCount }, (_, i) => ({
      radius: 0.15 + i * 0.12,
      speed: reducedMotion ? 0 : (0.00008 + i * 0.00004) * (i % 2 === 0 ? 1 : -1),
      angle: Math.random() * Math.PI * 2,
      tilt: 0.3 + i * 0.15,
    }));

    const particleCount = variant === 'minimal' ? 6 : 12;
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      orbit: i % orbitCount,
      angle: (i / particleCount) * Math.PI * 2,
      speed: reducedMotion ? 0 : 0.0006 + (i % 3) * 0.0002,
      size: 2 + (i % 2),
    }));

    let corePulse = 0;

    const draw = (timestamp) => {
      ctx.clearRect(0, 0, width, height);
      const light = isLight();
      const cx = width * 0.5;
      const cy = variant === 'auth' ? height * 0.35 : height * 0.45;
      const scale = Math.min(width, height);

      // Subtle radial atmosphere
      const atmo = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.6);
      if (light) {
        atmo.addColorStop(0, 'rgba(6, 182, 212, 0.06)');
        atmo.addColorStop(0.5, 'rgba(6, 182, 212, 0.02)');
        atmo.addColorStop(1, 'transparent');
      } else {
        atmo.addColorStop(0, 'rgba(34, 211, 238, 0.04)');
        atmo.addColorStop(0.4, 'rgba(6, 182, 212, 0.015)');
        atmo.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = atmo;
      ctx.fillRect(0, 0, width, height);

      // Faint grid
      if (!light && variant !== 'minimal') {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
        ctx.lineWidth = 1;
        const gridSize = 48;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // Stars
      stars.forEach((star) => {
        const twinkle = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(timestamp * 0.001 + star.twinkle);
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fillStyle = light
          ? `rgba(100, 116, 139, ${star.opacity * twinkle * 0.5})`
          : `rgba(226, 232, 240, ${star.opacity * twinkle})`;
        ctx.fill();
      });

      // Central AI core
      corePulse = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(timestamp * 0.001);
      const coreRadius = scale * 0.025 * corePulse;
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 4);
      coreGlow.addColorStop(0, light ? 'rgba(6, 182, 212, 0.25)' : 'rgba(34, 211, 238, 0.35)');
      coreGlow.addColorStop(0.5, light ? 'rgba(6, 182, 212, 0.08)' : 'rgba(34, 211, 238, 0.1)');
      coreGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = light ? 'rgba(6, 182, 212, 0.6)' : 'rgba(34, 211, 238, 0.8)';
      ctx.fill();

      // Orbital rings and particles
      orbits.forEach((orbit, oi) => {
        if (!reducedMotion) orbit.angle += orbit.speed * 16;

        const r = scale * orbit.radius;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(orbit.angle);
        ctx.scale(1, orbit.tilt);

        ctx.beginPath();
        ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
        ctx.strokeStyle = light
          ? `rgba(6, 182, 212, ${0.08 + oi * 0.02})`
          : `rgba(148, 163, 184, ${0.1 + oi * 0.03})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Particles on this orbit
        particles
          .filter((p) => p.orbit === oi)
          .forEach((p) => {
            if (!reducedMotion) p.angle += p.speed * 16;
            const px = cx + Math.cos(p.angle + orbit.angle) * r;
            const py = cy + Math.sin(p.angle + orbit.angle) * r * orbit.tilt;

            ctx.beginPath();
            ctx.arc(px, py, p.size * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = light ? 'rgba(6, 182, 212, 0.5)' : 'rgba(34, 211, 238, 0.7)';
            ctx.fill();
          });
      });

      if (!reducedMotion) {
        animRef.current = requestAnimationFrame(draw);
      }
    };

    resize();
    draw(0);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const themeObserver = new MutationObserver(() => draw(performance.now()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
