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
    // キャラクターの数はしっかり多めに。ただし全マス目を常に使い切るのではなく
    // 少しだけ余らせてシャッフルすることで、配置がランダムに見えるようにする
    const totalCells = iconUrls.length > 0 ? 44 : 34;
    const numShapes = Math.round(totalCells * 0.8); // 8割程度は常に何か表示されている状態に

    // 均等なグリッドを作り、そのマス目の中でだけ位置をずらす
    // (完全ランダムだと偏りが出て、密集/空白ができてしまうため)
    const cols = Math.ceil(Math.sqrt(totalCells * 1.3));
    const rows = Math.ceil(totalCells / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;

    // マス目をシャッフルして、そこからnumShapes個だけ使う
    // → 等間隔は保ちつつ、どこに出るかはランダムになる
    const cellIndices = Array.from({ length: totalCells }, (_, i) => i);
    for (let i = cellIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cellIndices[i], cellIndices[j]] = [cellIndices[j], cellIndices[i]];
    }
    const usedCells = cellIndices.slice(0, numShapes);

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
    // fade-in-outで、ずっと出っぱなしにならないよう随時フェードイン・アウトさせる
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
        @keyframes fade-in-out {
            0%, 100% { opacity: 0; }
            15% { opacity: var(--target-opacity); }
            75% { opacity: var(--target-opacity); }
            90% { opacity: 0; }
        }
    `;

    return (
        <div style={containerStyle}>
            <style>{keyframes}</style>
            {usedCells.map((cellIndex) => {
                const floatDuration = Math.random() * 40 + 30; // 30-70秒でゆっくりふわふわ
                const fadeDuration = Math.random() * 25 + 25; // 25-50秒で現れて消える
                const size = (Math.random() * 50 + 36) * 1.1; // 40px前後 (かさばらないよう少し小さめに)

                const col = cellIndex % cols;
                const row = Math.floor(cellIndex / cols);
                // マス目の中心 ± マス目の25%だけランダムにずらす(等間隔感を保ちつつ自然に)
                const baseX = (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.5;
                const baseY = (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.5;

                const style = {
                    '--x-mid': `${(Math.random() - 0.5) * 4}vw`,
                    '--y-mid': `${(Math.random() - 0.5) * 4}vh`,
                    '--r-start': `${(Math.random() - 0.5) * 12}deg`,
                    '--r-end': `${(Math.random() - 0.5) * 12}deg`,
                    '--target-opacity': Math.random() * 0.15 + 0.12, // 控えめな透明度(0.12〜0.27)
                    position: 'absolute',
                    top: `${baseY}%`,
                    left: `${baseX}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    animation: `float-gently ${floatDuration}s ease-in-out infinite, fade-in-out ${fadeDuration}s ease-in-out infinite`,
                    willChange: 'transform, opacity',
                    animationDelay: `-${Math.random() * floatDuration}s, -${Math.random() * fadeDuration}s`,
                    opacity: 0,
                } as React.CSSProperties;

                // ランダムにアイコンを選択
                const iconUrl = iconUrls.length > 0
                  ? iconUrls[Math.floor(Math.random() * iconUrls.length)]
                  : null;

                return (
                    <div key={cellIndex} style={style}>
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
