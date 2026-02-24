import { useEffect, useRef } from 'react';

export function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Array<{x: number, y: number, radius: number, alpha: number, speed: number}> = [];

    const initStars = () => {
      stars = [];
      const count = Math.floor((canvas.width * canvas.height) / 3000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5,
          alpha: Math.random(),
          speed: 0 // No speed needed for static
        });
      }
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0f172a'); // Slate 900
      gradient.addColorStop(1, '#1e1b4b'); // Indigo 950
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      if (!canvas) return;
      // Use the full visual viewport including the area behind the iPhone
      // notch / Dynamic Island. With viewport-fit=cover the browser exposes
      // the extra space, but window.innerHeight still reports the safe-area
      // height on some iOS versions — screen dimensions are more reliable.
      canvas.width = Math.max(window.innerWidth, screen.width);
      canvas.height = Math.max(window.innerHeight, screen.height);
      initStars();
      draw();
    };

    window.addEventListener('resize', resize);
    resize(); // This calls initStars and draw


    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed -z-10 pointer-events-none"
      style={{
        /* Extend past the safe-area insets so the stars fill behind the
           iPhone notch / Dynamic Island. With viewport-fit=cover the browser
           allows content in this area, but inset-0 alone stops at the
           safe-area boundary. */
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    />
  );
}
