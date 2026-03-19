import { keyframes } from 'styled-components';

// Basic animations - simplified
export const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

export const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
`;

export const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

export const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

export const clickEffect = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
  }
`;

export const selectedEffect = keyframes`
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
`;

// Model loading animations - simplified
export const modelLoadingAnimation = keyframes`
  0% { opacity: 0.8; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
`;

export const modelIconPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

export const loadingDotsAnimation = keyframes`
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
`;

export const moveGradient = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

export const panelPulseAnimation = keyframes`
  0% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0); }
`;

// Question button animations - simplified
export const questionButtonGlow = keyframes`
  0%, 100% {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    border-color: rgba(var(--model-color-rgb), 0.3);
  }
  50% {
    box-shadow: 0 0 8px rgba(var(--model-color-rgb), 0.6);
    border-color: rgba(var(--model-color-rgb), 0.6);
  }
`;

export const questionScaleEffect = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.99);
  }
`;

export const modelLoadComplete = keyframes`
  0% {
    filter: contrast(1.2) brightness(1.1);
  }
  50% {
    filter: contrast(1.3) brightness(1.3);
  }
  100% {
    filter: contrast(1) brightness(1);
  }
`;

// Synchronized animations - simplified
export const modelChangeWave = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
`;

export const colorTransition = keyframes`
  0%, 100% {
    filter: hue-rotate(0deg);
  }
  50% {
    filter: hue-rotate(15deg);
  }
`;

export const accentLineExpand = keyframes`
  0%, 100% {
    width: 4px;
  }
  50% {
    width: 6px;
  }
`;

// Skeleton to Content transition
export const skeletonToContent = keyframes`
  0% {
    opacity: 0;
    transform: translateY(10px);
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
`;
