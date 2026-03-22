import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/common/Login/Login.tsx
import { useState } from 'react';
const PREMIUM_USER_EMAIL = 'test@example.com';
const LOCAL_STORAGE_LOGIN_STATUS_KEY = 'quizAppLoginStatus';
export const saveLoginStatus = (isLoggedIn, isPremium) => {
    if (typeof window === 'undefined')
        return;
    localStorage.setItem(LOCAL_STORAGE_LOGIN_STATUS_KEY, JSON.stringify({ isLoggedIn, isPremium }));
};
export const getLoginStatus = () => {
    if (typeof window === 'undefined')
        return { isLoggedIn: false, isPremium: false };
    const stored = localStorage.getItem(LOCAL_STORAGE_LOGIN_STATUS_KEY);
    return stored ? JSON.parse(stored) : { isLoggedIn: false, isPremium: false };
};
const Login = ({ onClose, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const handleLogin = () => {
        setError('');
        // 簡易的なログインロジック
        if (email === PREMIUM_USER_EMAIL && password === 'password') { // パスワードは仮
            saveLoginStatus(true, true);
            onLoginSuccess(true);
            onClose();
        }
        else if (email && password) { // ゲストログインをシミュレート
            saveLoginStatus(true, false);
            onLoginSuccess(false);
            onClose();
        }
        else {
            setError('メールアドレスとパスワードを入力してください。');
        }
    };
    return (_jsx("div", { style: modalOverlayStyle, children: _jsxs("div", { style: modalContentStyle, children: [_jsx("h2", { style: modalTitleStyle, children: "\u30ED\u30B0\u30A4\u30F3" }), _jsx("input", { type: "email", placeholder: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9", value: email, onChange: (e) => setEmail(e.target.value), style: inputStyle }), _jsx("input", { type: "password", placeholder: "\u30D1\u30B9\u30EF\u30FC\u30C9", value: password, onChange: (e) => setPassword(e.target.value), style: inputStyle }), error && _jsx("p", { style: errorStyle, children: error }), _jsx("button", { onClick: handleLogin, style: buttonStyle, children: "\u30ED\u30B0\u30A4\u30F3" }), _jsx("button", { onClick: onClose, style: { ...buttonStyle, backgroundColor: '#ccc' }, children: "\u30AD\u30E3\u30F3\u30BB\u30EB" })] }) }));
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
    padding: '30px',
    borderRadius: '15px',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
    fontFamily: "'Zen Maru Gothic', sans-serif",
};
const modalTitleStyle = {
    color: '#4682B4',
    marginBottom: '20px',
    fontSize: '1.8em',
    fontWeight: 'bold',
};
const inputStyle = {
    width: 'calc(100% - 20px)',
    padding: '12px 10px',
    margin: '10px 0',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontSize: '1em',
    boxSizing: 'border-box',
};
const buttonStyle = {
    backgroundColor: '#FF69B4',
    color: 'white',
    padding: '12px 25px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '1.1em',
    fontWeight: 'bold',
    margin: '10px 5px',
    boxShadow: '0 4px #CD5C91',
    transition: 'background-color 0.2s, transform 0.1s ease-out',
};
const errorStyle = {
    color: 'red',
    marginTop: '10px',
    fontSize: '0.9em',
};
export default Login;
