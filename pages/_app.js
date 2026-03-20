import '../styles/globals.css';
import { AuthProvider } from '../components/AuthContext';
import Footer from '../components/Footer';
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Créer le canvas
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#E8A0C8', '#C8A0E8', '#FFD700', '#fff', '#F0C0FF', '#A0C8FF'];

    class Particle {
      constructor(x, y, isClick) {
        this.x = x;
        this.y = y;
        this.size = isClick ? Math.random() * 4 + 2 : Math.random() * 2.5 + 1;
        this.speedX = (Math.random() - 0.5) * (isClick ? 6 : 2);
        this.speedY = (Math.random() - 0.5) * (isClick ? 6 : 2) - (isClick ? 2 : 1);
        this.life = 1;
        this.decay = isClick ? Math.random() * 0.02 + 0.015 : Math.random() * 0.03 + 0.02;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.isClick = isClick;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += 0.05;
        this.life -= this.decay;
        this.size *= 0.97;
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Souris (PC)
    const handleMouseMove = (e) => {
      for (let i = 0; i < 3; i++) {
        particles.push(new Particle(
          e.clientX + (Math.random() - 0.5) * 10,
          e.clientY + (Math.random() - 0.5) * 10,
          false
        ));
      }
    };

    // Clic (PC)
    const handleClick = (e) => {
      for (let i = 0; i < 60; i++) {
        particles.push(new Particle(e.clientX, e.clientY, true));
      }
    };

    // Touch (mobile)
    const handleTouch = (e) => {
      const touch = e.touches[0];
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(
          touch.clientX + (Math.random() - 0.5) * 10,
          touch.clientY + (Math.random() - 0.5) * 10,
          false
        ));
      }
    };

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      for (let i = 0; i < 40; i++) {
        particles.push(new Particle(touch.clientX, touch.clientY, true));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    // Animation
    let animId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchstart', handleTouchStart);
      cancelAnimationFrame(animId);
      document.body.removeChild(canvas);
    };
  }, []);

  return (
    <AuthProvider>
      <Component {...pageProps} />
      <Footer />
    </AuthProvider>
  );
}
