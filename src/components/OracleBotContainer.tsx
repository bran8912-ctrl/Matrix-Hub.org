import React, { useState, useEffect, useRef } from 'react';
import {
  buildBotAnswer,
  getGreeting,
  getMissionForPath,
  getModeForPath,
  getSuggestions,
  writeBotMemory,
  type BotMode,
} from '../lib/site-bot-engine';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: number;
}

export default function OracleBotContainer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [path, setPath] = useState('/');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mode: BotMode = getModeForPath(path);
  const mission = getMissionForPath(path);
  const persona = mode === 'profit' ? 'PROFIT CONCIERGE' : 'ORACLE CONCIERGE';

  useEffect(() => {
    if (typeof window !== 'undefined') setPath(window.location.pathname);
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ id: `bot-${Date.now()}`, text: getGreeting(path), isBot: true, timestamp: Date.now() }]);
    }
  }, [isOpen, messages.length, path]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [messages, isTyping]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || isTyping) return;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, text, isBot: false, timestamp: Date.now() }]);
    setInputValue('');
    setIsTyping(true);

    const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 500 + Math.random() * 500;
    setTimeout(() => {
      const { text: reply, topic } = buildBotAnswer(mode, text, { roomId: mode, path });
      writeBotMemory(mode, text, topic);
      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, text: reply, isBot: true, timestamp: Date.now() }]);
      setIsTyping(false);
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputValue);
    }
  };

  return (
    <>
      <style>{`
        @keyframes matrixRainBot { 0% { transform: translateY(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes oracleGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,0,0.5), 0 0 40px rgba(0,255,0,0.3); }
          50% { box-shadow: 0 0 30px rgba(0,255,0,0.8), 0 0 60px rgba(0,255,0,0.5); }
        }
        @keyframes oraclePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes fadeInMessage { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .oracle-bot-button { position: fixed; bottom: 24px; right: 24px; width: 64px; height: 64px; border-radius: 50%; background: rgba(0,0,0,0.95); border: 2px solid #00ff00; color: #00ff00; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 9998; transition: all 0.3s ease; animation: oracleGlow 2s infinite; padding: 0; }
        .oracle-bot-button:hover { transform: scale(1.1); border-color: #00ffff; }
        .oracle-bot-window { position: fixed; bottom: 100px; right: 24px; width: min(440px, calc(100vw - 48px)); height: min(620px, calc(100vh - 140px)); background: rgba(0,0,0,0.96); border: 2px solid #00ff00; border-radius: 12px; display: flex; flex-direction: column; z-index: 9999; box-shadow: 0 0 40px rgba(0,255,0,0.4), inset 0 0 60px rgba(0,255,0,0.05); backdrop-filter: blur(10px); font-family: 'Courier New', monospace; overflow: hidden; }
        .oracle-header { background: rgba(0,20,0,0.8); border-bottom: 2px solid #00ff00; padding: 16px; display: flex; align-items: center; justify-content: space-between; position: relative; }
        .oracle-header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #00ff00, transparent); animation: scanline 3s linear infinite; }
        .oracle-avatar { width: 48px; height: 48px; margin-right: 12px; }
        .oracle-title { flex: 1; }
        .oracle-title h3 { margin: 0; color: #00ff00; font-size: 18px; font-weight: bold; text-shadow: 0 0 10px rgba(0,255,0,0.8); letter-spacing: 2px; }
        .oracle-title .oracle-mission { font-weight: bold; letter-spacing: 1px; }
        .oracle-title p { margin: 4px 0 0; color: #00ffaa; font-size: 11px; opacity: 0.8; }
        .oracle-close { background: transparent; border: 1px solid #00ff00; color: #00ff00; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .oracle-close:hover { background: rgba(0,255,0,0.1); border-color: #00ffff; color: #00ffff; }
        .oracle-messages { flex: 1; overflow-y: auto; padding: 16px; position: relative; background: rgba(0,10,0,0.3); }
        .oracle-messages::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, transparent 1px, transparent 2px, rgba(0,255,0,0.03) 3px); pointer-events: none; z-index: 1; }
        .oracle-messages > * { position: relative; z-index: 2; }
        .oracle-message { margin-bottom: 16px; animation: fadeInMessage 0.3s ease-out; }
        .message-user { text-align: right; }
        .message-bot { text-align: left; }
        .message-bubble { display: inline-block; max-width: 92%; padding: 12px 16px; border-radius: 8px; font-size: 13px; line-height: 1.55; word-wrap: break-word; text-align: left; }
        .message-user .message-bubble { background: rgba(0,100,0,0.3); border: 1px solid #00ff00; color: #00ff00; }
        .message-bot .message-bubble { background: rgba(0,50,50,0.3); border: 1px solid #00ffaa; color: #00ffaa; }
        .bubble-head { color: #00ffff; font-weight: bold; letter-spacing: 1px; text-shadow: 0 0 8px rgba(0,255,255,0.6); }
        .bubble-rule { color: rgba(0,255,170,0.35); overflow: hidden; white-space: nowrap; }
        .typing-indicator { display: inline-flex; gap: 4px; padding: 12px 16px; background: rgba(0,50,50,0.3); border: 1px solid #00ffaa; border-radius: 8px; }
        .typing-dot { width: 8px; height: 8px; background: #00ffaa; border-radius: 50%; animation: oraclePulse 1.4s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        .oracle-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px 0; background: rgba(0,20,0,0.8); border-top: 1px solid rgba(0,255,0,0.3); }
        .oracle-chip { background: transparent; border: 1px solid rgba(0,255,0,0.5); color: #00ff99; border-radius: 12px; padding: 3px 10px; font-family: inherit; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .oracle-chip:hover { background: rgba(0,255,0,0.12); border-color: #00ffff; color: #00ffff; }
        .oracle-input-area { padding: 12px 16px 16px; background: rgba(0,20,0,0.8); display: flex; gap: 8px; }
        .oracle-input { flex: 1; background: rgba(0,0,0,0.7); border: 1px solid #00ff00; border-radius: 6px; padding: 12px; color: #00ff00; font-family: 'Courier New', monospace; font-size: 14px; outline: none; transition: all 0.2s; }
        .oracle-input::placeholder { color: rgba(0,255,0,0.5); }
        .oracle-input:focus { border-color: #00ffff; box-shadow: 0 0 10px rgba(0,255,255,0.3); }
        .oracle-send-btn { background: rgba(0,100,0,0.4); border: 1px solid #00ff00; border-radius: 6px; color: #00ff00; width: 48px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .oracle-send-btn:hover:not(:disabled) { background: rgba(0,150,0,0.5); border-color: #00ffff; color: #00ffff; }
        .oracle-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .oracle-footer { padding: 8px 16px; background: rgba(0,20,0,0.8); border-top: 1px solid rgba(0,255,0,0.3); font-size: 11px; color: rgba(0,255,0,0.6); display: flex; justify-content: space-between; align-items: center; }
        .oracle-footer a { color: #00ffaa; text-decoration: none; }
        .oracle-footer a:hover { color: #00ffff; text-decoration: underline; }
        .matrix-rain-container { position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: 0.15; }
        .matrix-rain-char { position: absolute; color: #00ff00; font-family: 'Courier New', monospace; font-size: 12px; animation: matrixRainBot 8s linear infinite; }
        @media (max-width: 768px) {
          .oracle-bot-button { bottom: 16px; right: 16px; width: 56px; height: 56px; }
          .oracle-bot-window { bottom: 84px; right: 16px; left: 16px; width: calc(100vw - 32px); height: calc(100vh - 120px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .oracle-bot-button, .matrix-rain-char, .typing-dot, .oracle-header::before { animation: none; }
        }
        .oracle-bot-button:focus-visible, .oracle-close:focus-visible, .oracle-send-btn:focus-visible, .oracle-input:focus-visible, .oracle-chip:focus-visible { outline: 2px solid #00ffff; outline-offset: 2px; }
      `}</style>

      <button className="oracle-bot-button" onClick={() => setIsOpen(!isOpen)} aria-label="Open Oracle Concierge chat" aria-expanded={isOpen} title="Ask the Concierge">
        <OracleHeadSVG />
      </button>

      {isOpen && (
        <div className="oracle-bot-window" role="dialog" aria-label={`${persona} chat`}>
          <MatrixRain />

          <div className="oracle-header">
            <div className="oracle-avatar"><OracleHeadSVG /></div>
            <div className="oracle-title">
              <h3>{persona}</h3>
              <p className="oracle-mission">MISSION: {mission.title}</p>
            </div>
            <button className="oracle-close" onClick={() => setIsOpen(false)} aria-label="Close Oracle Chat">×</button>
          </div>

          <div className="oracle-messages" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`oracle-message ${m.isBot ? 'message-bot' : 'message-user'}`}>
                <div className="message-bubble">
                  {m.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line.startsWith('▌') ? (
                        <span className="bubble-head">{line}</span>
                      ) : line.startsWith('─') ? (
                        <span className="bubble-rule">{line}</span>
                      ) : (
                        line
                      )}
                      {i < m.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="oracle-message message-bot">
                <div className="typing-indicator"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="oracle-chips" role="group" aria-label="Suggested prompts">
            {getSuggestions(path).map((s) => (
              <button key={s} className="oracle-chip" onClick={() => send(s)} disabled={isTyping}>{s}</button>
            ))}
          </div>

          <div className="oracle-input-area">
            <input
              type="text"
              className="oracle-input"
              placeholder={mode === 'profit' ? 'Ask about growth & monetization...' : 'Say "start mission" or ask...'}
              value={inputValue}
              maxLength={500}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message input"
            />
            <button className="oracle-send-btn" onClick={() => send(inputValue)} disabled={!inputValue.trim() || isTyping} aria-label="Send message">➤</button>
          </div>

          <div className="oracle-footer">
            <span>🔒 Never share private keys</span>
            <div>
              <a href="#help" onClick={(e) => { e.preventDefault(); send('help'); }}>Help</a>
              {' • '}
              <a href="https://github.com/bran8912-ctrl/Matrix-Hub.org/issues" target="_blank" rel="noopener noreferrer">Report</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OracleHeadSVG() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <defs>
        <radialGradient id="oracleGlowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff00" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#00ff00" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00ff00" stopOpacity="0" />
        </radialGradient>
        <filter id="digitalGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#oracleGlowGrad)" opacity="0.6" />
      <circle cx="50" cy="45" r="28" fill="none" stroke="#00ff00" strokeWidth="2" filter="url(#digitalGlow)" />
      <rect x="40" y="38" width="6" height="10" fill="#00ff00" opacity="0.9" filter="url(#digitalGlow)" />
      <rect x="54" y="38" width="6" height="10" fill="#00ff00" opacity="0.9" filter="url(#digitalGlow)" />
      <line x1="38" y1="41" x2="48" y2="41" stroke="#00ffff" strokeWidth="1" opacity="0.6" />
      <line x1="52" y1="41" x2="62" y2="41" stroke="#00ffff" strokeWidth="1" opacity="0.6" />
      <line x1="38" y1="45" x2="48" y2="45" stroke="#00ffff" strokeWidth="1" opacity="0.6" />
      <line x1="52" y1="45" x2="62" y2="45" stroke="#00ffff" strokeWidth="1" opacity="0.6" />
      <path d="M 38 58 Q 50 62 62 58" fill="none" stroke="#00ff00" strokeWidth="2" filter="url(#digitalGlow)" />
      <circle cx="30" cy="35" r="2" fill="#00ff00" opacity="0.8"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" /></circle>
      <circle cx="70" cy="35" r="2" fill="#00ff00" opacity="0.8"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" /></circle>
      <path d="M 50 73 L 50 85" stroke="#00ff00" strokeWidth="1.5" opacity="0.6" />
      <circle cx="50" cy="85" r="3" fill="none" stroke="#00ff00" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function MatrixRain() {
  const [chars, setChars] = useState<Array<{ char: string; left: number; delay: number }>>([]);

  useEffect(() => {
    const matrixChars = 'アイウエオカキクケコサシスセソタチツテト01';
    const columns = 12;
    setChars(
      Array.from({ length: columns }, (_, i) => ({
        char: matrixChars[Math.floor(Math.random() * matrixChars.length)],
        left: (i / columns) * 100,
        delay: Math.random() * 5,
      }))
    );
  }, []);

  return (
    <div className="matrix-rain-container" aria-hidden="true">
      {chars.map((c, i) => (
        <div key={i} className="matrix-rain-char" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }}>{c.char}</div>
      ))}
    </div>
  );
}
