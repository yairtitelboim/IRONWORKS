import React from 'react';

const CategoryToggleSkeleton = ({ 
  isVisible = true 
}) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '36px', // Same position as CategoryToggle
      left: '29px', // Same position as CategoryToggle
      zIndex: 9,
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '8px 0'
    }}>
      {/* Skeleton buttons for category toggles */}
      {['ALL', 'PWR', 'TRN', 'UTL', 'RSK'].map((label, index) => (
        <div
          key={label}
          style={{
            width: '28px',
            height: '28px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
            animationDelay: `${index * 0.1}s`
          }}
        >
          <div style={{
            width: '12px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '2px',
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
            animationDelay: `${index * 0.1 + 0.2}s`
          }} />
        </div>
      ))}
      
      {/* Skeleton for view mode toggle button */}
      <div style={{
        width: '32px',
        height: '16px',
        background: 'rgba(107, 114, 128, 0.2)',
        borderRadius: '4px',
        marginLeft: '8px',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
        animationDelay: '0.5s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '16px',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '2px',
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
          animationDelay: '0.7s'
        }} />
      </div>
    </div>
  );
};

export default CategoryToggleSkeleton;
