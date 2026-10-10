import { useState, useEffect, useCallback } from 'react';

interface Theme {
  name: string;
  primary: string;
  secondary: string;
  glow: string;
  bgDark: string;
  bgPanel: string;
  text: string;
  border: string;
}

const themes: Record<string, Theme> = {
  'classic': {
    name: 'Classic Matrix',
    primary: '#00ff00',
    secondary: '#00ffff',
    glow: '#00ff00',
    bgDark: '#000000',
    bgPanel: 'rgba(0, 20, 0, 0.18)',
    text: '#00ffff',
    border: '#00ff00'
  },
  'cyber-purple': {
    name: 'Cyber Purple',
    primary: '#bf00ff',
    secondary: '#ff00ff',
    glow: '#bf00ff',
    bgDark: '#0a000f',
    bgPanel: 'rgba(20, 0, 30, 0.18)',
    text: '#ff66ff',
    border: '#bf00ff'
  },
  'neon-blue': {
    name: 'Neon Blue',
    primary: '#00bfff',
    secondary: '#00ffff',
    glow: '#00bfff',
    bgDark: '#000a14',
    bgPanel: 'rgba(0, 15, 30, 0.18)',
    text: '#66d9ff',
    border: '#00bfff'
  },
  'blood-red': {
    name: 'Blood Red',
    primary: '#ff0040',
    secondary: '#ff6680',
    glow: '#ff0040',
    bgDark: '#0f0000',
    bgPanel: 'rgba(30, 0, 10, 0.18)',
    text: '#ff8099',
    border: '#ff0040'
  },
  'gold-elite': {
    name: 'Gold Elite',
    primary: '#ffd700',
    secondary: '#ffea00',
    glow: '#ffd700',
    bgDark: '#0a0800',
    bgPanel: 'rgba(30, 25, 0, 0.18)',
    text: '#ffeb80',
    border: '#ffd700'
  },
  'toxic-orange': {
    name: 'Toxic Orange',
    primary: '#ff6600',
    secondary: '#ff9933',
    glow: '#ff6600',
    bgDark: '#0f0800',
    bgPanel: 'rgba(30, 15, 0, 0.18)',
    text: '#ffb366',
    border: '#ff6600'
  },
  'arctic-white': {
    name: 'Arctic White',
    primary: '#ffffff',
    secondary: '#e0e0e0',
    glow: '#ffffff',
    bgDark: '#0a0a0a',
    bgPanel: 'rgba(20, 20, 20, 0.18)',
    text: '#f0f0f0',
    border: '#ffffff'
  },
  'synthwave': {
    name: 'Synthwave',
    primary: '#ff00ff',
    secondary: '#00ffff',
    glow: '#ff00ff',
    bgDark: '#0d0221',
    bgPanel: 'rgba(25, 5, 50, 0.18)',
    text: '#00ffff',
    border: '#ff00ff'
  }
};

