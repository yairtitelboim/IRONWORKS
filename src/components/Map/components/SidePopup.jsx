import React from 'react';
import styled from 'styled-components';

const PopupContainer = styled.div`
  position: absolute;
  left: 10px;
  top: 10px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-height: 85vh;
  overflow-y: auto;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const PopupHeader = styled.div`
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 15px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
`;

const Subtitle = styled.div`
  margin-top: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 24px;
  padding: 0;
  line-height: 1;
  
  &:hover {
    color: #fff;
  }
`;

const Content = styled.div`
  h3 {
    color: #fff;
    font-size: 18px;
    font-weight: 500;
    margin: 0 0 15px 0;
  }

  div {
    margin-bottom: 16px;
  }
`;

export const SidePopup = ({ title, subtitle, children, onClose }) => {
  return (
    <PopupContainer>
      <CloseButton onClick={onClose}>&times;</CloseButton>
      <PopupHeader>
        <Title>{title}</Title>
        {subtitle && <Subtitle>{subtitle}</Subtitle>}
      </PopupHeader>
      <Content>
        {children}
      </Content>
    </PopupContainer>
  );
}; 