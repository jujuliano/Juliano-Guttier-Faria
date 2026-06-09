import React, { useState, useEffect } from 'react';
import { AppConfig } from './types';
import { DEFAULT_CONFIG, parseUrlConfig, transformDriveImageUrl } from './utils/helpers';
import VideoPlayer from './components/VideoPlayer';
import ImageOverlay from './components/ImageOverlay';
import ClockOverlay from './components/ClockOverlay';
import NewsTicker from './components/NewsTicker';
import SettingsPanel from './components/SettingsPanel';
import { Settings, Sparkles, Tv, HelpCircle, Info, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'v_with_dropbox_overlay_cfg';

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => {
    let baseConfig = DEFAULT_CONFIG;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        baseConfig = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }

    // Overwrite config from url search parameters if they exist
    if (typeof window !== 'undefined' && window.location.search) {
      return parseUrlConfig(window.location.href, baseConfig);
    }

    return baseConfig;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const [showWelcomeTip, setShowWelcomeTip] = useState<boolean>(true);
  const [liveTickerText, setLiveTickerText] = useState<string>('');
  const [liveImageLink, setLiveImageLink] = useState<string>('');
  const [liveYoutubeUrl, setLiveYoutubeUrl] = useState<string>('');
  const [liveBgImageUrl, setLiveBgImageUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-save config when it modifications are made
  const handleConfigChange = (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to save to web storage', e);
    }
  };

  // Reset to initial settings
  const handleResetConfig = () => {
    if (window.confirm('Deseja mesmo redefinir todas as configurações para o padrão original?')) {
      setConfig(DEFAULT_CONFIG);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      } catch (e) {
        console.error('Failed to save on reset', e);
      }
    }
  };

  // Toggle standard browser fullscreen with fallback support
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen action failed or was blocked by browser/sandboxing context:', err);
      // Fallback: toggle internal state in case document.fullscreenElement is blocked
      setIsFullscreen(prev => !prev);
    }
  };

  // Double-click handler to toggle or exit fullscreen mode
  const handleDoubleClickScreen = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only toggle fullscreen if the user didn't double-click inside settings panel, buttons, or inputs
    const target = e.target as HTMLElement;
    if (
      target.closest('#settings-container-panel') || 
      target.closest('#floating-hud-panel') || 
      target.closest('#initial-welcome-toast') ||
      target.closest('#ticker-badge') ||
      target.closest('#ticker-aside-clock') ||
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'SELECT'
    ) {
      return;
    }
    toggleFullscreen();
  };

  // Synchronize state with standard fullscreen events and hotkey listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Escape/Esc hotkey listener for absolute safety
    const handleKeyDown = (e: KeyboardEvent) => {
      // Keep UI active on any key stroke
      setIsIdle(false);

      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          e.preventDefault();
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          e.preventDefault();
        } else {
          setIsFullscreen(false);
        }
      } else if (!isSettingsOpen) {
        // Safe triggers to open settings panel via TV box remote OK button or simple key shortcuts
        if (
          e.key === 'Enter' || 
          e.key === 's' || e.key === 'S' || 
          e.key === 'm' || e.key === 'M' || 
          e.key === 'c' || e.key === 'C'
        ) {
          setIsSettingsOpen(true);
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Track mouse movement to hide UI controls for an absolute immersive "somente o vídeo" feel
  useEffect(() => {
    if (!config.hideUIWhenIdle || isSettingsOpen) {
      setIsIdle(false);
      return;
    }

    let tId: NodeJS.Timeout;
    
    const triggerActive = () => {
      setIsIdle(false);
      clearTimeout(tId);
      tId = setTimeout(() => {
        setIsIdle(true);
      }, 3500); // Wait 3.5 seconds before hiding controls
    };

    window.addEventListener('mousemove', triggerActive);
    window.addEventListener('keydown', triggerActive);
    window.addEventListener('mousedown', triggerActive);
    window.addEventListener('touchstart', triggerActive, { passive: true });
    window.addEventListener('click', triggerActive);
    
    triggerActive(); // Init

    return () => {
      window.removeEventListener('mousemove', triggerActive);
      window.removeEventListener('keydown', triggerActive);
      window.removeEventListener('mousedown', triggerActive);
      window.removeEventListener('touchstart', triggerActive);
      window.removeEventListener('click', triggerActive);
      clearTimeout(tId);
    };
  }, [config.hideUIWhenIdle, isSettingsOpen]);

  // Fetch letreiro dynamically from Google Drive txt file if enabled
  useEffect(() => {
    if (!config.useDriveTickerText || !config.tickerDriveFileUrl.trim()) {
      setLiveTickerText('');
      return;
    }

    let active = true;

    const fetchTickerText = () => {
      fetch(`/api/drive-text?url=${encodeURIComponent(config.tickerDriveFileUrl)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (active && data && typeof data.text === 'string') {
            setLiveTickerText(data.text);
          }
        })
        .catch((err) => {
          console.warn('Could not auto-fetch letreiro from Google Drive txt', err);
        });
    };

    fetchTickerText();

    // Query Google Drive text file every 30 seconds for dynamic TV updates
    const tInterval = setInterval(fetchTickerText, 30000);

    return () => {
      active = false;
      clearInterval(tInterval);
    };
  }, [config.useDriveTickerText, config.tickerDriveFileUrl]);

  // Fetch dynamic website redirect link from Google Drive txt file if enabled
  useEffect(() => {
    if (!config.useDriveImageLink || !config.imageLinkDriveFileUrl.trim()) {
      setLiveImageLink('');
      return;
    }

    let active = true;

    const fetchImageLink = () => {
      fetch(`/api/drive-text?url=${encodeURIComponent(config.imageLinkDriveFileUrl)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (active && data && typeof data.text === 'string') {
            setLiveImageLink(data.text.trim());
          }
        })
        .catch((err) => {
          console.warn('Could not auto-fetch target website from Google Drive txt', err);
        });
    };

    fetchImageLink();

    // Query Google Drive text file every 30 seconds for dynamic redirects
    const tInterval = setInterval(fetchImageLink, 30000);

    return () => {
      active = false;
      clearInterval(tInterval);
    };
  }, [config.useDriveImageLink, config.imageLinkDriveFileUrl]);

  // Fetch dynamic YouTube video URL from Google Drive txt file if enabled
  useEffect(() => {
    if (!config.useDriveYoutubeUrl || !config.youtubeDriveFileUrl.trim()) {
      setLiveYoutubeUrl('');
      return;
    }

    let active = true;

    const fetchYoutubeUrl = () => {
      fetch(`/api/drive-text?url=${encodeURIComponent(config.youtubeDriveFileUrl)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (active && data && typeof data.text === 'string' && data.text.trim()) {
            setLiveYoutubeUrl(data.text.trim());
          }
        })
        .catch((err) => {
          console.warn('Could not auto-fetch YouTube URL from Google Drive txt', err);
        });
    };

    fetchYoutubeUrl();

    // Query Google Drive text file every 30 seconds for dynamic video updates
    const tInterval = setInterval(fetchYoutubeUrl, 30000);

    return () => {
      active = false;
      clearInterval(tInterval);
    };
  }, [config.useDriveYoutubeUrl, config.youtubeDriveFileUrl]);

  // Fetch dynamic Background Image URL from Google Drive txt file if enabled
  useEffect(() => {
    if (!config.useDriveBackgroundImageUrl || !config.backgroundImageDriveFileUrl.trim()) {
      setLiveBgImageUrl('');
      return;
    }

    let active = true;

    const fetchBgImageUrl = () => {
      fetch(`/api/drive-text?url=${encodeURIComponent(config.backgroundImageDriveFileUrl)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (active && data && typeof data.text === 'string' && data.text.trim()) {
            setLiveBgImageUrl(data.text.trim());
          }
        })
        .catch((err) => {
          console.warn('Could not auto-fetch Background Image URL from Google Drive txt', err);
        });
    };

    fetchBgImageUrl();

    // Query Google Drive text file every 30 seconds for dynamic bg image updates
    const tInterval = setInterval(fetchBgImageUrl, 30000);

    return () => {
      active = false;
      clearInterval(tInterval);
    };
  }, [config.useDriveBackgroundImageUrl, config.backgroundImageDriveFileUrl]);

  // Read state to check if we are using default/blank links
  const isUsingDefaultMock = config.dropboxUrl.includes('unsplash.com') || config.dropboxUrl.includes('crown_watermark');

  const resolvedBgImage = config.useDriveBackgroundImageUrl && liveBgImageUrl ? liveBgImageUrl : config.backgroundImageUrl;
  const directBgImageSrc = resolvedBgImage ? transformDriveImageUrl(resolvedBgImage) : '';

  return (
    <div 
      className={`relative w-screen h-screen overflow-hidden bg-black select-none font-sans ${config.tvMode ? 'tv-mode-active' : ''}`} 
      id="main-canvas"
      onDoubleClick={handleDoubleClickScreen}
      style={{
        '--tv-scale': (config.tvFontScale || 100) / 100,
      } as React.CSSProperties}
    >
      
      {/* 1. Dynamic Immersive YouTube iframe or Google Drive Background Image */}
      {config.backgroundType === 'image' ? (
        <div className="absolute inset-0 w-full h-full bg-black overflow-hidden z-0" id="image-background-wrapper">
          {directBgImageSrc ? (
            <img
              src={directBgImageSrc}
              referrerPolicy="no-referrer"
              alt="Fundo"
              className="w-full h-full object-cover"
              id="bg-image-element"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm">
              <span id="no-bg-image-text">Nenhuma imagem de fundo configurada</span>
            </div>
          )}
        </div>
      ) : (
        <VideoPlayer
          youtubeUrl={config.useDriveYoutubeUrl && liveYoutubeUrl ? liveYoutubeUrl : config.youtubeUrl}
          autoplay={config.videoAutoplay}
          loop={config.videoLoop}
          muted={config.videoMuted}
          controls={config.videoControls}
        />
      )}

      {/* 2. Brand Watermark Overlay from Google Drive folder */}
      <ImageOverlay
        driveFolderUrl={config.driveFolderUrl}
        corner={config.corner}
        maxWidth={config.imageMaxWidth}
        maxHeight={config.imageMaxHeight}
        opacity={config.imageOpacity}
        clickable={config.imageClickable}
        link={config.useDriveImageLink && liveImageLink ? liveImageLink : config.imageLink}
        borderRadius={config.imageBorderRadius}
        margin={config.imageMargin}
        isTickerActive={config.showTicker}
        slideshowInterval={config.slideshowInterval}
        slideshowPauseTime={config.slideshowPauseTime}
        imageAnimationType={config.imageAnimationType}
        imageAnimationDuration={config.imageAnimationDuration}
      />

      {/* 2.5. Digital Clock Overlay for Mídia Indoor */}
      <ClockOverlay 
        showClock={config.showClock}
        corner={config.clockCorner}
        size={config.clockSize}
        margin={config.imageMargin}
        isTickerActive={config.showTicker}
      />

      {/* 2.6. Infinite Letreiro Digital News Ticker */}
      <NewsTicker 
        showTicker={config.showTicker}
        text={config.useDriveTickerText && liveTickerText ? liveTickerText : config.tickerText}
        speed={config.tickerSpeed}
        bgColor={config.tickerBgColor}
        textColor={config.tickerTextColor}
        fontSize={config.tickerFontSize}
      />

      {/* 3. Auto-hiding Translucent Header Control HUD */}
      <AnimatePresence>
        {!isIdle && (
          <motion.div
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none"
            id="floating-hud-panel"
          >
            <div className="glassmorphism py-2 px-4 rounded-full flex items-center gap-4 shadow-xl pointer-events-auto border border-zinc-700/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-xs font-mono font-medium text-zinc-300 tracking-wide truncate max-w-[120px] md:max-w-[180px]">
                  {isSettingsOpen ? 'Configurando...' : 'Vídeo Ativo'}
                </span>
              </div>
              <div className="h-4 w-[1px] bg-zinc-800" />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-all bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full cursor-pointer hover:bg-zinc-805 hover:scale-105 active:scale-95 shadow-md font-sans"
                id="hud-trigger-settings"
              >
                <Settings size={13} className="text-red-400 rotate-45" />
                <span>Painel de Ajustes</span>
              </button>
              <div className="h-4 w-[1px] bg-zinc-800" />
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-all bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full cursor-pointer hover:bg-zinc-805 hover:scale-105 active:scale-95 shadow-md font-sans"
                id="hud-trigger-fullscreen"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 size={13} className="text-blue-400" />
                    <span>Sair da Tela Cheia</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={13} className="text-blue-400" />
                    <span>Tela Cheia</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Extra Interactive Hint Indicator shown only on first load so users know where the settings are */}
      <AnimatePresence>
        {showWelcomeTip && !isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 left-5 z-20 max-w-sm glassmorphism p-4 rounded-2xl shadow-2xl border border-zinc-700/50 pointer-events-auto"
            id="initial-welcome-toast"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400 shrink-0 border border-red-500/20">
                <Sparkles size={16} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">Seu Quiosque de Vídeo está Pronto!</h4>
                <p className="text-xs text-zinc-400 leading-normal">
                  Este app exibe o seu vídeo em tela cheia com uma imagem do Dropbox no canto.
                  Use o botão acima para mudar o vídeo ou colocar sua própria imagem!
                </p>
                {isUsingDefaultMock && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/15 py-1 px-2 rounded-md leading-relaxed mt-1">
                    💡 Exibindo imagens de exemplo. Clique no painel para colar seu link do <strong>Dropbox</strong>.
                  </p>
                )}
                <div className="flex gap-2.5 pt-1.5">
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-xs font-semibold text-zinc-950 bg-zinc-200 hover:bg-white px-3 py-1 rounded-lg cursor-pointer transition-colors"
                  >
                    Abrir Configurações
                  </button>
                  <button
                    onClick={() => setShowWelcomeTip(false)}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 cursor-pointer transition-colors"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Clean, Full control drawer container */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            {/* Backdrop dark blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/70 z-40 backdrop-blur-xs pointer-events-auto cursor-pointer"
              id="settings-drawer-backdrop"
            />
            
            {/* Drawer widget panel */}
            <SettingsPanel
              config={config}
              onChange={handleConfigChange}
              onReset={handleResetConfig}
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

