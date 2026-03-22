import React from 'react';
interface LoginProps {
    onClose: () => void;
    onLoginSuccess: (isPremium: boolean) => void;
}
export declare const saveLoginStatus: (isLoggedIn: boolean, isPremium: boolean) => void;
export declare const getLoginStatus: () => {
    isLoggedIn: boolean;
    isPremium: boolean;
};
declare const Login: React.FC<LoginProps>;
export default Login;
