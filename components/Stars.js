import { useEffect, useRef } from 'react';

export default function Stars() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    for (let i = 0; i < 35; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size = Math.random() * 4 + 2;
      star.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random() * 100}%;
        top:${Math.random() * 100}%;
        animation-delay:${Math.random() * 4}s;
        animation-duration:${2 + Math.random() * 3}s;
      `;
      container.appendChild(star);
    }
  }, []);

  return <div className="stars-bg" ref={ref} />;
}
