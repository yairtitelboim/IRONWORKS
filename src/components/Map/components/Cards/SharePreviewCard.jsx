import React, { useState } from 'react';

function SharePreviewCard({
  bullets = [],
  title = '',
  subtitle = '',
  onExpandPreview,
  highlightExpandPulse = false,
  relevantLinks = []
}) {
  const [expandState, setExpandState] = useState('idle');

  const handleExpand = async (e) => {
    e.stopPropagation();
    if (expandState === 'expanding') return;
    setExpandState('expanding');
    try {
      onExpandPreview?.();
      setExpandState('expanded');
      setTimeout(() => {
        setExpandState('idle');
      }, 1200);
    } catch {
      setExpandState('error');
      setTimeout(() => {
        setExpandState('idle');
      }, 1200);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '8px',
        color: '#e2e8f0',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}
      >
        <div style={{ minWidth: 0, paddingRight: '8px' }}>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600
            }}
          >
            Site Brief
          </div>
          {title && (
            <div
              style={{
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 800,
                lineHeight: 1.2,
                marginTop: '3px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                color: 'rgba(191,219,254,0.82)',
                fontSize: '10px',
                lineHeight: 1.25,
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleExpand}
          disabled={expandState === 'expanding'}
          style={{
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '4px',
            background: expandState === 'expanded' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.4)',
            color: expandState === 'expanded' ? '#86efac' : 'rgba(226,232,240,0.75)',
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 600,
            cursor: expandState === 'expanding' ? 'wait' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
            animation: highlightExpandPulse && expandState === 'idle' ? 'carousel-expand-red-pulse 1s ease-out 1' : 'none',
            animationDelay: highlightExpandPulse && expandState === 'idle' ? '0.55s' : '0s'
          }}
          onMouseEnter={(e) => {
            if (expandState === 'idle') {
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (expandState === 'idle') {
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
            }
          }}
        >
          {expandState === 'expanded' ? '✓ Open' : expandState === 'error' ? 'Error' : 'Expand'}
        </button>
      </div>

      <div 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          marginBottom: '8px',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {bullets.map((bullet, idx) => (
            <div key={idx}>
              <div
                style={{
                  color: 'rgba(203,213,225,0.7)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                  fontWeight: 600
                }}
              >
                {bullet.label}
              </div>
              <div
                style={{
                  color: bullet.color || '#e2e8f0',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  marginBottom: '1px'
                }}
              >
                {bullet.value}
              </div>
              {bullet.detail && (
                <div
                  style={{
                    color: 'rgba(148,163,184,0.75)',
                    fontSize: '11px',
                    lineHeight: 1.3
                  }}
                >
                  {bullet.detail}
                </div>
              )}
            </div>
          ))}
        </div>

        {relevantLinks && relevantLinks.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: '6px' }}>
            <div
              style={{
                color: 'rgba(203,213,225,0.7)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
                fontWeight: 600
              }}
            >
              Relevant Links
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {relevantLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    color: '#60a5fa',
                    fontSize: '10px',
                    textDecoration: 'none',
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.4
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#93c5fd';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#60a5fa';
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default SharePreviewCard;
