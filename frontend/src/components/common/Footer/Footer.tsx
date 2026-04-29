import React from 'react';
import WalkingAnimals from '../WalkingAnimals';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={footerStyle}>
      <WalkingAnimals />
      <p style={copyrightStyle}>
        🌱 &copy; {currentYear} わたしはダレでしょう？クイズ 🌳
      </p>
    </footer>
  );
};

const footerStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(to bottom, #A8E6CF 0%, #81C784 100%)',
  padding: '16px 0',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 'auto',
  borderTop: '4px dashed #66BB6A',
  fontFamily: "'Yomogi', cursive",
  zIndex: 10,
  position: 'relative',
  boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
};

const copyrightStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.05em',
  color: '#2E7D32',
  fontWeight: 'bold',
  textShadow: '1px 1px 0px rgba(255,255,255,0.7)',
  letterSpacing: '1px',
};

export default Footer;
