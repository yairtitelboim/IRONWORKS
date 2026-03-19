import React, { useEffect, useRef, useState } from 'react';

const TOUR_KEY = 'pha_tour_v4';
const TOUR_ACCENT = '#60a5fa';
const read  = () => { const v = parseInt(localStorage.getItem(TOUR_KEY), 10); return isNaN(v) ? 0 : v; };
const write = (n) => localStorage.setItem(TOUR_KEY, String(n));

/** Inject keyframes once */
const injectStyles = () => {
  if (document.getElementById('pha-tour-styles')) return;
  const s = document.createElement('style');
  s.id = 'pha-tour-styles';
  s.textContent = `
    @keyframes pha-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
      70%  { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    }
    @keyframes pha-fade-in {
      from { opacity: 0; transform: translateY(6px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    @keyframes pha-copy-enter {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pha-handle-beacon {
      0%, 100% {
        box-shadow: 0 0 0 3px rgba(59,130,246,0.95), 0 0 0 8px rgba(59,130,246,0.4), 0 6px 18px rgba(59,130,246,0.55);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(59,130,246,1), 0 0 0 12px rgba(59,130,246,0.25), 0 10px 26px rgba(59,130,246,0.65);
      }
    }
  `;
  document.head.appendChild(s);
};

/**
 * A single floating hint tooltip, positioned next to a DOM element.
 * Renders into a portal at document.body level via inline fixed positioning.
 */
