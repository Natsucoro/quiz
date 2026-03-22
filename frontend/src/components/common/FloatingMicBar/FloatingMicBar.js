import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const FloatingMicBar = ({ isRecognizing, isListening, isProcessing, transcript }) => {
    const dotColor = isProcessing ? '#FF9A3C' : (isListening || isRecognizing) ? '#4CAF50' : '#f44336';
    const textColor = isProcessing ? '#e65100' : (isListening || isRecognizing) ? '#2e7d32' : '#c62828';
    const label = isProcessing ? '⚡ 判定中...' : isListening ? '🎤 ききとり中...' : isRecognizing ? '🎤 待機中' : '🎤 認識オフ';
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: `@keyframes micPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.5} } @keyframes micFade { 0%,100%{opacity:1} 50%{opacity:0.4} }` }), _jsx("div", { style: floatingMicBarStyle, children: _jsxs("div", { style: transcriptBoxStyle, children: [_jsxs("div", { style: micStatusStyle, children: [_jsx("span", { style: {
                                        ...micDotStyle,
                                        background: dotColor,
                                        animation: (isListening || isRecognizing) && !isProcessing ? 'micPulse 1.2s ease-in-out infinite' : 'none',
                                    } }), _jsx("span", { style: {
                                        color: textColor,
                                        fontWeight: 'bold',
                                        fontSize: '1em',
                                        animation: isListening && !isProcessing ? 'micFade 1.2s ease-in-out infinite' : 'none',
                                    }, children: label })] }), transcript && _jsx("span", { style: transcriptTextStyle, children: transcript })] }) })] }));
};
const floatingMicBarStyle = { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '90%', maxWidth: '500px', pointerEvents: 'none' };
const micStatusStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '2px 0' };
const micDotStyle = { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' };
const transcriptBoxStyle = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', backgroundColor: 'rgba(255,255,255,0.75)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '16px', padding: '10px 18px', minHeight: '48px', width: '100%', boxSizing: 'border-box', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)' };
const transcriptTextStyle = { fontSize: '1.3em', color: '#333', fontWeight: 'bold', wordBreak: 'break-all' };
export default FloatingMicBar;
