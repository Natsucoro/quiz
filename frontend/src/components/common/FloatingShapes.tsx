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

    // 均等なグリッドを作り、そのマス目の中でだけ位置をずらす
    // (完全ランダムだと偏りが出て、密集/空白ができてしまうため)
    const cols = Math.ceil(Math.sqrt(numShapes * 1.3));
    const rows = Math.ceil(numShapes / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;

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

    // 上下にふわっと漂うだけで、天地がひっくり返らない程度の
    // 小さな回転(±8度)にとどめる
    const keyframes = `
        @keyframes float-gently {
            0% {
                transform: translate(0, 0) rotate(var(--r-start));
            }
            50% {
                transform: translate(var(--x-mid), var(--y-mid)) rotate(var(--r-end));
            }
            100% {
                transform: translate(0, 0) rotate(var(--r-start));
            }
        }
    `;

    return (
        <div style={containerStyle}>
            <style>{keyframes}</style>
            {Array.from({ length: numShapes }).map((_, index) => {
                const duration = Math.random() * 40 + 30; // 30-70秒でゆっくりふわふわ
                const size = (Math.random() * 60 + 40) * 1.2; // 40pxから100pxの1.2倍 (48px - 120px)

                const col = index % cols;
                const row = Math.floor(index / cols);
                // マス目の中心 ± マス目の25%だけランダムにずらす(等間隔感を保ちつつ自然に)
                const baseX = (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.5;
                const baseY = (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.5;

                const style = {
                    '--x-mid': `${(Math.random() - 0.5) * 4}vw`,
                    '--y-mid': `${(Math.random() - 0.5) * 4}vh`,
                    '--r-start': `${(Math.random() - 0.5) * 12}deg`,
                    '--r-end': `${(Math.random() - 0.5) * 12}deg`,
                    position: 'absolute',
                    top: `${baseY}%`,
                    left: `${baseX}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    animation: `float-gently ${duration}s ease-in-out infinite`,
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
