import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/common/Settings/Settings.tsx
import { useState, useEffect } from 'react';
import { getSpeechRate, setSpeechRate } from '../../../services/speechSynthesis';
import Login, { getLoginStatus, saveLoginStatus } from '../Login/Login';
const Settings = ({ onClose, onLoginStatusChange, currentView }) => {
    const [speechRate, setLocalSpeechRate] = useState(getSpeechRate());
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginStatus, setLoginStatus] = useState(getLoginStatus());
    useEffect(() => {
        setLoginStatus(getLoginStatus());
    }, [showLoginModal]); // Loginモーダルが閉じられたときに状態を更新
    const handleSpeechRateChange = (event) => {
        const newRate = parseFloat(event.target.value);
        setLocalSpeechRate(newRate);
        setSpeechRate(newRate);
    };
    const handleLoginLogout = () => {
        if (loginStatus.isLoggedIn) {
            // ログアウト処理
            saveLoginStatus(false, false);
            setLoginStatus({ isLoggedIn: false, isPremium: false });
            onLoginStatusChange(false, false);
        }
        else {
            // ログインモーダル表示
            setShowLoginModal(true);
        }
    };
    const handleLoginSuccess = (isPremium) => {
        setLoginStatus({ isLoggedIn: true, isPremium });
        onLoginStatusChange(true, isPremium);
        setShowLoginModal(false);
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: modalOverlayStyle, children: _jsxs("div", { style: modalContentStyle, children: [_jsx("h2", { style: modalTitleStyle, children: "\u2699\uFE0F \u8A2D\u5B9A" }), _jsxs("div", { style: settingSectionStyle, children: [_jsx("h3", { style: settingSectionTitleStyle, children: "\u8AAD\u307F\u4E0A\u3052\u901F\u5EA6" }), _jsx("input", { type: "range", min: "0.5", max: "2.0", step: "0.1", value: speechRate, onChange: handleSpeechRateChange, style: sliderStyle }), _jsxs("span", { style: speechRateValueStyle, children: [speechRate.toFixed(1), "\u500D"] })] }), _jsxs("div", { style: settingSectionStyle, children: [_jsx("h3", { style: settingSectionTitleStyle, children: "\u30A2\u30AB\u30A6\u30F3\u30C8" }), _jsx("p", { style: loginStatusStyle, children: loginStatus.isLoggedIn ? `ログイン中 (${loginStatus.isPremium ? 'プレミアム' : 'ゲスト'})` : 'ログアウト中' }), _jsx("button", { onClick: handleLoginLogout, style: buttonStyle, children: loginStatus.isLoggedIn ? 'ログアウト' : 'ログイン' }), loginStatus.isLoggedIn && (_jsx("button", { style: { ...buttonStyle, backgroundColor: '#87CEEB' }, children: "\u8CFC\u5165\u5C65\u6B74\u306E\u78BA\u8A8D" }))] }), _jsxs("div", { style: settingSectionStyle, children: [_jsx("h3", { style: settingSectionTitleStyle, children: "\u305D\u306E\u4ED6" }), _jsx("p", { children: _jsx("a", { href: "#", style: linkStyle, children: "\u304A\u554F\u3044\u5408\u308F\u305B" }) }), _jsx("p", { children: _jsx("a", { href: "#", style: linkStyle, children: "\u5229\u7528\u898F\u7D04 / \u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u30DD\u30EA\u30B7\u30FC" }) }), _jsx("p", { style: versionStyle, children: "\u30D0\u30FC\u30B8\u30E7\u30F3 1.0.0" })] }), _jsx("button", { onClick: onClose, style: { ...buttonStyle, backgroundColor: '#ccc', color: '#555', boxShadow: '0 4px #999', marginTop: '20px' }, children: "\u9589\u3058\u308B" })] }) }), showLoginModal && _jsx(Login, { onClose: () => setShowLoginModal(false), onLoginSuccess: handleLoginSuccess })] }));
};
// Styles (簡易的なフラットデザイン)
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
};
const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '25px',
    borderRadius: '15px',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    maxWidth: '500px',
    width: '90%',
    textAlign: 'center',
    fontFamily: "'Zen Maru Gothic', sans-serif",
    maxHeight: '90vh',
    overflowY: 'auto',
};
const modalTitleStyle = {
    color: '#4682B4',
    marginBottom: '25px',
    fontSize: '2em',
    fontWeight: 'bold',
};
const settingSectionStyle = {
    marginBottom: '25px',
    paddingBottom: '15px',
    borderBottom: '1px solid #eee',
};
const settingSectionTitleStyle = {
    color: '#555',
    fontSize: '1.4em',
    marginBottom: '10px',
};
const sliderStyle = {
    width: '80%',
    height: '8px',
    borderRadius: '5px',
    background: '#ddd',
    outline: 'none',
    'WebkitAppearance': 'none',
    appearance: 'none',
    marginTop: '10px',
    marginBottom: '5px',
};
const speechRateValueStyle = {
    fontSize: '1.1em',
    fontWeight: 'bold',
    color: '#4682B4',
    marginLeft: '10px',
};
const buttonStyle = {
    backgroundColor: '#FF69B4',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '1em',
    fontWeight: 'bold',
    margin: '8px',
    boxShadow: '0 4px #CD5C91',
    transition: 'background-color 0.2s, transform 0.1s ease-out',
};
const loginStatusStyle = {
    fontSize: '1em',
    color: '#333',
    marginBottom: '10px',
};
const linkStyle = {
    color: '#4682B4',
    textDecoration: 'none',
    margin: '5px 0',
    display: 'inline-block',
};
const versionStyle = {
    fontSize: '0.8em',
    color: '#999',
    marginTop: '15px',
};
export default Settings;