const Hint = ({ selector, title, body, side = 'bottom', offsetY = 0, onDismiss, buttonBg, buttonFontSize, buttonScale, buttonPadding, buttonMinHeight, buttonMarginTop, bodyMarginTop, bodyAnimation, progressText, mobileWidth, centerOnMobile, anchorBelowTargetOnMobile }) => {
  const [rect, setRect] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    injectStyles();
    const el = document.querySelector(selector);
    if (!el) { onDismiss(); return; }
    const isPowerHandle = el.classList.contains('power-circle-handle');
    const originalStyles = isPowerHandle
      ? {
          boxShadow: el.style.boxShadow,
          transform: el.style.transform,
          zIndex: el.style.zIndex,
          animation: el.style.animation,
        }
      : null;

    if (isPowerHandle) {
      el.style.setProperty('box-shadow', '0 0 0 3px rgba(59,130,246,0.95), 0 0 0 8px rgba(59,130,246,0.4), 0 6px 18px rgba(59,130,246,0.55)', 'important');
      el.style.setProperty('transform', 'scale(1.18)', 'important');
      el.style.setProperty('z-index', '10005', 'important');
      el.style.setProperty('animation', 'pha-handle-beacon 1.15s ease-in-out infinite', 'important');
    }

    const update = () => setRect(el.getBoundingClientRect());
    update();
    const io = new ResizeObserver(update);
    io.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      io.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      if (isPowerHandle && originalStyles) {
        el.style.boxShadow = originalStyles.boxShadow || '';
        el.style.transform = originalStyles.transform || '';
        el.style.zIndex = originalStyles.zIndex || '';
        el.style.animation = originalStyles.animation || '';
      }
    };
  }, [selector, onDismiss]);

  if (!rect) return null;

  // Position the popover
  const GAP = 10;
  const isMobileViewport = window.innerWidth <= 768;
  const mobileWidthPx = (() => {
    if (typeof mobileWidth === 'number') return mobileWidth;
    if (typeof mobileWidth === 'string') {
      const trimmed = mobileWidth.trim();
      if (trimmed.endsWith('vw')) {
        const n = parseFloat(trimmed.slice(0, -2));
        if (Number.isFinite(n)) return (window.innerWidth * n) / 100;
      }
      if (trimmed.endsWith('px')) {
        const n = parseFloat(trimmed.slice(0, -2));
        if (Number.isFinite(n)) return n;
      }
    }
    return Math.min(320, window.innerWidth - 20);
  })();
  const BOX_W = isMobileViewport ? mobileWidthPx : 240;
  const boxWidthStyle = isMobileViewport
    ? (mobileWidth || `${Math.round(mobileWidthPx)}px`)
    : BOX_W;
  const BOX_H_EST = 90;

  let left, top;
  if (isMobileViewport && centerOnMobile && anchorBelowTargetOnMobile) {
    left = window.innerWidth / 2 - BOX_W / 2;
    top = rect.bottom + GAP + 6;
  } else if (isMobileViewport && centerOnMobile) {
    left = window.innerWidth / 2 - BOX_W / 2;
    top = window.innerHeight / 2 - BOX_H_EST / 2;
  } else if (side === 'bottom') {
    left = rect.left + rect.width / 2 - BOX_W / 2;
    top  = rect.bottom + GAP + 20;
  } else if (side === 'top') {
    left = rect.left + rect.width / 2 - BOX_W / 2;
    top  = rect.top - BOX_H_EST - GAP;
  } else if (side === 'left') {
    left = rect.left - BOX_W - GAP;
    top  = rect.top + rect.height / 2 - BOX_H_EST / 2;
  } else { // right
    left = rect.right + GAP;
    top  = rect.top + rect.height / 2 - BOX_H_EST / 2;
  }

  // Clamp to viewport
  left = Math.max(8, Math.min(left, window.innerWidth  - BOX_W - 8));
  top  = Math.max(8, Math.min(top,  window.innerHeight - BOX_H_EST - 8));
  top = Math.max(8, top + offsetY);

  return (
    <>
      {/* Four overlay panels that surround the target, creating a real transparent spotlight */}
      {/* Top */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height: Math.max(0, rect.top - 6), background:'rgba(0,0,0,0.65)', zIndex:99997, pointerEvents:'none' }} />
      {/* Bottom */}
      <div style={{ position:'fixed', top: rect.bottom + 6, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.65)', zIndex:99997, pointerEvents:'none' }} />
      {/* Left */}
      <div style={{ position:'fixed', top: rect.top - 6, left:0, width: Math.max(0, rect.left - 6), height: rect.height + 12, background:'rgba(0,0,0,0.65)', zIndex:99997, pointerEvents:'none' }} />
      {/* Right */}
      <div style={{ position:'fixed', top: rect.top - 6, left: rect.right + 6, right:0, height: rect.height + 12, background:'rgba(0,0,0,0.65)', zIndex:99997, pointerEvents:'none' }} />
      {/* Pulsing blue border around the spotlight */}
      <div style={{
        position: 'fixed',
        top:    rect.top    - 6,
        left:   rect.left   - 6,
        width:  rect.width  + 12,
        height: rect.height + 12,
        borderRadius: '10px',
        border: '2px solid var(--tour-accent)',
        pointerEvents: 'none',
        zIndex: 99998,
        animation: 'pha-pulse 1.8s ease-out infinite',
        boxSizing: 'border-box',
      }} />

      {/* Popover */}
      <div
        ref={boxRef}
        style={{
          '--tour-accent': TOUR_ACCENT,
          position: 'fixed',
          top,
          left,
          width: boxWidthStyle,
          maxWidth: isMobileViewport ? 'calc(100vw - 20px)' : '240px',
          zIndex: 99999,
          background: 'rgba(17, 24, 39, 0.97)',
          border: '1px solid var(--tour-accent)',
          borderRadius: '10px',
          padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          animation: 'pha-fade-in 0.25s ease forwards',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}
      >
        {progressText ? (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '10px',
              color: 'rgba(148, 163, 184, 0.9)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.02em'
            }}
          >
            {progressText}
          </div>
        ) : null}
        {title ? (
          <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            {title}
          </div>
        ) : null}
        <div
          style={{
            color: 'rgba(229,231,235,0.85)',
            fontSize: '12px',
            lineHeight: 1.6,
            marginTop: bodyMarginTop || 0,
            animation: bodyAnimation || 'none'
          }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
        <button
          onClick={onDismiss}
          style={{
            marginTop: buttonMarginTop || '12px',
            padding: buttonPadding || (isMobileViewport ? '10px 16px' : '5px 14px'),
            minHeight: buttonMinHeight || (isMobileViewport ? '42px' : 'auto'),
            background: buttonBg || 'var(--tour-accent)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: buttonFontSize || '11px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'block',
            transform: `scale(${buttonScale || 1})`,
            transformOrigin: 'left top'
          }}
        >
          Got it →
        </button>
      </div>
    </>
  );
};

/**
 * OnboardingTour – 3-step contextual guide.
 *
 * Step 0→1 : Search bar          – 3s after first visit
 * Step 1→2 : Cluster map card    – 5s after first response appears
 * Step 2→3 : Bottom story in map – 2s after Cluster Map is opened
 *
 * Reset: localStorage.removeItem('pha_tour_v4')
 */
