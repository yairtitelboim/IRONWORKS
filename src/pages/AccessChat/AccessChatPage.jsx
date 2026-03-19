import React, { useEffect, useRef, useState } from 'react';
import './AccessChatPage.css';

const OPENING_CHIPS = ['Site selection', 'Research', 'Investment', 'Development'];
const ACCESS_SESSION_STORAGE_KEY = 'switchyard_access_session_id';

const createAccessSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `acc_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `acc_${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
};

const getOrCreateAccessSessionId = () => {
  if (typeof window === 'undefined') return createAccessSessionId();

  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get('access_session_id') || '').trim();
    if (fromUrl) {
      window.sessionStorage.setItem(ACCESS_SESSION_STORAGE_KEY, fromUrl);
      return fromUrl;
    }

    const fromStorage = String(window.sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY) || '').trim();
    if (fromStorage) return fromStorage;

    const created = createAccessSessionId();
    window.sessionStorage.setItem(ACCESS_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return createAccessSessionId();
  }
};

const ACCESS_FALLBACK_REPLIES = {
  'Site selection': "Where in Texas? And are you working around a specific substation, transmission path, or just a region?",
  Research: "What are you trying to validate: operator exposure, market buildout, tenant activity, or power strategy?",
  Investment: "What are you underwriting: a market, an operator, or a specific site thesis?",
  Development: "What are you actually trying to build — a campus, an expansion, or a first site into a market?"
};

const ACCESS_CTA_USER_TURN_THRESHOLD = 3;
const VAGUE_TURN_VALUES = new Set([
  'investment',
  'research',
  'site selection',
  'siting',
  'power',
  'land',
  'market',
  'texas',
  'houston',
  'dallas',
  'development'
]);

const getMapUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const nextParams = new URLSearchParams();
  const ref = params.get('ref');
  const user = params.get('user');
  const accessSessionId = getOrCreateAccessSessionId();
  if (ref) nextParams.set('ref', ref);
  if (user) nextParams.set('user', user);
  if (accessSessionId) nextParams.set('access_session_id', accessSessionId);
  const query = nextParams.toString();
  return query ? `/?${query}` : '/';
};

const buildFallbackReply = ({ messages, userMessage, userMeta }) => {
  const assistantCount = messages.filter((message) => message.role === 'assistant').length;
  const userCount = messages.filter((message) => message.role === 'user').length + 1;
  const trimmedUserText = String(userMessage?.content || '').trim();
  const normalizedUserText = trimmedUserText.toLowerCase();
  const chip = userMeta?.chip_selected || '';
  const isVagueTurn = !trimmedUserText || trimmedUserText.length <= 12 || VAGUE_TURN_VALUES.has(normalizedUserText);

  if (userCount >= ACCESS_CTA_USER_TURN_THRESHOLD) {
    if (chip === 'Site selection') {
      return `That is enough context. I'll bias the map toward ${trimmedUserText || 'that market'}, site filters, and the relevant power constraints. Open the map.`;
    }
    if (chip === 'Research') {
      return `That's enough. I'll weight the map toward power strategy, operator exposure, and where the buildout is actually going. Open the map.`;
    }
    if (chip === 'Investment') {
      return `That is enough context. I'll bias the map toward ${trimmedUserText || 'that thesis'}, operator quality, and market-level signal. Open the map.`;
    }
    if (chip === 'Development') {
      return `That's enough. I'll weight the map toward ${trimmedUserText || 'that build plan'}, siting constraints, and where development is actually moving. Open the map.`;
    }
    return `That is enough context. Open the map and I’ll bias it toward what you’re trying to solve.`;
  }

  if (assistantCount <= 1 && chip) {
    return ACCESS_FALLBACK_REPLIES[chip] || "What exactly are you trying to solve in Texas?";
  }

  if (chip === 'Site selection') {
    if (isVagueTurn) {
      return 'Be more specific. Are you screening a broad region, or trying to anchor around a substation, transmission path, or known utility pocket?';
    }
    return `${trimmedUserText || 'That market'} is workable. Are you screening the broader area, or trying to anchor around a specific substation or transmission corridor?`;
  }

  if (chip === 'Research') {
    if (isVagueTurn) {
      return 'That is still too broad. Are you trying to understand operator exposure, tenant concentration, or the power strategy behind the builds?';
    }
    return `Understood. In ${trimmedUserText || 'that area'}, are you trying to validate operator activity, tenant exposure, or the power strategy behind the buildout?`;
  }

  if (chip === 'Investment') {
    if (isVagueTurn) {
      return 'What kind of exposure — debt, equity, or are you siting something?';
    }
    return `Understood. Is ${trimmedUserText || 'that'} an underwriting question about market demand, operator execution, or a specific site thesis?`;
  }

  if (chip === 'Development') {
    if (isVagueTurn) {
      return 'Development how — a new campus, a powered shell, or an expansion into an existing market?';
    }
    return `Understood. Is ${trimmedUserText || 'that'} about finding a buildable market, clearing power, or sequencing a development pipeline?`;
  }

  return `${trimmedUserText || 'That'} is enough to start. What is the actual constraint: power, land, timing, or tenant demand?`;
};

