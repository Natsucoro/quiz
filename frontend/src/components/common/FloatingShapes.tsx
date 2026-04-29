import React from 'react';

// Viteのimport.meta.globを使用してアイコンを一括インポート
const svgModules = import.meta.glob<{ default: string }>('../../assets/icons/*.svg', { eager: true });

const targetFiles = [
  'ashika.svg', 'batta.svg', 'chou.svg', 'chou2.svg', 'food.svg', 'inko.svg', 'hamu.svg', 'inu.svg',
  'iruka.svg', 'kabutomushi.svg', 'kamakiri.svg', 'kani.svg', 'kuwagata.svg', 'neko.svg', 'pengin.svg',
  'pengin2.svg', 'rakko.svg', 'risu.svg', 'sakana.svg', 'sakana2.svg', 'tanuki.svg', 'ten.svg',
  'texirano.svg', 'uma.svg', 'ushi.svg', 'kuma_1.svg', 'kuma_2.svg', 'panda.svg', 'usagi.svg',
  'cat.svg', 'kirin.svg', 'manta.svg', 'manbo.svg', 'texirano_2.svg', 'texirano_5.svg', 'texirano_4.svg',
  'texirano_3.svg', 'kakigori.svg', 'otsukimi.svg', 'car.svg', 'car_2.svg', 'car_3.svg', 'track.svg', 'syoubou.svg'
];

// 存在するアイコンのURLだけを抽出
const iconUrls = targetFiles.map(file => {
  const path = `../../assets/icons/${file}`;
  return svgModules[path]?.default || null;
}).filter(Boolean) as string[];

const FloatingShapes = () => {
    // アイコンの数を少し減らす調整
    const numShapes = iconUrls.length > 0 ? 28 : 20;

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
                const duration = Math.random() * 40 + 30; // 30-70秒でゆっくりふわふわ
                const size = (Math.random() * 60 + 40) * 1.2; // 40pxから100pxの1.2倍 (48px - 120px)

                const style = {
                    '--x-start': `${Math.random() * 110 - 5}vw`,
                    '--y-start': `${Math.random() * 110 - 5}vh`,
                    '--x-mid': `${Math.random() * 110 - 5}vw`,
                    '--y-mid': `${Math.random() * 110 - 5}vh`,
                    '--r-mid': `${Math.random() * 120 - 60}deg`, // 揺れ幅を少し大きめに
                    '--x-end': `${Math.random() * 110 - 5}vw`,
                    '--y-end': `${Math.random() * 110 - 5}vh`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${size}px`,
                    height: `${size}px`,
                    animation: `fly-around ${duration}s ease-in-out infinite alternate`,
                    willChange: 'transform',
                    animationDelay: `-${Math.random() * duration}s`,
                    opacity: Math.random() * 0.2 + 0.15, // 透明度を下げて少し濃く (0.15 ~ 0.35)
                } as React.CSSProperties;

                // ランダムにアイコンを選択
                const iconUrl = iconUrls.length > 0 
                  ? iconUrls[Math.floor(Math.random() * iconUrls.length)]
                  : null;

                return (
                    <div key={index} style={style}>
                        {iconUrl ? (
                            <img src={iconUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="background shape" />
                        ) : (
                            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                                <circle cx="50" cy="50" r="50" fill="#FFF" opacity="0.3" />
                            </svg>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default FloatingShapes;