const OnboardingTour = ({ hasResponses }) => {
  const [activeHint, setActiveHint] = useState(null); // { selector, title, body, side, nextStep }
  const [tourStep, setTourStep] = useState(() => read());

  const dismiss = (nextStep) => {
    write(nextStep);
    setTourStep(nextStep);
    setActiveHint(null);
  };

  // ── Step 1: Search bar ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tourStep !== 0) return;
    const t = setTimeout(() => {
      if (tourStep !== 0) return;
      const el = document.querySelector('[data-tour="search-bar"]');
      if (!el) return;
      setActiveHint({
        selector: '[data-tour="search-bar"]',
        title: '',
        body: `<span style="font-size:16px;font-weight:700;line-height:1.5;">Search any Texas address. See what data center pressure looks like nearby.</span><br/><span style="display:block;margin-top:14px;font-size:11px;line-height:1.45;color:rgba(229,231,235,0.82);">170 tracked projects. 76,001 ERCOT interconnection records. 254 counties. Built by an infrastructure researcher.</span>`,
        bodyMarginTop: '18px',
        bodyAnimation: 'pha-copy-enter 0.35s ease-out forwards',
        buttonBg: 'rgba(96, 165, 250, 0.25)',
        buttonMarginTop: '24px',
        buttonFontSize: '11px',
        buttonScale: 1.1,
        buttonPadding: '7.5px 16px',
        buttonMinHeight: '31.5px',
        progressText: '1/3',
        mobileWidth: '70vw',
        centerOnMobile: true,
        anchorBelowTargetOnMobile: true,
        side: 'bottom',
        nextStep: 1,
      });
    }, 3000);
    return () => clearTimeout(t);
  }, [tourStep]);

  // ── Step 2: Focus facilities section – fires 5s after first response ──────
  useEffect(() => {
    if (tourStep !== 1) return;
    if (!hasResponses) return;

    let cancelled = false;
    const poll = (n = 0) => {
      if (cancelled) return;
      const el = document.querySelector('[data-tour="focus-facilities"]');
      if (el) {
        setActiveHint({
          selector: '[data-tour="focus-facilities"]',
          title: 'Explore nearby facilities',
          body: '<span style="font-weight:700;color:#ffffff;">Tap Facilities</span> to open the nearby site list and see how many real projects are clustered around this market search.',
          buttonBg: 'rgba(96, 165, 250, 0.3)',
          progressText: '2/3',
          side: 'top',
          offsetY: (typeof window !== 'undefined' && window.innerWidth <= 768) ? -78 : -20,
          nextStep: 2,
        });
      } else if (n < 20) {
        setTimeout(() => poll(n + 1), 150);
      }
    };
    const t = setTimeout(() => poll(), 5000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [hasResponses, tourStep]);

  // ── Step 3: Bottom story item – after Cluster Map opens ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return;
    let hintTimeoutId = null;
    let pollTimeoutId = null;
    let cancelled = false;

    const showBottomStoryHint = () => {
      const poll = (n = 0) => {
        if (cancelled || tourStep !== 2) return;
        const el = document.querySelector('[data-tour="opposition-bottom-story"]');
        if (el) {
          setActiveHint({
            selector: '[data-tour="opposition-bottom-story"]',
            title: 'Open a story',
            body: 'Click this headline to open the source article and review what is driving local opposition.',
            progressText: '3/3',
            side: 'top',
            nextStep: 2,
          });
        } else if (n < 20) {
          pollTimeoutId = setTimeout(() => poll(n + 1), 150);
        }
      };
      poll();
    };

    const onClusterOpened = () => {
      if (tourStep !== 2) return;
      if (hintTimeoutId) clearTimeout(hintTimeoutId);
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
      hintTimeoutId = setTimeout(showBottomStoryHint, 2000);
    };

    window.mapEventBus.on('opposition:cluster-map-opened', onClusterOpened);
    return () => {
      cancelled = true;
      if (hintTimeoutId) clearTimeout(hintTimeoutId);
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
      window.mapEventBus.off('opposition:cluster-map-opened', onClusterOpened);
    };
  }, [tourStep]);

  // Advance to step 4 only when a story is actually clicked.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return;
    if (tourStep !== 2) return;
    const onStoryClicked = () => {
      write(3);
      setTourStep(3);
      setActiveHint(null);
    };
    window.mapEventBus.on('opposition:story-clicked', onStoryClicked);
    return () => {
      window.mapEventBus.off('opposition:story-clicked', onStoryClicked);
    };
  }, [tourStep]);

  if (!activeHint) return null;

  return (
    <Hint
      key={activeHint.selector}
      selector={activeHint.selector}
      title={activeHint.title}
      body={activeHint.body}
      side={activeHint.side}
      offsetY={activeHint.offsetY || 0}
      bodyMarginTop={activeHint.bodyMarginTop}
      bodyAnimation={activeHint.bodyAnimation}
      progressText={activeHint.progressText}
      mobileWidth={activeHint.mobileWidth}
      centerOnMobile={activeHint.centerOnMobile}
      anchorBelowTargetOnMobile={activeHint.anchorBelowTargetOnMobile}
      buttonBg={activeHint.buttonBg}
      buttonFontSize={activeHint.buttonFontSize}
      buttonScale={activeHint.buttonScale}
      buttonPadding={activeHint.buttonPadding}
      buttonMinHeight={activeHint.buttonMinHeight}
      buttonMarginTop={activeHint.buttonMarginTop}
      onDismiss={() => dismiss(activeHint.nextStep)}
    />
  );
};

export default OnboardingTour;