const AccessChatPage = () => {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'assistant-opening',
      role: 'assistant',
      content: 'What are you working on in Texas?',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [showOpeningChips, setShowOpeningChips] = useState(true);
  const [chipsReady, setChipsReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [openingQuestionReady, setOpeningQuestionReady] = useState(false);
  const [subtitleReady, setSubtitleReady] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [firstTurnMeta, setFirstTurnMeta] = useState(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [accessSessionId] = useState(() => getOrCreateAccessSessionId());
  const threadRef = useRef(null);
  const threadEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const skipNextAutoScrollRef = useRef(false);
  const chipsTimerRef = useRef(null);
  const introTimerRef = useRef(null);
  const openingQuestionTimerRef = useRef(null);
  const subtitleTimerRef = useRef(null);

  useEffect(() => {
    subtitleTimerRef.current = window.setTimeout(() => {
      setSubtitleReady(true);
      subtitleTimerRef.current = null;
    }, 1600);

    introTimerRef.current = window.setTimeout(() => {
      setIntroReady(true);
      introTimerRef.current = null;
    }, 1600);

    openingQuestionTimerRef.current = window.setTimeout(() => {
      setOpeningQuestionReady(true);
      openingQuestionTimerRef.current = null;
    }, 3100);

    chipsTimerRef.current = window.setTimeout(() => {
      setChipsReady(true);
      chipsTimerRef.current = null;
    }, 3425);

    return () => {
      if (subtitleTimerRef.current) {
        window.clearTimeout(subtitleTimerRef.current);
      }
      if (introTimerRef.current) {
        window.clearTimeout(introTimerRef.current);
      }
      if (openingQuestionTimerRef.current) {
        window.clearTimeout(openingQuestionTimerRef.current);
      }
      if (chipsTimerRef.current) {
        window.clearTimeout(chipsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => () => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (!shouldAutoScroll) return;
    if (!threadEndRef.current) return;
    const scrollToEnd = () => {
      threadEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    };

    requestAnimationFrame(scrollToEnd);
    const timeoutId = window.setTimeout(scrollToEnd, 180);

    return () => window.clearTimeout(timeoutId);
  }, [messages, isTyping, shouldAutoScroll]);

  const handleThreadScroll = () => {
    if (!threadRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = threadRef.current;
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
    setShouldAutoScroll(distanceFromBottom < 72);
  };

  const centerLatestAssistantReply = () => {
    if (window.innerWidth > 768) return;
    if (!threadRef.current) return;
    const threadNode = threadRef.current;
    const replyNodes = threadNode.querySelectorAll('.access-chat-message--post-opening');
    const lastReply = replyNodes[replyNodes.length - 1];
    if (!lastReply) return;
    const scrollToReply = () => {
      const replyTop = lastReply.offsetTop;
      const replyHeight = lastReply.offsetHeight;
      const viewportHeight = threadNode.clientHeight;
      const maxScrollTop = Math.max(0, threadNode.scrollHeight - viewportHeight);
      const centeredTop = replyTop - Math.max(0, (viewportHeight - replyHeight) / 2);
      const nextTop = Math.max(0, Math.min(centeredTop, maxScrollTop));
      threadNode.scrollTo({
        top: nextTop,
        behavior: 'smooth'
      });
    };

    requestAnimationFrame(scrollToReply);
    window.setTimeout(scrollToReply, 180);
  };

  const userTurnCount = messages.filter((message) => message.role === 'user').length;
  const postOpeningAssistantCount = messages.filter(
    (message) => message.role === 'assistant' && message.id !== 'assistant-opening'
  ).length;
  const showMapCta = userTurnCount >= ACCESS_CTA_USER_TURN_THRESHOLD;
  const mapUrl = getMapUrl();
  const shouldCenterFirstReply = userTurnCount === 1 && postOpeningAssistantCount >= 1;

  useEffect(() => {
    if (!shouldCenterFirstReply) return;
    centerLatestAssistantReply();
  }, [shouldCenterFirstReply]);

  const nudgeThreadDownAfterReply = () => {
    if (window.innerWidth > 768) return;
    if (!threadRef.current) return;
    const threadNode = threadRef.current;
    const nudge = () => {
      const targetTop = Math.max(0, threadNode.scrollTop - 190);
      threadNode.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });
    };

    requestAnimationFrame(nudge);
    window.setTimeout(nudge, 180);
    window.setTimeout(nudge, 360);
  };

  const handleSubmit = async (overrideText = null, meta = null) => {
    const trimmed = (overrideText ?? draft).trim();
    if (!trimmed || isTyping) return;

    const userMeta = meta || firstTurnMeta || { intake_method: 'manual' };
    const isFirstChipTurn =
      userMeta?.intake_method === 'chip' &&
      messages.filter((message) => message.role === 'user').length === 0;
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      meta: userMeta
    };

    if (showOpeningChips) {
      setShowOpeningChips(false);
    }
    if (!composerVisible) {
      setComposerVisible(true);
    }
    if (userMeta && !firstTurnMeta) {
      setFirstTurnMeta(userMeta);
    }

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setIsTyping(true);

    try {
      const payloadMessages = [...messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content
      }));

      const urlParams = new URLSearchParams(window.location.search);
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          session_id: accessSessionId,
          messages: payloadMessages,
          ref: urlParams.get('ref') || '',
          user: urlParams.get('user') || '',
          intake_method: userMeta?.intake_method || '',
          chip_selected: userMeta?.chip_selected || ''
        })
      });
      window.clearTimeout(requestTimeout);

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || 'chat route unavailable');
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply
        }
      ]);
      if (window.innerWidth <= 768) {
        skipNextAutoScrollRef.current = true;
      }
      centerLatestAssistantReply();
      if (isFirstChipTurn) {
        nudgeThreadDownAfterReply();
      }
      if (window.innerWidth <= 768) {
        setShowScrollHint(true);
        window.setTimeout(() => setShowScrollHint(false), 1800);
      }
    } catch (error) {
      const fallbackReply = buildFallbackReply({
        messages,
        userMessage,
        userMeta
      });

      typingTimerRef.current = window.setTimeout(() => {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: fallbackReply,
            isPlaceholder: true
          }
        ]);
        if (window.innerWidth <= 768) {
          skipNextAutoScrollRef.current = true;
        }
        centerLatestAssistantReply();
        if (isFirstChipTurn) {
          nudgeThreadDownAfterReply();
        }
        if (window.innerWidth <= 768) {
          setShowScrollHint(true);
          window.setTimeout(() => setShowScrollHint(false), 1800);
        }
        setIsTyping(false);
        typingTimerRef.current = null;
      }, 700);
      return;
    }

    setIsTyping(false);
  };

  const handleChipSelect = (label) => {
    handleSubmit(label, {
      intake_method: 'chip',
      chip_selected: label,
    });
  };

  return (
    <div className="access-chat-page">
      <div className={`access-chat-shell${composerVisible ? ' access-chat-shell--composer' : ''}`}>
        <header className="access-chat-header">
          <div className="access-chat-badge">Switchyard</div>
          <div className="access-chat-title-wrap">
            <h1 className="access-chat-title">
              <span className="access-chat-title-line access-chat-title-line--first">Texas infrastructure</span>
              <span className="access-chat-title-line access-chat-title-line--second">intelligence.</span>
            </h1>
            {subtitleReady ? (
              <p className="access-chat-subtitle">
                239 facilities. 40,491 MW.
              </p>
            ) : null}
          </div>
        </header>

        {introReady && userTurnCount === 0 ? (
          <section className="access-chat-intro">
            <p>
              <span>This map is invite-only.</span>
              <span className="access-chat-intro-followup">WAHA decides who sees it.</span>
            </p>
          </section>
        ) : null}

        <main
          ref={threadRef}
          className={`access-chat-thread${shouldCenterFirstReply ? ' access-chat-thread--first-reply' : ''}`}
          style={{ paddingBottom: composerVisible ? '156px' : '88px' }}
          onScroll={handleThreadScroll}
        >
          {shouldCenterFirstReply ? (
            <div className="access-chat-thread-top-spacer" aria-hidden="true" />
          ) : null}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`access-chat-message access-chat-message--${message.role}${message.role === 'assistant' && index > 0 ? ' access-chat-message--post-opening' : ''}`}
            >
              {message.id !== 'assistant-opening' || openingQuestionReady ? (
                <div className="access-chat-bubble">
                  {message.role === 'assistant' ? (
                    <div className="access-chat-assistant-label">WAHA</div>
                  ) : null}
                  <p>{message.content}</p>
                </div>
              ) : null}
              {message.id === 'assistant-opening' && showOpeningChips && chipsReady ? (
                <div className="access-chat-chips" role="group" aria-label="Suggested prompts">
                  {OPENING_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="access-chat-chip"
                      onClick={() => handleChipSelect(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {isTyping ? (
            <div className="access-chat-message access-chat-message--assistant">
              <div className="access-chat-bubble access-chat-bubble--typing" aria-label="Assistant is typing">
                <div className="access-chat-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : null}
          {showMapCta ? (
            <div className="access-chat-cta-wrap">
              <a className="access-chat-map-cta" href={mapUrl}>
                Open the map
              </a>
            </div>
          ) : null}
          <div
            ref={threadEndRef}
            className="access-chat-thread-end"
            style={{ height: composerVisible ? '240px' : '1px' }}
            aria-hidden="true"
          />
        </main>

        {composerVisible ? (
          <footer className="access-chat-input-bar">
            <div className="access-chat-input-inner">
              <label className="access-chat-input-wrap" htmlFor="access-chat-input">
                <textarea
                  id="access-chat-input"
                  value={draft}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (showOpeningChips && nextValue.trim()) {
                      setShowOpeningChips(false);
                      setComposerVisible(true);
                      if (!firstTurnMeta) {
                        setFirstTurnMeta({ intake_method: 'manual' });
                      }
                    }
                    setDraft(nextValue);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSubmit(null, firstTurnMeta || { intake_method: 'manual' });
                    }
                  }}
                  placeholder="Type your reply..."
                  rows={1}
                />
              </label>
              <button
                type="button"
                className="access-chat-send"
                disabled={!draft.trim() || isTyping}
                onClick={() => handleSubmit(null, firstTurnMeta || { intake_method: 'manual' })}
              >
                Send
              </button>
            </div>
          </footer>
        ) : null}
        {showScrollHint ? (
          <div className="access-chat-scroll-hint">Scroll down</div>
        ) : null}
      </div>
    </div>
  );
};

export default AccessChatPage;
