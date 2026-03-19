import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { MOBILE_CONFIG } from '../constants';
import { useSceneManager } from '../hooks/useSceneManager';
import { TRANSMISSION_CONFIG } from '../config/transmissionConfig';
import browserOptimizations from '../utils/browserOptimizations';
import PerformanceMonitor from '../utils/PerformanceMonitor';
import AnimationBatcher from '../utils/AnimationBatcher';
import ScenePopupManager from './ScenePopupManager';
import { getTexasCardsForScene } from './Cards/config/TexasCardConfig';
import sceneBackupManager from '../../../utils/sceneBackupManager';
import { loadDefaultScenes, forceLoadDefaultScenes } from '../../../utils/defaultScenes';
import { mapBus } from '../../../utils/mapBus';
import { fetchTexasDataCentersGeoJson } from '../../../utils/texasDataCentersDataset';
import MarketSignal from './marketSignal';
// Task animation CSS
const taskAnimationStyles = `
  @keyframes iconPulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.2); opacity: 1; }
  }

  @keyframes iconSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes iconGlow {
    0%, 100% { text-shadow: 0 0 5px rgba(76, 175, 80, 0.8); }
    50% { text-shadow: 0 0 15px rgba(76, 175, 80, 1), 0 0 20px rgba(76, 175, 80, 0.6); }
  }

  @keyframes iconMystical {
    0% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }

  @keyframes taskBarSlideIn {
    0% { transform: translateY(-10px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  @keyframes taskBarSlideOut {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-10px); opacity: 0; }
  }
`;

// Inject task animation styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = taskAnimationStyles;
  if (!document.head.querySelector('style[data-task-animations]')) {
    styleElement.setAttribute('data-task-animations', 'true');
    document.head.appendChild(styleElement);
  }
}

// Animated Icon Component
const AnimatedIcon = ({ icon, animationType, isActive, isCompleted, opacity = 1 }) => {
  const getAnimationStyle = () => {
    if (isCompleted) return { opacity: 0.6, filter: 'brightness(0.8)' };
    if (isActive) return { animation: `${animationType} 1s ease-in-out infinite` };
    return { opacity: 0.4 };
  };
  
  return (
    <span style={{
      fontSize: '14px',
      color: '#4caf50',
      filter: 'brightness(1.2) contrast(1.1)',
      textShadow: isActive ? '0 0 6px rgba(76, 175, 80, 0.8)' : '0 0 2px rgba(76, 175, 80, 0.4)',
      opacity: opacity,
      transition: 'opacity 0.3s ease',
      ...getAnimationStyle()
    }}>
      {icon}
    </span>
  );
};

