import { useEffect, useRef } from 'react';

export function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Array<{x: number, y: number, radius: number, alpha: number, speed: number}> = [];
    let cssWidth = 0;
    let cssHeight = 0;

    const initStars = () => {
      stars = [];
      const count = Math.floor((cssWidth * cssHeight) / 3000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * cssWidth,
          y: Math.random() * cssHeight,
          radius: Math.random() * 1.5,
          alpha: Math.random(),
          speed: 0 // No speed needed for static
        });
      }
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      
      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
      gradient.addColorStop(0, '#0f172a'); // Slate 900
      gradient.addColorStop(1, '#1e1b4b'); // Indigo 950
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // Draw stars
      ctx.fillStyle = 'white';
      stars.forEach(star => {
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const resize = () => {
      if (!canvas || !ctx) return;
      // On iOS Safari, visualViewport gives the actual visible area accounting
      // for dynamic UI (address bar, tab bar). Fall back to window dimensions
      // for other browsers.
      const vp = window.visualViewport;
      cssWidth = vp ? vp.width : window.innerWidth;
      cssHeight = vp ? vp.height : window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      
      // Set canvas resolution to physical pixels for crisp rendering
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      
      // Reset transform and scale context to work in CSS pixels
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      
      initStars();
      draw();
    };

    window.addEventListener('resize', resize);
    // Also listen to visualViewport resize for iOS Safari address bar changes
    window.visualViewport?.addEventListener('resize', resize);
    resize(); // This calls initStars and draw


    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed -z-10 pointer-events-none"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
