import React from 'react';
import WalkingAnimals from '../WalkingAnimals';
import { fonts } from '../../../styles/theme';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={footerStyle}>
      <WalkingAnimals size={40} gap={22} />
      <p style={copyrightStyle}>
        🌱 &copy; {currentYear} わたしはダレでしょう？クイズ 🌳
      </p>
    </footer>
  );
};

const footerStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(to bottom, #BFE8D4 0%, #8FD1AE 100%)',
  padding: '16px 0',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 'auto',
  borderTop: '3px solid #79BE9B',
  fontFamily: fonts.heading,
  zIndex: 10,
  position: 'relative',
  boxShadow: '0 -2px 8px rgba(74,68,88,0.08)',
};

const copyrightStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.05em',
  color: '#2E7D5C',
  fontWeight: 'bold',
  textShadow: '1px 1px 0px rgba(255,255,255,0.7)',
  letterSpacing: '1px',
};

export default Footer;