export default function PersistentThemeCustomizer() {
  const [currentTheme, setCurrentTheme] = useState('gold-elite');
  const [customPrimary, setCustomPrimary] = useState('#ffd700');
  const [customSecondary, setCustomSecondary] = useState('#ffea00');
  const [isMinimized, setIsMinimized] = useState(true);

  const applyTheme = useCallback((themeName: string) => {
    const theme = themes[themeName];
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--theme-glow', theme.glow);
    root.style.setProperty('--theme-bg-dark', theme.bgDark);
    root.style.setProperty('--theme-bg-panel', theme.bgPanel);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-border', theme.border);

    setCurrentTheme(themeName);
    localStorage.setItem('matrixHubTheme', themeName);
  }, []);

  const applyCustomTheme = useCallback((primary: string, secondary: string) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', primary);
    root.style.setProperty('--theme-secondary', secondary);
    root.style.setProperty('--theme-glow', primary);
    root.style.setProperty('--theme-border', primary);
    root.style.setProperty('--theme-text', secondary);

    setCurrentTheme('custom');
    localStorage.setItem('matrixHubTheme', 'custom');
    localStorage.setItem('matrixHubCustomPrimary', primary);
    localStorage.setItem('matrixHubCustomSecondary', secondary);
  }, []);

  useEffect(() => {
    // Load saved theme on mount
    const savedTheme = localStorage.getItem('matrixHubTheme') || 'gold-elite';
    const savedMinimized = localStorage.getItem('themeCustomizerMinimized');

    if (savedMinimized) {
      setIsMinimized(savedMinimized === 'true');
    }

    if (savedTheme === 'custom') {
      const customPrim = localStorage.getItem('matrixHubCustomPrimary') || '#00ff00';
      const customSec = localStorage.getItem('matrixHubCustomSecondary') || '#00ffff';
      setCustomPrimary(customPrim);
      setCustomSecondary(customSec);
      applyCustomTheme(customPrim, customSec);
    } else {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, [applyTheme, applyCustomTheme]);

  useEffect(() => {
    localStorage.setItem('themeCustomizerMinimized', isMinimized.toString());
  }, [isMinimized]);

  const handleCustomApply = () => {
    applyCustomTheme(customPrimary, customSecondary);
  };

  const themePresets = [
    { key: 'classic', gradient: 'linear-gradient(135deg, #000 0%, #001a00 100%)', borderColor: '#00ff00', glowColor: '#00ff00' },
    { key: 'cyber-purple', gradient: 'linear-gradient(135deg, #0a000f 0%, #1e0030 100%)', borderColor: '#bf00ff', glowColor: '#bf00ff' },
    { key: 'neon-blue', gradient: 'linear-gradient(135deg, #000a14 0%, #001e3c 100%)', borderColor: '#00bfff', glowColor: '#00bfff' },
    { key: 'blood-red', gradient: 'linear-gradient(135deg, #0f0000 0%, #300010 100%)', borderColor: '#ff0040', glowColor: '#ff0040' },
    { key: 'gold-elite', gradient: 'linear-gradient(135deg, #0a0800 0%, #1e1900 100%)', borderColor: '#ffd700', glowColor: '#ffd700' },
    { key: 'toxic-orange', gradient: 'linear-gradient(135deg, #0f0800 0%, #301500 100%)', borderColor: '#ff6600', glowColor: '#ff6600' },
    { key: 'arctic-white', gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', borderColor: '#ffffff', glowColor: '#ffffff' },
    { key: 'synthwave', gradient: 'linear-gradient(135deg, #0d0221 0%, #190532 100%)', borderColor: '#ff00ff', glowColor: 'linear-gradient(45deg, #ff00ff, #00ffff)' },
  ];

  return (
    <div className={`persistent-theme-customizer ${isMinimized ? 'minimized' : ''}`}>
      <div className="customizer-header">
        <button
          className="minimize-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? "Expand Theme Customizer" : "Minimize Theme Customizer"}
          aria-label={isMinimized ? "Expand Theme Customizer" : "Minimize Theme Customizer"}
        >
          {isMinimized ? '▼' : '▲'}
        </button>
        <span className="customizer-title">THEME CUSTOMIZER</span>
        <span className="current-theme-name">
          {currentTheme === 'custom' ? 'Custom' : themes[currentTheme]?.name}
        </span>
      </div>

      {!isMinimized && (
        <div className="customizer-content">
          <p className="theme-subtitle">Choose your reality - customize your experience</p>

          <div className="theme-presets">
            {themePresets.map((preset) => (
              <button
                key={preset.key}
                className={`theme-preset ${currentTheme === preset.key ? 'active' : ''}`}
                onClick={() => applyTheme(preset.key)}
                aria-label={`Select ${themes[preset.key].name} theme`}
              >
                <div
                  className="theme-preview"
                  style={{
                    background: preset.gradient,
                    borderColor: preset.borderColor
                  }}
                >
                  <div
                    className="preview-glow"
                    style={{ background: preset.glowColor }}
                  ></div>
                </div>
                <span className="theme-preset-name">{themes[preset.key].name}</span>
              </button>
            ))}
          </div>

          <div className="custom-color-section">
            <h3>CUSTOM COLOR</h3>
            <div className="custom-color-controls">
              <div className="color-picker-wrapper">
                <label htmlFor="custom-primary">Primary:</label>
                <input
                  type="color"
                  id="custom-primary"
                  value={customPrimary}
                  onChange={(e) => setCustomPrimary(e.target.value)}
                />
              </div>
              <div className="color-picker-wrapper">
                <label htmlFor="custom-secondary">Secondary:</label>
                <input
                  type="color"
                  id="custom-secondary"
                  value={customSecondary}
                  onChange={(e) => setCustomSecondary(e.target.value)}
                />
              </div>
              <button className="custom-apply-btn" onClick={handleCustomApply}>
                APPLY CUSTOM
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .persistent-theme-customizer {
          position: sticky;
          top: var(--ticker-tape-height, 46px);
          z-index: var(--z-index-theme-customizer);
          background: var(--theme-bg-panel, rgba(0, 20, 0, 0.95));
          border-bottom: 2px solid var(--theme-primary, #00ff00);
          box-shadow: 0 4px 20px var(--theme-glow, rgba(0, 255, 0, 0.3));
          font-family: 'Courier New', monospace;
          backdrop-filter: blur(10px);
        }

        .customizer-header {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          gap: 12px;
        }

        .minimize-btn {
          background: transparent;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 4px 10px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 4px;
          transition: 0.2s;
          font-size: 12px;
        }

        .minimize-btn:hover {
          background: var(--theme-primary, #00ff00);
          color: black;
        }

        .customizer-title {
          font-size: 14px;
          color: var(--theme-primary, #00ff00);
          text-shadow: 0 0 8px var(--theme-glow, rgba(0, 255, 0, 0.5));
          flex: 1;
        }

        .current-theme-name {
          font-size: 12px;
          color: var(--theme-secondary, #00ffff);
          font-weight: bold;
        }

        .customizer-content {
          padding: 16px;
          border-top: 1px solid var(--theme-border, rgba(0, 255, 0, 0.3));
        }

        .theme-subtitle {
          text-align: center;
          color: var(--theme-text, #00ffff);
          font-size: 0.9rem;
          margin-bottom: 16px;
        }

        .theme-presets {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .theme-preset {
          cursor: pointer;
          text-align: center;
          transition: transform 0.2s;
          background: transparent;
          border: none;
          padding: 0;
          width: 100%;
        }

        .theme-preset:hover {
          transform: scale(1.05);
        }

        .theme-preset:focus {
          outline: 2px solid var(--theme-primary, #00ff00);
          outline-offset: 2px;
        }

        .theme-preset.active .theme-preview {
          box-shadow: 0 0 20px var(--theme-glow, rgba(0, 255, 0, 0.5)), 0 0 40px var(--theme-glow, rgba(0, 255, 0, 0.3));
        }

        .theme-preview {
          width: 100%;
          height: 60px;
          border: 2px solid;
          border-radius: 8px;
          margin-bottom: 6px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s;
        }

        .preview-glow {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          opacity: 0.8;
        }

        .theme-preset-name {
          font-size: 0.75rem;
          color: var(--theme-text, #00ffff);
        }

        .custom-color-section {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--theme-border, rgba(0, 255, 0, 0.3));
        }

        .custom-color-section h3 {
          text-align: center;
          margin: 0 0 12px 0;
          font-size: 0.95rem;
          color: var(--theme-primary, #00ff00);
        }

        .custom-color-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          align-items: end;
        }

        .color-picker-wrapper {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .color-picker-wrapper label {
          font-size: 0.8rem;
          color: var(--theme-text, #00ffff);
        }

        .color-picker-wrapper input[type="color"] {
          width: 100%;
          height: 36px;
          border: 2px solid var(--theme-border, #00ff00);
          border-radius: 5px;
          background: transparent;
          cursor: pointer;
        }

        .custom-apply-btn {
          grid-column: 1 / -1;
          background: black;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 8px 16px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 5px;
          transition: 0.2s;
          font-size: 12px;
          margin-top: 8px;
        }

        .custom-apply-btn:hover {
          background: var(--theme-primary, #00ff00);
          color: black;
        }

        @media (max-width: 768px) {
          .customizer-header {
            padding: 6px 12px;
          }

          .customizer-title {
            font-size: 12px;
          }

          .current-theme-name {
            font-size: 11px;
          }

          .customizer-content {
            padding: 12px;
          }

          .theme-presets {
            grid-template-columns: repeat(2, 1fr);
          }

          .custom-color-controls {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
