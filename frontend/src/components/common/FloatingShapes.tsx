
import React from 'react';

const FloatingShapes = () => {
    const numShapes = 20; // 表示する円の数を増やしました
    const colors = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF']; // かわいいパステルカラーパレット

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: 0,
        pointerEvents: 'none',
    };

    const keyframes = `
        @keyframes fly-around {
            0% {
                transform: translate(var(--x-start), var(--y-start)) rotate(0deg);
            }
            50% {
                transform: translate(var(--x-mid), var(--y-mid)) rotate(var(--r-mid));
            }
            100% {
                transform: translate(var(--x-end), var(--y-end)) rotate(0deg);
            }
        }
    `;

    return (
        <div style={containerStyle}>
            <style>{keyframes}</style>
            {Array.from({ length: numShapes }).map((_, index) => {
                const duration = Math.random() * 30 + 20; // 20-50秒
                const size = Math.random() * 80 + 40; // 40pxから120pxのランダムなサイズ

                const style = {
                    '--x-start': `${Math.random() * 100}vw`,
                    '--y-start': `${Math.random() * 100}vh`,
                    '--x-mid': `${Math.random() * 100}vw`,
                    '--y-mid': `${Math.random() * 100}vh`,
                    '--r-mid': `${Math.random() * 180 - 90}deg`,
                    '--x-end': `${Math.random() * 100}vw`,
                    '--y-end': `${Math.random() * 100}vh`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${size}px`,
                    height: `${size}px`,
                    animation: `fly-around ${duration}s ease-in-out infinite`,
                    willChange: 'transform',
                    animationDelay: `-${Math.random() * duration}s`,
                    opacity: Math.random() * 0.4 + 0.2, // 少し透明度を調整
                } as React.CSSProperties;

                const color = colors[Math.floor(Math.random() * colors.length)];

                return (
                    <div key={index} style={style}>
                        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                            <circle cx="50" cy="50" r="50" fill={color} />
                        </svg>
                    </div>
                );
            })}
        </div>
    );
};

export default FloatingShapes;