// Task Animation Component
const TaskAnimation = ({ workflow, isVisible, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [animationSequence, setAnimationSequence] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [containerHeight, setContainerHeight] = useState(40);

  // Generate task sequence based on workflow complexity
  const getAnimationSequence = (workflow) => {
    const sequences = {
      simple: [
        { text: "Init analyzer", icon: "○", animation: "iconPulse", duration: 0.8 },
        { text: "Load layers", icon: "↻", animation: "iconSpin", duration: 1.2 },
        { text: "Sync data", icon: "⚙", animation: "iconGlow", duration: 0.6 },
        { text: "Complete", icon: "✓", animation: "iconMystical", duration: 1.4 }
      ],
      complex: [
        { text: "Init analyzer", icon: "○", animation: "iconPulse", duration: 0.8 },
        { text: "Load layers", icon: "↻", animation: "iconSpin", duration: 1.2 },
        { text: "Process data", icon: "⚙", animation: "iconGlow", duration: 1.0 },
        { text: "Validate", icon: "▲", animation: "iconPulse", duration: 0.9 },
        { text: "Optimize", icon: "◆", animation: "iconSpin", duration: 1.1 },
        { text: "Sync", icon: "●", animation: "iconGlow", duration: 0.7 },
        { text: "Complete", icon: "✓", animation: "iconMystical", duration: 1.4 }
      ]
    };
    
    // Use complex sequence for workflows with multiple scenes
    const isComplex = workflow.scenes && workflow.scenes.length > 3;
    return sequences[isComplex ? 'complex' : 'simple'];
  };

  // Play animation sequence
  const playAnimation = useCallback(() => {
    if (!isVisible || isAnimating) return;
    
    setIsAnimating(true);
    const sequence = getAnimationSequence(workflow);
    setAnimationSequence(sequence);
    
    const totalStepDuration = 4000; // 4 seconds total
    const totalSequenceDuration = sequence.reduce((sum, step) => sum + step.duration, 0);
    const timeScale = totalStepDuration / totalSequenceDuration;
    
    let cumulativeTime = 0;
    
    sequence.forEach((step, index) => {
      const stepDuration = step.duration * timeScale;
      
      setTimeout(() => {
        setCurrentStep(index);
        
        // Dynamically adjust container height based on current step
        const stepHeight = 32; // Height of each step (24px + 8px padding)
        const gapHeight = 4; // Gap between steps
        const baseHeight = 40; // Base container height
        const newHeight = baseHeight + (index * (stepHeight + gapHeight)) + 16; // Add extra padding
        setContainerHeight(newHeight);
        
        // Step completion animation
      setTimeout(() => {
          setCompletedSteps(prev => [...prev, index]);
        }, stepDuration - 200);
        
      }, cumulativeTime);
      
      cumulativeTime += stepDuration;
    });
    
    // Complete animation and call onComplete
    setTimeout(() => {
      setIsAnimating(false);
      setCurrentStep(0);
      setCompletedSteps([]);
      setContainerHeight(40); // Reset to initial height
      onComplete();
    }, totalStepDuration);
  }, [workflow, isVisible, isAnimating, onComplete]);

  // Start animation when component becomes visible
  useEffect(() => {
    if (isVisible && !isAnimating) {
      // Set initial height based on sequence length
      const sequence = getAnimationSequence(workflow);
      const initialHeight = 40 + (sequence.length * 36) + 16; // Account for all steps
      setContainerHeight(initialHeight);
      playAnimation();
    }
  }, [isVisible, playAnimation, workflow]);

  if (!isVisible) return null;

  return (
    <div style={{
      marginLeft: '20px',
      marginRight: '20px',
      padding: '8px 12px',
      backgroundColor: 'rgba(26, 26, 26, 0.95)',
      borderRadius: '8px',
      border: '1px solid #333333',
      animation: 'taskBarSlideIn 0.3s ease-out',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
      position: 'relative',
      marginTop: '8px',
      marginBottom: '8px',
      minWidth: '336px',
      maxWidth: '100%',
      minHeight: '40px',
      height: `${containerHeight}px`,
      overflow: 'hidden',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Connection line to parent element */}
      <div style={{
        position: 'absolute',
        top: '-12px',
        left: '20px',
        width: '2px',
        height: '12px',
        backgroundColor: '#4caf50',
        borderRadius: '1px',
        boxShadow: '0 0 4px rgba(76, 175, 80, 0.6)'
      }} />
      
      {/* Task steps container */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '4px', 
        alignItems: 'flex-start',
        minHeight: '24px',
        height: 'auto',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: 1
      }}>
        {animationSequence.map((step, index) => {
          // Calculate opacity based on step state
          let stepOpacity = 0.1; // Very transparent for future steps
          let textOpacity = 0.3;
          let iconOpacity = 0.2;
          
          if (completedSteps.includes(index)) {
            // Completed steps - slightly faded
            stepOpacity = 0.6;
            textOpacity = 0.5;
            iconOpacity = 0.4;
          } else if (currentStep === index) {
            // Active step - fully visible
            stepOpacity = 1;
            textOpacity = 1;
            iconOpacity = 1;
          } else if (index < currentStep) {
            // Past steps - medium visibility
            stepOpacity = 0.8;
            textOpacity = 0.7;
            iconOpacity = 0.6;
          }
          
          return (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: currentStep === index ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
              transition: 'all 0.3s ease',
              width: '100%',
              opacity: stepOpacity,
              transform: index < currentStep ? 'translateX(4px)' : 'translateX(0)'
            }}>
              <AnimatedIcon
                icon={step.icon}
                animationType={step.animation}
                isActive={currentStep === index}
                isCompleted={completedSteps.includes(index)}
                opacity={iconOpacity}
              />
              <span style={{
                fontSize: '11px',
                color: currentStep === index ? '#4caf50' : '#a8dab5',
                fontWeight: currentStep === index ? '600' : '400',
                opacity: textOpacity,
                transition: 'all 0.3s ease'
              }}>
                {step.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Add CSS keyframes for micro animations and panel morphing
const animationStyles = `
  @keyframes workflowFadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes workflowPulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
  }
  
  @keyframes workflowClickPulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.98);
    }
    100% {
      transform: scale(1);
    }
  }
  
  @keyframes workflowPopupNavigate {
    0% {
      transform: scale(1);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    25% {
      transform: scale(1.08) translateY(-4px);
      box-shadow: 0 12px 30px rgba(76, 175, 80, 0.4), 0 6px 20px rgba(76, 175, 80, 0.3);
    }
    50% {
      transform: scale(1.05) translateY(-3px);
      box-shadow: 0 8px 25px rgba(76, 175, 80, 0.5), 0 4px 15px rgba(76, 175, 80, 0.3);
    }
    100% {
      transform: scale(1.05) translateY(-3px);
      box-shadow: 0 8px 25px rgba(76, 175, 80, 0.5), 0 4px 15px rgba(76, 175, 80, 0.3);
    }
  }
  
  @keyframes workflowShimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  @keyframes panelRollOpen {
    0% {
      width: 41px;
      height: 41px;
      border-radius: 20px;
      opacity: 0.7;
      transform: scale(1.2);
    }
    25% {
      width: 100px;
      height: 70px;
      border-radius: 18px;
      opacity: 0.8;
      transform: scale(1.15);
    }
    50% {
      width: 200px;
      height: 200px;
      border-radius: 16px;
      opacity: 0.85;
      transform: scale(1.08);
    }
    75% {
      width: 21.6%;
      height: 400px;
      border-radius: 13px;
      opacity: 0.92;
      transform: scale(1.03);
    }
    90% {
      width: 25.2%;
      height: calc(100vh - 50px);
      border-radius: 11px;
      opacity: 0.97;
      transform: scale(1.01);
    }
    100% {
      width: 27%;
      height: calc(100vh - 40px);
      border-radius: 10px;
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes contentFadeIn {
    0% {
      opacity: 0;
      transform: translateY(-8px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = animationStyles;
  if (!document.head.querySelector('style[data-workflow-animations]')) {
    styleElement.setAttribute('data-workflow-animations', 'true');
    document.head.appendChild(styleElement);
  }
}

// Styled components for the navigator with roll-open animation
const NavContainer = ({ isOpen, isAnimating, isMorphing, children }) => {
  // Base styles that don't interfere with animation
  const baseStyle = {
    position: 'fixed',
    top: 20,
    left: 10,
    background: '#1a1a1a',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)',
    border: '1px solid #333333',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  if (isMorphing && isOpen) {
    // During morphing animation - let CSS animation handle everything
    return (
      <div 
        style={{
          ...baseStyle,
          animation: 'panelRollOpen 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          // Start from button size
          width: 41,
          height: 41,
          borderRadius: 20,
          opacity: 0.8,
          transform: 'scale(1.1)'
        }}
      >
        {children}
      </div>
    );
  } else if (isOpen) {
    // Fully opened state (panel width 27% - keep left/width in sync for slide)
    return (
      <div 
        style={{
          ...baseStyle,
          width: '27%',
          height: 'calc(100vh - 40px)',
          borderRadius: 10,
          opacity: 1,
          transform: isAnimating ? 'scale(1.01)' : 'scale(1)',
          transition: 'all 0.3s ease'
        }}
      >
        {children}
      </div>
    );
  } else {
    // Closed state (off-screen): left must match negative width to avoid jump
    return (
      <div 
        style={{
          ...baseStyle,
          left: '-27%',
          width: '27%',
          height: 'calc(100vh - 40px)',
          borderRadius: 10,
          opacity: 1,
          transform: 'scale(1)',
          transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        {children}
      </div>
    );
  }
};

const NavHeader = ({ title, subtitle, onClose, isCollapsed, onToggleCollapse, showTitle = true }) => {
  // Dual-styling: split on " (" so version can be muted (e.g. "Kyudo AI - Constraint Builder (v.2.10)")
  const parts = (title || '').split(' (');
  const mainTitle = parts[0] || title;
  const versionPart = parts.length > 1 ? `(${parts.slice(1).join(' (')}` : null;

  return (
    <div style={{
      padding: '17px 20px',
      paddingTop: 20,
      minHeight: 80,
      borderBottom: '1px solid #333333',
      background: '#1f1f1f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <h3 style={{
          margin: 0,
          color: '#ffffff',
          fontSize: 34,
          fontWeight: 900,
          fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
          letterSpacing: '-0.25px',
          lineHeight: 1.2,
          opacity: showTitle ? 1 : 0,
          transition: 'opacity 0.4s ease-out',
          transform: showTitle ? 'translateY(0)' : 'translateY(-8px)',
          animation: showTitle ? 'contentFadeIn 0.4s cubic-bezier(0.4, 0.0, 0.2, 1) forwards' : 'none'
        }}>
          {mainTitle}
          {versionPart && (
            <span style={{
              fontSize: 20,
              fontWeight: 400,
              color: '#9aa0a6'
            }}>
              {' '}{versionPart}
            </span>
          )}
        </h3>
        {subtitle && (
          <div style={{
            marginTop: 2,
            color: '#9aa0a6',
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif',
            whiteSpace: 'pre-line',
            opacity: showTitle ? 1 : 0,
            transition: 'opacity 0.4s ease-out',
            transform: showTitle ? 'translateY(0)' : 'translateY(-8px)',
            animation: showTitle ? 'contentFadeIn 0.4s cubic-bezier(0.4, 0.0, 0.2, 1) forwards' : 'none'
          }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9aa0a6',
            cursor: 'pointer',
            padding: '5px',
            borderRadius: '12px',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s ease',
            width: 19,
            height: 23
          }}
          onMouseEnter={(e) => e.target.style.background = '#333333'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const StatusBar = ({ status, isPlaying, showWelcome, showReadyPulse }) => (
  <div style={{
    padding: '10px 20px', // Reduced from 12px 24px
    background: isPlaying ? '#0d4f3c' : '#1f1f1f',
    borderBottom: '1px solid #333333',
    fontSize: 11, // Reduced from 13
    color: isPlaying ? '#4caf50' : '#9aa0a6',
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'Roboto, Arial, sans-serif',
    fontWeight: 400
  }}>
    {showWelcome ? (
      <div style={{
        background: '#0d4f3c',
        color: '#ffffff',
        fontWeight: 600,
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: 13,
        animation: 'welcomePulse 2s ease-in-out infinite',
        border: '1px solid #4caf50'
      }}>
        Welcome to Transmission System Planner!
      </div>
    ) : (
      <>
        {isPlaying && <span style={{ marginRight: 8, fontSize: 14 }}>⏳</span>}
        {status || (isPlaying ? 'Loading scene...' : (
          <span style={{
            color: showReadyPulse ? '#4caf50' : '#9aa0a6',
            animation: showReadyPulse ? 'readyPulse 0.8s ease-in-out infinite' : 'none',
            fontWeight: showReadyPulse ? 600 : 400
          }}>
            Ready
          </span>
        ))}
      </>
    )}
  </div>
);

const SectionHeader = ({ title, icon, count, isExpanded, onToggle, animationDelay = 0, isAnimating }) => {
  const [hasAnimated, setHasAnimated] = React.useState(false);
  
  React.useEffect(() => {
    if (isAnimating && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, animationDelay);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, animationDelay, hasAnimated]);

  return (
    <div 
      onClick={onToggle}
      style={{
        padding: '20px 20px', // Reduced from 16px 24px
        background: '#1f1f1f',
        borderBottom: '0.1px solid #333333',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1)',
        opacity: isAnimating ? (hasAnimated ? 1 : 0) : 1,
        transform: isAnimating ? (hasAnimated ? 'translateX(0)' : 'translateX(-20px)') : 'translateX(0)'
      }}
      onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
      onMouseLeave={(e) => e.target.style.backgroundColor = '#1f1f1f'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{icon}</span>
        <span style={{ 
          color: '#ffffff', 
          fontSize: 13, // Reduced from 15
          fontWeight: 500,
          fontFamily: 'Roboto, Arial, sans-serif',
          letterSpacing: '0.1px'
        }}>
          {title}
        </span>
        {count > 0 && (
          <span style={{
            background: '#333333',
            color: '#ffffff',
            fontSize: 9, // Reduced from 11
            padding: '3px 7px', // Reduced from 4px 8px
            borderRadius: 10, // Reduced from 12
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif'
          }}>
            {count}
          </span>
        )}
      </div>
      <span style={{ 
        color: '#9aa0a6', 
        fontSize: 12, // Reduced from 14
        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease'
      }}>
        ▶
      </span>
    </div>
  );
};

const SceneTemplateCard = ({ template, onApply }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isClicked, setIsClicked] = React.useState(false);

  return (
    <div 
      onClick={() => {
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 100);
        onApply(template);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        margin: '7px 20px', // Reduced from 8px 24px
        padding: '14px', // Reduced from 16px
        background: isHovered ? '#333333' : '#2a2a2a',
        borderRadius: 7, // Reduced from 8
        border: `1px solid ${isHovered ? '#5f6368' : '#3c3c3c'}`,
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: isHovered 
          ? '0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.1)' 
          : '0 1px 3px rgba(0,0,0,0.2)',
        transform: isClicked 
          ? 'scale(0.98) translateY(1px)' 
          : isHovered 
            ? 'scale(1.01) translateY(-1px)' 
            : 'scale(1) translateY(0)',
        filter: isHovered ? 'brightness(1.05)' : 'brightness(1)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ 
        color: '#ffffff', 
        fontSize: 12, // Reduced from 14
        fontWeight: 500,
        marginBottom: 5, // Reduced from 6
        fontFamily: 'Roboto, Arial, sans-serif',
        letterSpacing: '0.1px',
        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
        transition: 'transform 0.2s ease'
      }}>
        {template.name}
      </div>
      <div style={{ 
        color: '#9aa0a6', 
        fontSize: 10, // Reduced from 12
        lineHeight: 1.4,
        fontFamily: 'Roboto, Arial, sans-serif',
        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
        transition: 'transform 0.2s ease 0.05s'
      }}>
        {template.description}
      </div>
    </div>
  );
};

const SceneCard = ({ scene, onPlay, onUpdate, onDelete, onEdit, isEditing, editName, setEditName }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isClicked, setIsClicked] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  const handlePlay = () => {
    if (isTransitioning) return; // Prevent rapid clicking
    
    setIsTransitioning(true);
    setIsClicked(true);
    
    setTimeout(() => setIsClicked(false), 100);
    
    try {
      onPlay(scene.id);
    } catch (error) {
      console.error('Error playing scene:', error);
    } finally {
      // Reset transition state after a delay
      setTimeout(() => setIsTransitioning(false), 1000);
    }
  };

  return (
    <div 
      onClick={() => {
        if (!isEditing && !isTransitioning) {
          handlePlay();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        margin: '3px 20px', // Reduced from 4px 24px
        padding: '10px 14px', // Reduced from 12px 16px
        background: isHovered ? '#333333' : '#2a2a2a',
        borderRadius: 7, // Reduced from 8
        border: '1px solid #3c3c3c',
        boxShadow: isHovered 
          ? '0 4px 12px rgba(0,0,0,0.3)' 
          : '0 1px 3px rgba(0,0,0,0.2)',
        cursor: isEditing || isTransitioning ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        transform: isClicked ? 'scale(0.98)' : 'scale(1)',
        opacity: isTransitioning ? 0.7 : 1
      }}>
    {isEditing ? (
      <input
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onEdit(editName);
          }
        }}
        onBlur={() => onEdit(editName)}
        style={{
          background: '#1f1f1f',
          border: '1px solid #1a73e8',
          borderRadius: 4,
          color: '#ffffff',
          fontSize: 13,
          padding: '8px 12px',
          width: '100%',
          fontFamily: 'Roboto, Arial, sans-serif',
          outline: 'none'
        }}
        autoFocus
      />
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            color: '#ffffff', 
            fontSize: 11, // Reduced from 13
            fontWeight: 500,
            marginBottom: 3, // Reduced from 4
            fontFamily: 'Roboto, Arial, sans-serif',
            letterSpacing: '0.1px'
          }}>
            {scene.name}
          </div>
          <div style={{ 
            color: '#9aa0a6', 
            fontSize: 9, // Reduced from 11
            fontFamily: 'Roboto, Arial, sans-serif'
          }}>
            {new Date(scene.timestamp).toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isTransitioning) {
                handlePlay();
              }
            }}
            disabled={isTransitioning}
            style={{
              background: isTransitioning ? '#5f6368' : '#1a73e8',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              cursor: isTransitioning ? 'not-allowed' : 'pointer',
              fontSize: 9, // Reduced from 10
              padding: '7px', // Reduced from 8px
              width: 24, // Reduced from 28
              height: 24, // Reduced from 28
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
              opacity: isTransitioning ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isTransitioning) {
                e.target.style.background = '#1557b0';
              }
            }}
            onMouseLeave={(e) => {
              if (!isTransitioning) {
                e.target.style.background = '#1a73e8';
              }
            }}
          >
            {isTransitioning ? '⏳' : '▶'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(scene.id);
            }}
            style={{
              background: '#34a853',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              cursor: 'pointer',
              fontSize: 10, // Reduced from 12
              padding: '7px', // Reduced from 8px
              width: 24, // Reduced from 28
              height: 24, // Reduced from 28
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = '#2d8f43'}
            onMouseLeave={(e) => e.target.style.background = '#34a853'}
          >
            ↻
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(scene.id);
            }}
            style={{
              background: '#ea4335',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              cursor: 'pointer',
              fontSize: 10, // Reduced from 12
              padding: '7px', // Reduced from 8px
              width: 24, // Reduced from 28
              height: 24, // Reduced from 28
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = '#c5221f'}
            onMouseLeave={(e) => e.target.style.background = '#ea4335'}
          >
            ✕
          </button>
        </div>
      </div>
    )}
  </div>
  );
};

const WorkflowCard = ({ workflow, onPlay, scenes, workflowIndex, onTaskAnimationStart, onTaskAnimationComplete, activeSceneId, isNavigatingFromPopup = false, isAnimationRunning = false }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isClicked, setIsClicked] = React.useState(false);
  const [showTaskAnimation, setShowTaskAnimation] = React.useState(false);

  // Get the corresponding saved scene for this workflow
  const correspondingScene = scenes && scenes.length > workflowIndex && workflowIndex >= 0 ? scenes[workflowIndex] : null;

  // Determine if this card is active (red theme for first card, yellow for second and fifth cards)
  const isFirstCard = workflowIndex === 0;
  const isSecondCard = workflowIndex === 1;
  const isFifthCard = workflowIndex === 4;
  const expectedSceneId = correspondingScene?.id;
  const isActiveFirstCard = isFirstCard && activeSceneId === expectedSceneId;
  const isActiveSecondCard = isSecondCard && activeSceneId === expectedSceneId;
  const isActiveFifthCard = isFifthCard && activeSceneId === expectedSceneId;
  
  // Debug logging for the first, second, and fifth cards
  
  
  // Determine if this card should be disabled (when animation is running on another card)
  // The clicked card should remain active and not disabled
  const isDisabled = isAnimationRunning && !isClicked;
  
  // Color logic: red for first card, yellow for second and fifth cards, green for others
  let primaryColor, primaryColorRgba, backgroundColor, hoverBackgroundColor, textColor, descriptionColor;
  
  if (isDisabled) {
    // Brighter gray theme for disabled cards
    primaryColor = '#999999';
    primaryColorRgba = '153, 153, 153';
    backgroundColor = '#2a2a2a';
    hoverBackgroundColor = '#2a2a2a';
    textColor = '#999999';
    descriptionColor = '#999999';
  } else if (isActiveFirstCard) {
    // Red theme for first card
    primaryColor = '#dc2626';
    primaryColorRgba = '220, 38, 38';
    backgroundColor = '#4f1d1d';
    hoverBackgroundColor = '#5f2323';
    textColor = '#dc2626';
    descriptionColor = '#f5b2b2';
  } else if (isActiveSecondCard || isActiveFifthCard) {
    // Yellow theme for second and fifth cards
    primaryColor = '#f59e0b';
    primaryColorRgba = '245, 158, 11';
    backgroundColor = '#4f3d1d';
    hoverBackgroundColor = '#5f4a23';
    textColor = '#f59e0b';
    descriptionColor = '#fef3c7';
  } else {
    // Gray/white dark theme for all other cards
    primaryColor = '#ffffff';
    primaryColorRgba = '255, 255, 255';
    backgroundColor = '#2a2a2a';
    hoverBackgroundColor = '#333333';
    textColor = '#ffffff';
    descriptionColor = '#a8dab5';
  }

  const handleClick = () => {
        setIsClicked(true);
        // Keep isClicked true for the duration of the animation (4 seconds)
        setTimeout(() => setIsClicked(false), 4000);
    
    // Start task animation
    setShowTaskAnimation(true);
    onTaskAnimationStart(workflow);
    
    // Call original onPlay after a short delay
    setTimeout(() => {
        onPlay(workflow);
    }, 500);
  };

  const handleTaskAnimationComplete = () => {
    setShowTaskAnimation(false);
    onTaskAnimationComplete();
  };

  return (
    <>
      <div 
        onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        margin: '7px 20px', // Increased from 3px for more gap between cards
        padding: '10px', // Reduced from 12px
        backgroundColor: isHovered ? hoverBackgroundColor : backgroundColor,
        borderRadius: 7, // Reduced from 8
        border: `0.001px solid ${primaryColor}`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        pointerEvents: isDisabled ? 'none' : 'auto',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: isHovered 
          ? `0 8px 25px rgba(${primaryColorRgba}, 0.3), 0 3px 10px rgba(0,0,0,0.2)` 
          : isNavigatingFromPopup
            ? `0 8px 25px rgba(${primaryColorRgba}, 0.5), 0 4px 15px rgba(${primaryColorRgba}, 0.3)`
            : '0 1px 3px rgba(0,0,0,0.2)',
        transform: isClicked 
          ? 'scale(0.98) translateY(2px)' 
          : isHovered 
            ? 'scale(1.02) translateY(-2px)' 
            : isNavigatingFromPopup
              ? 'scale(1.05) translateY(-3px)'
              : 'scale(1) translateY(0)',
        animation: isClicked ? 'workflowClickPulse 0.15s ease-out' : isNavigatingFromPopup ? 'workflowPopupNavigate 0.5s ease-out' : 'none',
        filter: isDisabled ? 'brightness(0.7)' : isHovered ? 'brightness(1.1)' : isNavigatingFromPopup ? 'brightness(1.2)' : 'brightness(1)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: isHovered ? '100%' : '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          transition: 'left 0.5s'
        },
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Add shimmer effect overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: isHovered ? '100%' : '-100%',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        transition: 'left 0.5s ease',
        pointerEvents: 'none'
      }} />
      
      {/* Linked badge in top right corner */}
      {correspondingScene && (
        <div style={{
          position: 'absolute',
          top: 7, // Reduced from 8
          right: 7, // Reduced from 8
          background: '#2a2a2a',
          border: '1px solid #5f6368',
          color: '#9aa0a6',
          fontSize: 7, // Reduced from 8
          padding: '2px 4px', // Reduced from 2px 5px
          borderRadius: 3, // Reduced from 4
          fontWeight: 500,
          fontFamily: 'Roboto, Arial, sans-serif',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          zIndex: 10
        }}>
          LINKED
        </div>
      )}
      
      <div style={{ 
        color: textColor, 
        fontSize: 12, // Reduced from 14
        fontWeight: 700,
        marginBottom: 3, // Reduced from 4
        display: 'flex',
        alignItems: 'center',
        gap: 5, // Reduced from 6
        fontFamily: 'Roboto, Arial, sans-serif',
        letterSpacing: '0.1px',
        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
        transition: 'transform 0.2s ease'
      }}>
        {workflow.name}
      </div>
      <div style={{ 
        color: descriptionColor, 
        fontSize: 10, // Reduced from 12
        lineHeight: 1.3,
        marginBottom: 3, // Reduced from 4
        fontFamily: 'Roboto, Arial, sans-serif',
        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
        transition: 'transform 0.2s ease 0.05s'
      }}>
        {workflow.description}
      </div>
      <div style={{ 
        color: '#9aa0a6', 
        fontSize: 9, // Reduced from 11
          lineHeight: 1.2,
        fontFamily: 'Roboto, Arial, sans-serif',
        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
        transition: 'transform 0.2s ease 0.1s'
      }}>
          {workflow.scenes ? `${workflow.scenes.length} scenes` : 'Single scene'}
      </div>
    </div>
      
      {/* Task Animation */}
      {showTaskAnimation && (
        <TaskAnimation
          workflow={workflow}
          isVisible={showTaskAnimation}
          onComplete={handleTaskAnimationComplete}
        />
      )}
    </>
  );
};

const AITransmissionNav = ({ 
  map, 
  layerState, 
  onLoadScene, 
  isOpen = false, 
  onClose,
  onToggle 
}) => {
  const isMobile = useIsMobile(MOBILE_CONFIG.breakpoint);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    marketSignal: false,
    dataCenters: false,
    templates: false,
    scenes: false,
    workflows: false,
    mcp: false
  });
  const [newSceneName, setNewSceneName] = useState('');
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [editSceneName, setEditSceneName] = useState('');
  const [playingWorkflow, setPlayingWorkflow] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(true);
  const [showReadyPulse, setShowReadyPulse] = useState(false);
  const [autoHover, setAutoHover] = useState(false);
  const [useSimpleMode, setUseSimpleMode] = useState(false);
  const [activePopupCards, setActivePopupCards] = useState([]);
  const [playingSceneId, setPlayingSceneId] = useState(null);
  const [navigatingFromPopup, setNavigatingFromPopup] = useState(null);
  const [isTaskAnimationRunning, setIsTaskAnimationRunning] = useState(false);
  const [dataCenterProjects, setDataCenterProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Daily motion: market (news) vs grid (ERCOT) summary
  const [dailyMotion, setDailyMotion] = useState({
    updatedAt: null,
    market: { count7d: 0, top: [], lastIngestedAt: null },
    grid: { newCount: 0, updatedCount: 0, lastIngestedAt: null }
  });
  const [dailyMotionLoading, setDailyMotionLoading] = useState(false);
  const [dailyMotionError, setDailyMotionError] = useState(null);

  const workflowTimeoutRef = useRef(null);
  const autoHoverRef = useRef(null);
  const tableRowRefs = useRef({});

  // Initialize performance monitoring
  useEffect(() => {
    // Initialize performance monitoring with browser-specific settings
    const settings = browserOptimizations.getAnimationSettings();
    
    PerformanceMonitor.start();
    
    // Configure AnimationBatcher with browser-specific settings
    AnimationBatcher.configure({
      batchSize: settings.batchSize,
      batchDelay: settings.batchDelay,
      staggerDelay: settings.staggerDelay
    });
    
    
    

    // Check for reduced motion preference or very low memory devices
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldUseSimpleMode = prefersReducedMotion || browserOptimizations.shouldDisableUIAnimations();
    setUseSimpleMode(shouldUseSimpleMode);
    
    

    // Listen for memory pressure events (Chrome-specific)
    const handleMemoryPressure = (event) => {
      const { severity } = event.detail;
      console.warn(`🚨 Memory pressure detected: ${severity}`);
      
      if (severity === 'critical') {
        // Stop all animations and switch to simple mode
        setUseSimpleMode(true);
        setIsAnimating(false);
        AnimationBatcher.clear();
        
        // Force garbage collection
        browserOptimizations.forceGarbageCollection();
      }
    };
    
    window.addEventListener('memoryPressure', handleMemoryPressure);

    return () => {
      PerformanceMonitor.stop();
      AnimationBatcher.clear();
      window.removeEventListener('memoryPressure', handleMemoryPressure);
    };
  }, []);

  // Auto-hover with browser optimizations
  useEffect(() => {
    if (!isOpen || useSimpleMode || !map?.current) return;
    
    const settings = browserOptimizations.getAnimationSettings();
    const hoverDelay = browserOptimizations.isChrome ? 500 : 300; // Longer delay for Chrome
    const intervalDelay = browserOptimizations.isChrome ? 4000 : 3000; // Less frequent in Chrome

    const autoHoverRef = setInterval(() => {
      // Check performance before starting auto-hover
      const currentFPS = PerformanceMonitor.getCurrentFPS();
      if (browserOptimizations.shouldReduceAnimations(currentFPS)) {
        return; // Skip auto-hover if performance is poor
      }

      AnimationBatcher.add(() => {
        setAutoHover(true);
      });
      
      setTimeout(() => {
        AnimationBatcher.add(() => {
          setAutoHover(false);
        });
      }, hoverDelay);
    }, intervalDelay);

    return () => {
      clearInterval(autoHoverRef);
    };
  }, [isOpen, useSimpleMode, map]);

  const fetchDailyMotion = useCallback(async () => {
    setDailyMotionLoading(true);
    setDailyMotionError(null);

    const parseDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    try {
      const [newsRes, ercotRes] = await Promise.all([
        fetch('/api/scanner/signals?source_type=TAVILY&limit=200'),
        fetch('/api/scanner/signals?source_type=ERCOT_QUEUE&limit=500')
      ]);

      if (!newsRes.ok) throw new Error(`NEWS signals error (${newsRes.status})`);
      if (!ercotRes.ok) throw new Error(`ERCOT signals error (${ercotRes.status})`);

      const newsData = await newsRes.json();
      const ercotData = await ercotRes.json();

      const now = Date.now();
      const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

      const newsSignals = Array.isArray(newsData?.signals) ? newsData.signals : [];
      const recentNews = newsSignals
        .filter((s) => {
          const ing = parseDate(s.ingested_at)?.getTime();
          const pub = parseDate(s.published_at)?.getTime();
          const t = Number.isFinite(pub) ? pub : ing;
          return Number.isFinite(t) && t >= cutoff7d;
        })
        .sort((a, b) => {
          const ta = parseDate(a.published_at)?.getTime() ?? parseDate(a.ingested_at)?.getTime() ?? 0;
          const tb = parseDate(b.published_at)?.getTime() ?? parseDate(b.ingested_at)?.getTime() ?? 0;
          return tb - ta;
        });

      const topNews = recentNews.slice(0, 3).map((s) => ({
        signal_id: s.signal_id,
        headline: s.headline || s.source_name || s.url || 'News item',
        url: s.url || null,
        published_at: s.published_at || s.ingested_at || null
      }));

      const lastNewsIngestedAt = newsSignals[0]?.ingested_at || null;

      const ercotSignals = Array.isArray(ercotData?.signals) ? ercotData.signals : [];
      const newCount = ercotSignals.filter((s) => s.status === 'NEW' && (s.change_type === 'NEW' || s.change_type === 'ADDED' || !s.change_type)).length;
      const updatedCount = ercotSignals.filter((s) => s.change_type && String(s.change_type).toUpperCase() === 'UPDATED').length;
      const lastErcotIngestedAt = ercotSignals[0]?.ingested_at || null;

      setDailyMotion({
        updatedAt: new Date().toISOString(),
        market: {
          count7d: recentNews.length,
          top: topNews,
          lastIngestedAt: lastNewsIngestedAt
        },
        grid: {
          newCount,
          updatedCount,
          lastIngestedAt: lastErcotIngestedAt
        }
      });
    } catch (error) {
      console.error('[DailyMotion] fetch failed', error);
      setDailyMotionError(error.message || 'Failed to load daily motion');
    } finally {
      setDailyMotionLoading(false);
    }
  }, []);

  const handleRefreshMarket = useCallback(async () => {
    try {
      await fetch('/api/scanner/ingest/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '"data center" (moratorium OR lawsuit OR zoning) Texas',
          days: 7
        })
      });
    } finally {
      await fetchDailyMotion();
    }
  }, [fetchDailyMotion]);

  const handleRefreshGrid = useCallback(async () => {
    try {
      await fetch('/api/scanner/ingest/ercot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useGisReports: true, downloadFresh: true })
      });
    } finally {
      await fetchDailyMotion();
    }
  }, [fetchDailyMotion]);

  useEffect(() => {
    if (!isOpen || isCollapsed) return;
    fetchDailyMotion();
  }, [fetchDailyMotion, isOpen, isCollapsed]);

  // Use the generic scene manager hook
  const {
    scenes,
    status,
    isPlaying,
    captureScene,
    playScene,
    updateScene,
    deleteScene,
    loadSceneByName,
    exportScenes,
    importScenes,
    cleanup: cleanupScenes
  } = useSceneManager(map?.current, layerState, {
    storageKey: TRANSMISSION_CONFIG.storageKey,
    onLoadScene,
    // Custom state capture for transmission-specific data
    captureAdditionalState: () => ({
      transmissionFocus: true,
      analysisType: 'transmission',
      timestamp: Date.now()
    }),
    // Custom state restoration
    
  });

  // Expose scene control to AI chat via global methods
  useEffect(() => {
    if (!window.mapComponent) {
      window.mapComponent = {};
    }
    
    // Enhanced scene control for AI
    window.mapComponent.transmissionNav = {
      loadScene: loadSceneByName,
      applyTemplate: (templateName) => {
        const template = TRANSMISSION_CONFIG.sceneTemplates[templateName.toUpperCase()];
        if (template && onLoadScene) {
          onLoadScene(template.layerState);
          // Also apply camera if available
          if (map?.current && template.camera) {
            map.current.easeTo({
              center: [template.camera.center.lng, template.camera.center.lat],
              zoom: template.camera.zoom,
              pitch: template.camera.pitch,
              bearing: template.camera.bearing,
              duration: 1500
            });
          }
          return true;
        }
        return false;
      },
      runWorkflow: (workflowName) => {
        const workflow = TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.find(
          w => w.name.toLowerCase().includes(workflowName.toLowerCase())
        );
        if (workflow) {
          playWorkflow(workflow);
          return true;
        }
        return false;
      },
      getScenes: () => scenes,
      getTemplates: () => Object.keys(TRANSMISSION_CONFIG.sceneTemplates),
      getWorkflows: () => TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.map(w => w.name)
    };
    
    // Add card system methods
    window.mapComponent.cards = {
      showCards: (sceneId) => {
        // Import the card function dynamically to avoid circular dependencies
        import('./Cards/config/TexasCardConfig').then(({ getTexasCardsForScene }) => {
          const cards = getTexasCardsForScene(sceneId);
          // Emit event for main map component to show cards
          window.mapEventBus.emit('cards:show', { sceneId, cards });
        });
      },
      hideCards: () => {
        window.mapEventBus.emit('cards:hide');
      },
      getAvailableScenes: () => ['scene-0', 'scene-1', 'scene-2', 'scene-3', 'scene-4']
    };
  }, [scenes, loadSceneByName, map, onLoadScene]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleApplyTemplate = (template) => {
    if (onLoadScene) {
      onLoadScene(template.layerState);
    }
    
    // Apply camera position if available
    if (map?.current && template.camera) {
      map.current.easeTo({
        center: [template.camera.center.lng, template.camera.center.lat],
        zoom: template.camera.zoom,
        pitch: template.camera.pitch,
        bearing: template.camera.bearing,
        duration: 1500
      });
    }
  };

  const handleCaptureScene = () => {
    if (newSceneName.trim()) {
      captureScene(newSceneName.trim());
      setNewSceneName('');
    }
  };

  const handleEditScene = (newName) => {
    if (editingSceneId && newName.trim()) {
      updateScene(editingSceneId, { name: newName.trim() });
    }
    setEditingSceneId(null);
    setEditSceneName('');
  };

  // Task animation handlers
  const handleTaskAnimationStart = useCallback((workflow) => {
    setIsTaskAnimationRunning(true);
    
  }, []);

  const handleTaskAnimationComplete = useCallback(() => {
    setIsTaskAnimationRunning(false);
    
  }, []);

  // Enhanced playScene with new card system integration
  const playSceneWithCards = useCallback(async (sceneId) => {
    
    // Clear existing popup cards
    setActivePopupCards([]);
    setPlayingSceneId(sceneId);
    
    // Play the scene using the original function
    const success = await playScene(sceneId);
    
    if (success) {
      // Find the scene to get its name for card lookup
      const scene = scenes.find(s => s.id === sceneId);
      if (scene) {
        // Find the scene index (workflow index) for card mapping
        const sceneIndex = scenes.findIndex(s => s.id === sceneId);
        
        // Use the new Texas card system
        let dynamicCards = null;
        
        // Strategy 1: Use scene index (scene-0, scene-1, etc.)
        if (sceneIndex >= 0) {
          dynamicCards = getTexasCardsForScene(`scene-${sceneIndex}`);
        }
        
        // Strategy 2: Use scene name as key
        if (!dynamicCards || dynamicCards.length === 0) {
          dynamicCards = getTexasCardsForScene(scene.name);
        }
        
        // Strategy 3: Use scene ID
        if (!dynamicCards || dynamicCards.length === 0) {
          dynamicCards = getTexasCardsForScene(sceneId);
        }
        
        // Strategy 4: Try common scene name patterns
        if (!dynamicCards || dynamicCards.length === 0) {
          const sceneName = scene.name.toLowerCase().replace(/\s+/g, '-');
          dynamicCards = getTexasCardsForScene(sceneName);
        }
        
        // Show cards using the new card system
        if (dynamicCards && dynamicCards.length > 0) {
          setTimeout(() => {
            // Use the new card system via window.mapComponent.cards
            if (window.mapComponent?.cards?.showCards) {
              window.mapComponent.cards.showCards(`scene-${sceneIndex}`);
            }
          }, 2000); // 2 second delay to let scene transition complete
        }
      }
    }
    
    // Clear playing state
    setTimeout(() => {
      setPlayingSceneId(null);
    }, 4000);
    
    return success;
  }, [playScene, scenes]);

  // Handle popup card close
  const handleCardClose = useCallback((cardId) => {
    setActivePopupCards(prev => prev.filter(card => card.id !== cardId));
  }, []);

  const playWorkflow = useCallback((workflow) => {
    // Get the workflow index to map to corresponding saved scene
    const workflowIndex = TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.findIndex(w => w.name === workflow.name);
    
    // If we have saved scenes, use the corresponding one
    if (scenes && scenes.length > workflowIndex && workflowIndex >= 0) {
      const correspondingScene = scenes[workflowIndex];
      
      const settings = browserOptimizations.getSceneTransitionSettings();
      
      // Batch the scene playing to prevent overwhelming the browser
      AnimationBatcher.add(() => {
        try {
          // Play the corresponding saved scene with cards
          playSceneWithCards(correspondingScene.id);
          
          // Set visual feedback
          setPlayingWorkflow(workflow);
          
          // Clear playing state after a delay
          setTimeout(() => {
            setPlayingWorkflow(null);
          }, settings.finalDelay);
        } catch (error) {
          console.warn('Error playing workflow scene:', error);
          setPlayingWorkflow(null);
        }
      }, 1);
      
    } else {
      // Fallback to original behavior with templates if no saved scenes available
      const settings = browserOptimizations.getSceneTransitionSettings();
      
      AnimationBatcher.add(() => {
        setPlayingWorkflow(workflow);
        let currentIndex = 0;
        
        const playNextScene = () => {
          if (currentIndex >= workflow.scenes.length) {
            setPlayingWorkflow(null);
            return;
          }
          
          const templateKey = workflow.scenes[currentIndex];
          const template = TRANSMISSION_CONFIG.sceneTemplates[templateKey];
          
          if (template) {
            try {
              handleApplyTemplate(template);
            } catch (error) {
              console.warn('Error applying template:', error);
            }
          }
          
          currentIndex++;
          
          if (currentIndex < workflow.scenes.length) {
            workflowTimeoutRef.current = setTimeout(playNextScene, workflow.duration);
          } else {
            setPlayingWorkflow(null);
          }
        };
        
        playNextScene();
      }, 1);
    }
  }, [scenes, playSceneWithCards, handleApplyTemplate]);

  // Handle scene navigation from cards
  const handleSceneNavigate = useCallback((sceneId) => {
    let targetScene = null;
    
    // Strategy 1: Check if sceneId is a scene index (scene-0, scene-1, etc.)
    const sceneIndexMatch = sceneId.match(/^scene-(\d+)$/);
    if (sceneIndexMatch) {
      const index = parseInt(sceneIndexMatch[1]);
      if (index >= 0 && index < scenes.length) {
        targetScene = scenes[index];
      }
    }
    
    // Strategy 2: Try to find scene by ID
    if (!targetScene) {
      targetScene = scenes.find(s => s.id === sceneId);
    }
    
    // Strategy 3: Try to find scene by name
    if (!targetScene) {
      targetScene = scenes.find(s => s.name.toLowerCase() === sceneId.toLowerCase());
    }
    
    // Strategy 4: Try partial name match
    if (!targetScene) {
      targetScene = scenes.find(s => s.name.toLowerCase().includes(sceneId.toLowerCase()));
    }
    
    if (targetScene) {
      // Find the corresponding workflow for this scene
      const sceneIndex = scenes.findIndex(s => s.id === targetScene.id);
      if (sceneIndex >= 0 && sceneIndex < TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.length) {
        const correspondingWorkflow = TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS[sceneIndex];
        
        // Set navigation state for visual feedback
        setNavigatingFromPopup(correspondingWorkflow.name);
        
        // Trigger the workflow card animation by calling playWorkflow
        
        playWorkflow(correspondingWorkflow);
        
        // Clear navigation state after animation
        setTimeout(() => {
          setNavigatingFromPopup(null);
        }, 2000);
      } else {
        // Fallback: just play the scene without workflow animation
        playSceneWithCards(targetScene.id);
        
      }
    } else {
      console.warn(`Scene not found for navigation: ${sceneId}`);
    }
  }, [scenes, playSceneWithCards, playWorkflow]);

  // Cleanup workflow timeout on unmount
  useEffect(() => {
    return () => {
      if (workflowTimeoutRef.current) {
        clearTimeout(workflowTimeoutRef.current);
      }
    };
  }, []);

  // Load Texas Data Centers projects
  useEffect(() => {
    if (!isOpen) return;
    
    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const response = await fetchTexasDataCentersGeoJson();
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        const features = data.features || [];
        
        // Sort: projects with real company name first, then "Unknown" or missing companies at the bottom
        const sortedFeatures = [...features].sort((a, b) => {
          const aCompany = a.properties?.company?.trim() || '';
          const bCompany = b.properties?.company?.trim() || '';
          
          // Check if company is a real company (not empty, not "Unknown")
          const aHasRealCompany = aCompany !== '' && aCompany.toLowerCase() !== 'unknown';
          const bHasRealCompany = bCompany !== '' && bCompany.toLowerCase() !== 'unknown';
          
          // If both have real company or both don't, maintain original order
          if (aHasRealCompany === bHasRealCompany) {
            return 0;
          }
          // If a has real company and b doesn't, a comes first
          if (aHasRealCompany && !bHasRealCompany) {
            return -1;
          }
          // If b has real company and a doesn't, b comes first
          return 1;
        });
        
        setDataCenterProjects(sortedFeatures);
      } catch (error) {
        console.error('Failed to load data center projects:', error);
        setDataCenterProjects([]);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    
    loadProjects();
  }, [isOpen]);

  // Listen for marker clicks to highlight table rows
  useEffect(() => {
    if (!window.mapEventBus) return;
    
    const handleProjectSelected = (data) => {
      if (data && data.project_id) {
        setSelectedProjectId(data.project_id);
        
        // Scroll to the row if it exists
        setTimeout(() => {
          const rowElement = tableRowRefs.current[data.project_id];
          if (rowElement) {
            rowElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 100);
      }
    };
    
    const unsubscribe = window.mapEventBus.on('data-center:selected', handleProjectSelected);
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Cleanup function to clear all animations and timeouts
  useEffect(() => {
    return () => {
      // Clear all animations and timeouts on unmount
      AnimationBatcher.clear();
      if (workflowTimeoutRef.current) {
        clearTimeout(workflowTimeoutRef.current);
      }
      if (autoHoverRef.current) {
        clearInterval(autoHoverRef.current);
      }
      // Cleanup scene transitions
      cleanupScenes();
    };
  }, [cleanupScenes]);

  // Handle animated toggle with morphing
  const handleAnimatedToggle = useCallback(() => {
    // Check if we should use simple mode due to performance or browser
    const currentFPS = PerformanceMonitor.getCurrentFPS();
    const shouldReduceAnimations = browserOptimizations.shouldReduceAnimations(currentFPS);
    
    if (useSimpleMode || shouldReduceAnimations) {
      // Use simple toggle without animations
      onToggle();
      return;
    }

    // Use browser-optimized animation settings
    const settings = browserOptimizations.getAnimationSettings();
    
    try {
      setIsAnimating(true);
      
      // Morphing sequence with browser-specific batching
      const morphingSequence = [
        () => {
          
          setIsMorphing(true);
          setShowHeaderTitle(false);
        },
        () => {
          
          // Start the panel opening while still morphing
          onToggle();
        },
        () => {
          
          // Complete the morph and show content
          setIsMorphing(false);
          setIsAnimating(false);
          setShowWelcome(true);
          setShowHeaderTitle(true);
        }
      ];

      // Add animations to batch with slower delays for better visual effect
      const morphingDelays = [0, 200, 800]; // Start immediately, trigger panel at 200ms, complete at 800ms
      
      morphingSequence.forEach((animation, index) => {
        AnimationBatcher.add(() => {
          animation();
        }, morphingDelays[index] || 0);
      });

      // Show content after animation completes (1200ms animation + buffer)
      AnimationBatcher.add(() => {
        setShowWelcome(false);
        setShowReadyPulse(true);
        
        setTimeout(() => {
          setShowReadyPulse(false);
        }, 2000);
      }, 1400); // After 1.2s animation + 200ms buffer

    } catch (error) {
      console.error('Animation error:', error);
      setIsAnimating(false);
      setIsMorphing(false);
      // Fallback to simple toggle
      onToggle();
    }
  }, [onToggle, useSimpleMode]);

  // Listen for MCP search events from purple button
  useEffect(() => {
    const handleMCPOpenSearch = () => {
      console.log('🟣 [AITransmissionNav] Received mcp:openSearch - opening nav and expanding workflows', {
        timestamp: new Date().toISOString(),
        isOpen,
        workflowsExpanded: expandedSections.workflows
      });
      
      // Open the nav if it's closed
      if (!isOpen && onToggle) {
        handleAnimatedToggle();
      }
      
      // Expand workflows section after a short delay to ensure nav is open
      setTimeout(() => {
        if (!expandedSections.workflows) {
          setExpandedSections(prev => ({
            ...prev,
            workflows: true
          }));
        }
        // Also expand MCP section
        if (!expandedSections.mcp) {
          setExpandedSections(prev => ({
            ...prev,
            mcp: true
          }));
        }
      }, 800); // Delay to allow nav animation to complete
    };

    const handleMCPTriggerFirstQuickAction = () => {
      console.log('🟣 [AITransmissionNav] Received mcp:triggerFirstQuickAction - triggering first workflow', {
        timestamp: new Date().toISOString()
      });
      
      // Find the first workflow (index 0)
      const firstWorkflow = TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS[0];
      if (firstWorkflow) {
        // Small delay to ensure nav is fully open and section is expanded
        setTimeout(() => {
          playWorkflow(firstWorkflow);
        }, 1200); // Delay to ensure nav and section are ready
      }
    };

    // Subscribe to mapBus events
    const unsubscribeOpen = mapBus.on('mcp:openSearch', handleMCPOpenSearch);
    const unsubscribeTrigger = mapBus.on('mcp:triggerFirstQuickAction', handleMCPTriggerFirstQuickAction);

    return () => {
      // Cleanup subscriptions
      if (unsubscribeOpen) unsubscribeOpen();
      if (unsubscribeTrigger) unsubscribeTrigger();
    };
  }, [isOpen, onToggle, expandedSections.workflows, playWorkflow, handleAnimatedToggle]);

  // Morphing button component with error boundaries
    const MorphingButton = () => {
      const [hasError, setHasError] = useState(false);
      
      const handleClick = () => {
        try {
          handleAnimatedToggle();
        } catch (error) {
          console.error('Error in morphing animation:', error);
          setHasError(true);
          // Fallback to simple toggle
          setTimeout(() => {
            onToggle();
            setHasError(false);
          }, 100);
        }
      };
      
      if (hasError) {
        return (
          <button
            onClick={() => onToggle()}
            style={{
              position: 'fixed',
              top: 20,
              left: 24,
              width: 41,
              height: 41,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #1a1a1a 0%, #111111 100%)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              color: '#e2e8f0',
              zIndex: 1001
            }}
            title="Open AI Transmission Navigator (Fallback)"
          >
            AI
          </button>
        );
      }
      
      return (
        <>
          <style>
            {`
              @keyframes pulseBorder {
                0% {
                  border-color: #4caf50;
                  box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.8);
                }
                50% {
                  border-color: #66bb6a;
                  box-shadow: 0 0 0 15px rgba(76, 175, 80, 0.4);
                }
                100% {
                  border-color: #4caf50;
                  box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.8);
                }
              }
              
              @keyframes hoverPulse {
                0% {
                  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(76, 175, 80, 0.6);
                }
                50% {
                  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 0 12px rgba(76, 175, 80, 0.3);
                }
                100% {
                  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(76, 175, 80, 0.6);
                }
              }
              
              @keyframes smoothMorph {
                0% {
                  width: 41px;
                  height: 41px;
                  border-radius: 20px;
                  transform: scale(1);
                }
                50% {
                  width: 12%;
                  height: 50px;
                  border-radius: 15px;
                  transform: scale(1.02);
                }
                100% {
                  width: 27%;
                  height: calc(100vh - 40px);
                  border-radius: 10px;
                  transform: scale(1);
                }
              }
            `}
          </style>
          <button
            onClick={handleClick}
            style={{
              position: 'fixed',
              top: 20,
              left: 24,
              width: isMorphing ? '27%' : 41,
              height: isMorphing ? 'calc(100vh - 40px)' : 41,
              borderRadius: isMorphing ? 10 : 20,
              background: isMorphing 
                ? '#1a1a1a'
                : 'linear-gradient(135deg, #1a1a1a 0%, #111111 100%)',
              border: isMorphing ? '1px solid #333333' : 'none',
              animation: isMorphing 
                ? 'smoothMorph 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) forwards'
                : (autoHover && !isMorphing ? 'hoverPulse 1.5s ease-in-out infinite' : 'pulseBorder 2s ease-in-out infinite'),
              boxShadow: isMorphing 
                ? '0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)'
                : '0 4px 16px rgba(0, 0, 0, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: isMorphing ? 'flex-start' : 'center',
              justifyContent: isMorphing ? 'flex-start' : 'center',
              fontSize: 17,
              color: '#e2e8f0',
              transition: isMorphing ? 'none' : 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              zIndex: 1001,
              overflow: 'hidden',
              paddingTop: isMorphing ? 16 : 0,
              paddingLeft: isMorphing ? 20 : 0,
              transform: autoHover && !isMorphing ? 'scale(1.05)' : 'scale(1)' // Reduced from 1.1
            }}
            onMouseEnter={(e) => {
              if (!isMorphing) {
                e.target.style.transform = 'scale(1.05)'; // Reduced from 1.1
                e.target.style.animation = 'hoverPulse 1.5s ease-in-out infinite';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMorphing) {
                e.target.style.transform = 'scale(1)';
                e.target.style.animation = 'none';
              }
            }}
            onMouseDown={(e) => {
              if (!isMorphing) {
                e.target.style.transform = 'scale(0.95)';
              }
            }}
            onMouseUp={(e) => {
              if (!isMorphing) {
                e.target.style.transform = 'scale(1.05)'; // Reduced from 1.1
              }
            }}
            title="Open AI Transmission Navigator"
          >
            {isMorphing ? (
              <span style={{ 
                fontSize: 14,
                fontWeight: 900,
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                letterSpacing: '-0.25px',
                opacity: 0, // Keep text hidden during morphing
                transform: 'translateY(10px)'
              }}>
                {/* No text during morphing */}
              </span>
            ) : (
              'AI'
            )}
          </button>
        </>
      );
    };

  // Toggle button for when nav is closed (and not morphing) - hidden on mobile
  if (!isOpen && !isMorphing) {
    if (isMobile) return null;
    return <MorphingButton />;
  }

  return (
    <>
      {/* Render the panel container when open or morphing */}
      {(isOpen || isMorphing) && (
        <NavContainer isOpen={isOpen} isAnimating={isAnimating} isMorphing={isMorphing}>
          {/* Only show content when not morphing */}
          {!isMorphing && (
            <>
              <NavHeader 
                title="Swichyard"
                subtitle="Research experiment 101 - Find Data Center Near me"
                onClose={onClose}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                showTitle={showHeaderTitle}
              />
              
              <StatusBar status={status} isPlaying={isPlaying || playingWorkflow} showWelcome={showWelcome} showReadyPulse={showReadyPulse} />
              
              {!isCollapsed && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Market Signal Section */}
          <SectionHeader
            title="Daily Motion — Market × Grid"
            icon=""
            count={dailyMotion.market.count7d}
            isExpanded={expandedSections.marketSignal}
            onToggle={() => toggleSection('marketSignal')}
            animationDelay={0}
            isAnimating={isAnimating}
          />

          {expandedSections.marketSignal && (
            <div style={{ paddingBottom: 16, paddingTop: 16 }}>
              <MarketSignal
                dailyMotion={dailyMotion}
                dailyMotionLoading={dailyMotionLoading}
                dailyMotionError={dailyMotionError}
                onRefreshMarket={handleRefreshMarket}
                onRefreshGrid={handleRefreshGrid}
              />
            </div>
          )}

          {/* Texas Data Centers Section */}
          <SectionHeader
            title="Texas Data Centers"
            icon=""
            count={dataCenterProjects.length}
            isExpanded={expandedSections.dataCenters}
            onToggle={() => toggleSection('dataCenters')}
            animationDelay={0}
            isAnimating={isAnimating}
          />
          
          {expandedSections.dataCenters && (
            <div style={{ paddingBottom: 24, paddingTop: 16 }}>
              {isLoadingProjects ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#9aa0a6',
                  fontSize: 12,
                  fontFamily: 'Roboto, Arial, sans-serif'
                }}>
                  Loading projects...
                </div>
              ) : dataCenterProjects.length === 0 ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#9aa0a6',
                  fontSize: 12,
                  fontFamily: 'Roboto, Arial, sans-serif'
                }}>
                  No projects found
                </div>
              ) : (
                <div style={{
                  margin: '0 20px',
                  overflowX: 'auto',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: 'Roboto, Arial, sans-serif',
                    fontSize: 11
                  }}>
                    <thead>
                      <tr style={{
                        background: '#2a2a2a',
                        borderBottom: '1px solid #333333',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                      }}>
                        <th style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Company</th>
                        <th style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Project</th>
                        <th style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Location</th>
                        <th style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Size</th>
                        <th style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataCenterProjects.map((feature, index) => {
                        const props = feature.properties;
                        const projectId = props.project_id || index;
                        const isSelected = selectedProjectId === projectId;
                        const statusColor = props.status === 'active' ? '#10b981' : 
                                          props.status === 'uncertain' ? '#f59e0b' : 
                                          props.status === 'dead_candidate' ? '#ef4444' : '#6b7280';
                        
                        return (
                          <tr
                            key={projectId}
                            ref={(el) => {
                              if (el) tableRowRefs.current[projectId] = el;
                            }}
                            style={{
                              borderBottom: '1px solid #333333',
                              transition: 'background-color 0.3s ease, border-left 0.3s ease',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#1a4d3a' : 'transparent',
                              borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = '#333333';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            onClick={() => {
                              // Zoom to project location
                              if (map?.current && feature.geometry.coordinates) {
                                map.current.flyTo({
                                  center: feature.geometry.coordinates,
                                  zoom: 12,
                                  duration: 1000
                                });
                              }
                              // Also set selected state
                              setSelectedProjectId(projectId);
                              
                              // Emit event to show popup on map (with 1 second delay handled in layer)
                              if (window.mapEventBus && props.project_id) {
                                window.mapEventBus.emit('data-center:show-popup', {
                                  project_id: props.project_id,
                                  properties: props,
                                  coordinates: feature.geometry.coordinates
                                });
                              }
                            }}
                          >
                            <td style={{
                              padding: '10px 12px',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 500
                            }}>
                              {props.company || 'Unknown'}
                            </td>
                            <td style={{
                              padding: '10px 12px',
                              color: '#d1d5db',
                              fontSize: 11
                            }}>
                              {props.project_name || 'N/A'}
                            </td>
                            <td style={{
                              padding: '10px 12px',
                              color: '#9aa0a6',
                              fontSize: 10
                            }}>
                              {props.location || 'N/A'}
                            </td>
                            <td style={{
                              padding: '10px 12px',
                              color: '#9aa0a6',
                              fontSize: 10
                            }}>
                              {props.size_mw ? `${props.size_mw} MW` : 'N/A'}
                            </td>
                            <td style={{
                              padding: '10px 12px'
                            }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: 9,
                                fontWeight: 500,
                                backgroundColor: statusColor,
                                color: '#000000',
                                textTransform: 'capitalize'
                              }}>
                                {props.status || 'unknown'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Analysis Workflows Section */}
          <SectionHeader
            title="Analysis Workflows"
            icon=""
            count={TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.length}
            isExpanded={expandedSections.workflows}
            onToggle={() => toggleSection('workflows')}
            animationDelay={400}
            isAnimating={isAnimating}
          />
          
          {expandedSections.workflows && (
            <div style={{ paddingBottom: 24, paddingTop: 16 }}>
              {TRANSMISSION_CONFIG.aiPrompts.ANALYSIS_WORKFLOWS.map((workflow, index) => (
                <div
                  key={index}
                  style={{
                    animation: `workflowFadeIn 0.4s ease-out ${index * 0.1}s both`,
                    marginTop: index === 0 ? 8 : 0
                  }}
                >
                  <WorkflowCard
                    workflow={workflow}
                    workflowIndex={index}
                    scenes={scenes}
                    onPlay={playWorkflow}
                    onTaskAnimationStart={handleTaskAnimationStart}
                    onTaskAnimationComplete={handleTaskAnimationComplete}
                    activeSceneId={playingSceneId}
                    isNavigatingFromPopup={navigatingFromPopup === workflow.name}
                    isAnimationRunning={isTaskAnimationRunning}
                  />
                </div>
              ))}
              {playingWorkflow && (
                <div style={{
                  margin: '8px 24px',
                  padding: '12px 16px',
                  background: '#155a47',
                  borderRadius: 8,
                  color: '#4caf50',
                  fontSize: 12,
                  textAlign: 'center',
                  fontFamily: 'Roboto, Arial, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #34a853'
                }}>
                  <span>Playing: {playingWorkflow.name}</span>
                  <button
                    onClick={() => {
                      if (workflowTimeoutRef.current) {
                        clearTimeout(workflowTimeoutRef.current);
                      }
                      setPlayingWorkflow(null);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #4caf50',
                      borderRadius: 16,
                      color: '#4caf50',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '4px 12px',
                      fontFamily: 'Roboto, Arial, sans-serif',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#4caf50';
                      e.target.style.color = '#155a47';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.color = '#4caf50';
                    }}
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scene Templates Section */}
          <SectionHeader
            title="Analysis Templates"
            icon=""
            count={Object.keys(TRANSMISSION_CONFIG.sceneTemplates).length}
            isExpanded={expandedSections.templates}
            onToggle={() => toggleSection('templates')}
            animationDelay={800}
            isAnimating={isAnimating}
          />
          
          {expandedSections.templates && (
            <div style={{ paddingBottom: 8 }}>
              {Object.values(TRANSMISSION_CONFIG.sceneTemplates).map((template, index) => (
                <div
                  key={index}
                  style={{
                    animation: `workflowFadeIn 0.4s ease-out ${index * 0.1}s both`
                  }}
                >
                  <SceneTemplateCard
                    template={template}
                    onApply={handleApplyTemplate}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Captured Scenes Section */}
          <SectionHeader
            title="Saved Scenes"
            icon=""
            count={scenes.length}
            isExpanded={expandedSections.scenes}
            onToggle={() => toggleSection('scenes')}
            animationDelay={1200}
            isAnimating={isAnimating}
          />
          
          {expandedSections.scenes && (
            <div style={{ paddingBottom: 8 }}>
              {/* New scene input */}
              <div style={{ margin: '10px 20px', display: 'flex', gap: 7 }}> {/* Reduced from 12px 24px, gap 8 */}
                <input
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCaptureScene();
                    }
                  }}
                  placeholder="Scene name..."
                  style={{
                    flex: 1,
                    background: '#1f1f1f',
                    border: '1px solid #5f6368',
                    borderRadius: 3, // Reduced from 4
                    color: '#ffffff',
                    fontSize: 11, // Reduced from 13
                    padding: '10px 14px', // Reduced from 12px 16px
                    fontFamily: 'Roboto, Arial, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1a73e8'}
                  onBlur={(e) => e.target.style.borderColor = '#5f6368'}
                />
                <button
                  onClick={handleCaptureScene}
                  disabled={!newSceneName.trim()}
                  style={{
                    background: newSceneName.trim() ? '#1a73e8' : '#5f6368',
                    border: 'none',
                    borderRadius: 17, // Reduced from 20
                    color: 'white',
                    cursor: newSceneName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 11, // Reduced from 13
                    padding: '10px 20px', // Reduced from 12px 24px
                    fontFamily: 'Roboto, Arial, sans-serif',
                    fontWeight: 500,
                    transition: 'background-color 0.2s ease',
                    opacity: newSceneName.trim() ? 1 : 0.6
                  }}
                  onMouseEnter={(e) => {
                    if (newSceneName.trim()) {
                      e.target.style.background = '#1557b0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (newSceneName.trim()) {
                      e.target.style.background = '#1a73e8';
                    }
                  }}
                >
                  Save
                </button>
              </div>
              
              {/* Backup/Restore buttons */}
              <div style={{ 
                margin: '10px 20px', 
                padding: '8px 0',
                borderTop: '1px solid #333333',
                display: 'flex',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <button
                  onClick={() => {
                    try {
                      sceneBackupManager.createBackup();
                    } catch (error) {
                      console.error('Backup failed:', error);
                    }
                  }}
                  title="Create Backup of All Saved Scenes"
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '8px 16px',
                    fontFamily: 'Roboto, Arial, sans-serif',
                    fontWeight: '500',
                    transition: 'background-color 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#059669'}
                  onMouseLeave={(e) => e.target.style.background = '#10b981'}
                >
                  💾 Backup All Scenes
                </button>
                <button
                  onClick={() => {
                    try {
                      sceneBackupManager.createFileInput();
                    } catch (error) {
                      console.error('Restore failed:', error);
                    }
                  }}
                  title="Restore Scenes from Backup File"
                  style={{
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '8px 16px',
                    fontFamily: 'Roboto, Arial, sans-serif',
                    fontWeight: '500',
                    transition: 'background-color 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                >
                  📁 Restore Scenes
                </button>
                <button
                  onClick={() => {
                    try {
                      forceLoadDefaultScenes();
                      // Refresh the scenes list
                      setTimeout(() => {
                        window.location.reload();
                      }, 500);
                    } catch (error) {
                      console.error('Load default scenes failed:', error);
                    }
                  }}
                  title="Load Default Scenes (Overwrites Existing)"
                  style={{
                    background: '#f59e0b',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '8px 16px',
                    fontFamily: 'Roboto, Arial, sans-serif',
                    fontWeight: '500',
                    transition: 'background-color 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#d97706'}
                  onMouseLeave={(e) => e.target.style.background = '#f59e0b'}
                >
                  🎬 Load Default Scenes
                </button>
              </div>
              
              {/* Scene list */}
              {scenes.map(scene => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                                      onPlay={playSceneWithCards}
                  onUpdate={updateScene}
                  onDelete={deleteScene}
                  onEdit={handleEditScene}
                  isEditing={editingSceneId === scene.id}
                  editName={editSceneName}
                  setEditName={setEditSceneName}
                />
              ))}
            </div>
          )}

          <div style={{
            margin: '16px 20px 20px',
            padding: '10px 12px',
            borderTop: '1px solid #333333',
            color: '#9aa0a6',
            fontSize: 11,
            lineHeight: 1.4,
            fontFamily: 'Roboto, Arial, sans-serif'
          }}>
            <strong style={{ color: '#d1d5db', fontWeight: 600 }}>About</strong>
            <div>Switchyard makes hidden infrastructure visible - search an address to see what is happening nearby.</div>
            <div style={{ marginTop: 6 }}>Data from public reports + county queue aggregates (Texas), including 170 tracked projects. Overlaid with 76,001 ERCOT GIS interconnection records across all 254 Texas counties.</div>
            <div>
              Yair Titelboim - <a
                href="https://www.linkedin.com/in/yair-titelboim-aaa5ab18"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#8ab4f8', textDecoration: 'none' }}
              >
                LinkedIn
              </a>
            </div>
          </div>

                </div>
              )}
            </>
          )}
        </NavContainer>
      )}
      
      {/* Scene Popup Cards */}
      {map?.current && (
        <ScenePopupManager
          mapInstance={map.current}
          activeCards={activePopupCards}
          onCardClose={handleCardClose}
          onSceneNavigate={handleSceneNavigate}
        />
      )}
    </>
  );
};

export default AITransmissionNav; 
