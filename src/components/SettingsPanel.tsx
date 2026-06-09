import { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { PRESETS, generateConfigUrl } from '../utils/helpers';
import { 
  X, 
  Youtube, 
  Image as ImageIcon, 
  Settings, 
  RotateCcw, 
  Sliders, 
  Compass, 
  Check, 
  ExternalLink,
  HelpCircle,
  Video,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsPanelProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({
  config,
  onChange,
  onReset,
  isOpen,
  onClose,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'overlay' | 'indoor'>('video');
  const [copiedLink, setCopiedLink] = useState(false);

  // TV Remote Keyboard D-pad focus & navigation manager
  useEffect(() => {
    if (!isOpen || !config.dpadNavigation) return;

    let activeIndex = -1;

    const handleRemoteKeys = (e: KeyboardEvent) => {
      const panel = document.getElementById('settings-container-panel');
      if (!panel) return;

      // Find all visible, non-disabled interactive items
      const items = Array.from(
        panel.querySelectorAll(
          'button, input[type="text"], input[type="range"], input[type="color"], textarea, select'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if ((el as any).disabled) return false;
        // Don't focus the main close drawer button unless necessary to prevent annoying jumps
        if (el.id === 'cmd-close-panel') return false;
        return true;
      }) as HTMLElement[];

      if (items.length === 0) return;

      // Sync index based on active element in browser
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && items.includes(activeEl)) {
        activeIndex = items.indexOf(activeEl);
      }

      const clearHighlights = () => {
        items.forEach((item) => item.classList.remove('dpad-focus'));
      };

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        clearHighlights();
        items[activeIndex].classList.add('dpad-focus');
        items[activeIndex].focus();
        items[activeIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        clearHighlights();
        items[activeIndex].classList.add('dpad-focus');
        items[activeIndex].focus();
        items[activeIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (activeIndex >= 0 && activeIndex < items.length) {
        const focusedItem = items[activeIndex];

        // Let range inputs sliders respond directly to ArrowLeft and ArrowRight keys
        if (focusedItem.tagName === 'INPUT' && (focusedItem as HTMLInputElement).type === 'range') {
          const rangeEl = focusedItem as HTMLInputElement;
          const min = Number(rangeEl.min) || 0;
          const max = Number(rangeEl.max) || 100;
          const step = Number(rangeEl.step) || 1;
          const currentVal = Number(rangeEl.value) || 0;

          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const newVal = Math.max(min, currentVal - step);
            // Universal React 19 safe prototype setter call
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
              nativeSetter.call(rangeEl, newVal);
              rangeEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const newVal = Math.min(max, currentVal + step);
            // Universal React 19 safe prototype setter call
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
              nativeSetter.call(rangeEl, newVal);
              rangeEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        } else if (e.key === 'Enter') {
          // If not a text box, simulate click on Enter/OK remote press
          const isText = (focusedItem.tagName === 'INPUT' && (focusedItem as any).type === 'text') || focusedItem.tagName === 'TEXTAREA';
          if (!isText) {
            e.preventDefault();
            focusedItem.click();
            
            // Re-sync items list in case tab selection changes focusable collection
            setTimeout(() => {
              clearHighlights();
              activeIndex = -1;
            }, 120);
          }
        }
      }
    };

    window.addEventListener('keydown', handleRemoteKeys);
    return () => {
      window.removeEventListener('keydown', handleRemoteKeys);
      // Clean highlights up
      const panel = document.getElementById('settings-container-panel');
      if (panel) {
        panel.querySelectorAll('.dpad-focus').forEach((el) => el.classList.remove('dpad-focus'));
      }
    };
  }, [isOpen, config.dpadNavigation, activeTab]);

  const updateField = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  if (!isOpen) return null;

  // Real-time URL validation for Google Drive folder link
  const getDriveDiagnostics = (text: string) => {
    if (!text.trim()) return { hasInvalid: false, message: '' };
    
    const isUrl = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?/i.test(text.trim());
    if (!isUrl) {
      return { hasInvalid: true, message: 'Formato de link da Web inválido.' };
    }
    
    const isDrive = text.includes('drive.google.com');
    if (!isDrive) {
      return { hasInvalid: true, message: 'O link inserido não pertence ao Google Drive.' };
    }
    
    const hasFolder = text.includes('/folders/') || !!text.match(/[/\=]([a-zA-Z0-9_-]{28,45})/);
    if (!hasFolder) {
      return { hasInvalid: true, message: 'O link não parece conter o identificador de uma pasta.' };
    }
    
    return { hasInvalid: false, message: '' };
  };

  const { hasInvalid, message: validationMessage } = getDriveDiagnostics(config.driveFolderUrl);

  // Corner grid positions helper
  const corners: { id: AppConfig['corner']; label: string }[] = [
    { id: 'top-left', label: '↖ Superior Esq.' },
    { id: 'top-right', label: '↗ Superior Dir.' },
    { id: 'bottom-left', label: '↙ Inferior Esq.' },
    { id: 'bottom-right', label: '↘ Inferior Dir.' },
    { id: 'center', label: '🎯 Centralizado' },
  ];

  const handleCopyLink = () => {
    try {
      const launchUrl = generateConfigUrl(window.location.origin + window.location.pathname, config);
      navigator.clipboard.writeText(launchUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (e) {
      // Fallback
      const videoId = config.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || config.youtubeUrl;
      const simpleUrl = `${window.location.origin}${window.location.pathname}?v=${videoId}&drive=${encodeURIComponent(config.driveFolderUrl)}&corner=${config.corner}&clock=${config.showClock ? 1 : 0}&ticker=${config.showTicker ? 1 : 0}&interval=${config.slideshowInterval}&pause=${config.slideshowPauseTime}&anim=${config.imageAnimationType}&animdur=${config.imageAnimationDuration}`;
      navigator.clipboard.writeText(simpleUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  return (
    <motion.div
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] z-50 glassmorphism shadow-2xl flex flex-col border-l border-zinc-800/80 pointer-events-auto text-zinc-100"
      id="settings-container-panel"
    >
      {/* Header section */}
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between" id="panel-head">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-zinc-400 rotate-45" />
          <h2 className="text-lg font-semibold tracking-tight font-sans">
            Configurações da Página
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white cursor-pointer"
          aria-label="Fechar painel"
          id="cmd-close-panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Mode navigation / Tabs */}
      <div className="flex px-3 py-2 border-b border-zinc-800 bg-black/20 gap-1" id="panel-tabs">
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'video'
              ? 'bg-zinc-800 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/10'
          }`}
          id="tab-btn-video"
        >
          <Video size={13} />
          <span>FUNDO DE TELA</span>
        </button>
        <button
          onClick={() => setActiveTab('overlay')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'overlay'
              ? 'bg-zinc-800 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/10'
          }`}
          id="tab-btn-overlay"
        >
          <ImageIcon size={13} />
          <span>LOGOMARCA</span>
        </button>
        <button
          onClick={() => setActiveTab('indoor')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'indoor'
              ? 'bg-zinc-800 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/10'
          }`}
          id="tab-btn-indoor"
        >
          <Sliders size={13} />
          <span>MÍDIA INDOOR</span>
        </button>
      </div>

      {/* Core Scrollable Panel Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6" id="panel-scroll-body">
        
        {/* ================= VIDEO TAB ================= */}
        {activeTab === 'video' && (
          <div className="space-y-5 animate-fadeIn" id="tab-video-content">
            
            {/* Background Selector - Video vs Image */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-2.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={13} className="text-blue-400" />
                Mídia de Fundo
              </label>
              <div className="grid grid-cols-2 gap-2" id="bg-type-selection-container">
                <button
                  type="button"
                  onClick={() => updateField('backgroundType', 'video')}
                  className={`py-2 px-2 text-xs font-bold border rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    config.backgroundType === 'video'
                      ? 'bg-red-600/10 border-red-500/30 text-red-250 font-semibold shadow-inner'
                      : 'bg-zinc-950/40 border-zinc-90 w-full hover:text-zinc-200 hover:bg-zinc-800/30 text-zinc-400'
                  }`}
                >
                  <Video size={13} />
                  Vídeo do YouTube
                </button>
                <button
                  type="button"
                  onClick={() => updateField('backgroundType', 'image')}
                  className={`py-2 px-2 text-xs font-bold border rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    config.backgroundType === 'image'
                      ? 'bg-blue-600/10 border-blue-500/30 text-blue-250 font-semibold shadow-inner'
                      : 'bg-zinc-950/40 border-zinc-90 w-full hover:text-zinc-200 hover:bg-zinc-800/30 text-zinc-400'
                  }`}
                >
                  <ImageIcon size={13} />
                  Imagem de Fundo
                </button>
              </div>
            </div>

            {config.backgroundType === 'image' ? (
              /* ================= IMAGE BACKGROUND SECTION ================= */
              <div className="space-y-4 animate-fadeIn" id="bg-image-options">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-zinc-410 uppercase tracking-widest flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-blue-400" />
                    Origem da Imagem de Fundo
                  </label>

                  <div className="grid grid-cols-2 gap-1.5" id="bg-img-source-selector">
                    <button
                      type="button"
                      onClick={() => updateField('useDriveBackgroundImageUrl', false)}
                      className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                        !config.useDriveBackgroundImageUrl
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 font-semibold'
                          : 'bg-zinc-950/40 border-zinc-900 w-full hover:text-zinc-200'
                      }`}
                    >
                      🖼️ Imagem Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('useDriveBackgroundImageUrl', true)}
                      className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                        config.useDriveBackgroundImageUrl
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 font-semibold animate-pulse'
                          : 'bg-zinc-950/40 border-zinc-900 w-full hover:text-zinc-200'
                      }`}
                      style={{ animationDuration: '3s' }}
                    >
                      💾 Google Drive (.txt)
                    </button>
                  </div>

                  {!config.useDriveBackgroundImageUrl ? (
                    <div className="space-y-1.5 animate-fadeIn">
                      <span className="text-[11px] text-zinc-400 font-medium">Link da Imagem de Fundo</span>
                      <input
                        type="text"
                        placeholder="Cole o link da Imagem de Fundo..."
                        value={config.backgroundImageUrl}
                        onChange={(e) => updateField('backgroundImageUrl', e.target.value)}
                        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
                        id="input-bg-image-url"
                      />
                      <p className="text-[10px] text-zinc-500 leading-normal" id="bg-img-help">
                        Cole uma URL de imagem direta do Pinterest, Unsplash, ou um link público de compartilhamento de arquivo de imagem do Google Drive.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-fadeIn">
                      <span className="text-[11px] text-zinc-400 font-medium text-blue-300">Link de Compartilhamento do arquivo .txt da Imagem de Fundo</span>
                      <input
                        type="text"
                        value={config.backgroundImageDriveFileUrl}
                        onChange={(e) => updateField('backgroundImageDriveFileUrl', e.target.value)}
                        placeholder="Ex: https://drive.google.com/file/d/1zagqw2WudDeMfdEoCRsnnYeGPHt49y7q/view?usp=drive_link"
                        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[9.5px] text-zinc-500 leading-normal bg-zinc-950/40 p-2 rounded-lg border border-zinc-850/80">
                        Insira o link de compartilhamento de um arquivo .txt público do Google Drive contendo apenas o endereço de link da imagem de fundo. O arquivo deve estar compartilhado para "Qualquer pessoa com o link".
                      </p>
                    </div>
                  )}
                </div>

                {/* Exemplo de Presets de Imagem de Fundo */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/40">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                    Exemplos Rápidos de Imagem
                  </span>
                  <div className="grid grid-cols-2 gap-1.5" id="bg-presets-grid">
                    {[
                      { name: 'Abstrato Moderno', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200&auto=format&fit=crop' },
                      { name: 'Tecnologia Escura', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop' },
                      { name: 'Oceano Azul', url: 'https://images.unsplash.com/photo-1473116763269-255448993767?q=80&w=1200&auto=format&fit=crop' },
                      { name: 'Montanhas', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop' },
                    ].map((imgPreset) => (
                      <button
                        key={imgPreset.name}
                        onClick={() => {
                          updateField('backgroundImageUrl', imgPreset.url);
                          updateField('useDriveBackgroundImageUrl', false);
                        }}
                        className={`text-left text-[11.5px] p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                          config.backgroundImageUrl === imgPreset.url && !config.useDriveBackgroundImageUrl
                            ? 'bg-blue-500/10 border-blue-500/30 text-white font-semibold'
                            : 'bg-zinc-900/40 border-zinc-900 hover:bg-zinc-800/50 hover:border-zinc-700/50 text-zinc-400'
                        }`}
                      >
                        <span className="truncate">{imgPreset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ================= EXISTING YOUTUBE VÍDEO SECTION ================= */
              <div className="space-y-5 animate-fadeIn" id="youtube-video-group">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-zinc-405 uppercase tracking-widest flex items-center gap-1.5">
                    <Youtube size={14} className="text-red-500" />
                    Origem do Vídeo do YouTube
                  </label>

                  <div className="grid grid-cols-2 gap-1.5" id="youtube-source-selector">
                    <button
                      type="button"
                      onClick={() => updateField('useDriveYoutubeUrl', false)}
                      className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                        !config.useDriveYoutubeUrl
                          ? 'bg-red-500/10 border-red-500/40 text-red-300'
                          : 'bg-zinc-950/40 border-zinc-900 w-full hover:text-zinc-200'
                      }`}
                    >
                      📺 Vídeo Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('useDriveYoutubeUrl', true)}
                      className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                        config.useDriveYoutubeUrl
                          ? 'bg-red-500/10 border-red-500/40 text-red-300 animate-pulse'
                          : 'bg-zinc-950/40 border-zinc-900 w-full hover:text-zinc-200'
                      }`}
                      style={{ animationDuration: '3s' }}
                    >
                      💾 Google Drive (.txt)
                    </button>
                  </div>

                  {!config.useDriveYoutubeUrl ? (
                    <div className="space-y-1.5 animate-fadeIn">
                      <span className="text-[11px] text-zinc-400 font-medium">Link do Vídeo ou Live (Manual)</span>
                      <input
                        type="text"
                        placeholder="Cole o link da live ou vídeo..."
                        value={config.youtubeUrl}
                        onChange={(e) => updateField('youtubeUrl', e.target.value)}
                        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all font-mono"
                        id="input-youtube-url"
                      />
                      <p className="text-[10px] text-zinc-500 leading-normal" id="youtube-help-info">
                        Suporta links normais, shorts, transmissões ao vivo ou IDs de 11 caracteres (ex: <span className="font-mono text-zinc-400 bg-zinc-950 px-1 py-0.5 rounded">Ke1_xX6C-zU</span>).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-fadeIn">
                      <span className="text-[11px] text-zinc-400 font-medium text-red-300">Link de Compartilhamento do arquivo .txt do Vídeo do YouTube</span>
                      <input
                        type="text"
                        value={config.youtubeDriveFileUrl}
                        onChange={(e) => updateField('youtubeDriveFileUrl', e.target.value)}
                        placeholder="Ex: https://drive.google.com/file/d/1zagqw2WudDeMfdEoCRsnnYeGPHt49y7q/view?usp=drive_link"
                        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-red-500 font-mono"
                      />
                      <p className="text-[9.5px] text-zinc-500 leading-normal bg-zinc-950/40 p-2 rounded-lg border border-zinc-850/80">
                        Insira o link de compartilhamento de um arquivo .txt público do Google Drive contendo apenas o endereço do vídeo do YouTube (ex: <span className="font-mono text-zinc-400">https://www.youtube.com/watch?v=Ke1_xX6C-zU</span>). O arquivo deve estar como Qualquer um com o link como Leitor.
                      </p>
                    </div>
                  )}

                  {/* YouTube Live Stream Error/Validation Advice Box */}
                  <div className="p-3.5 bg-amber-500/5 border border-amber-500/15 rounded-xl space-y-2.5 text-[11px] text-zinc-300 leading-relaxed" id="live-stream-warning-details">
                    <div className="flex gap-2 items-center text-amber-400 font-semibold uppercase tracking-wider text-[10px]">
                      <span>⚠️ ATENÇÃO: Erro de "Gravação indisponível" na TV?</span>
                    </div>
                    <div className="space-y-1.5 text-zinc-400 text-[10.5px]">
                      <p>
                        Se a sua TV exibe a mensagem <strong className="text-zinc-200">"A gravação dessa transmissão ao vivo não está disponível"</strong>, isso ocorre por causa do tipo de link do YouTube usado:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>
                          <strong className="text-zinc-200">Links de Transmissões ao Vivo (LIVES / Transmissões diretas)</strong> frequentemente sofrem expiração ou troca do ID do link quando a transmissão cai ou é reiniciada.
                        </li>
                        <li>
                          Muitos modelos de <strong className="text-zinc-200">fichas de Smart TVs ou navegadores embarcados</strong> não suportam os protocolos especiais de streaming ao vivo do YouTube iframe player, provocando essa tela de erro.
                        </li>
                      </ul>
                      <div className="pt-2 border-t border-zinc-800/80">
                        <strong className="text-emerald-400 block mb-1">Como resolver de forma definitiva:</strong>
                        <ul className="list-decimal pl-4 space-y-1 text-emerald-300 font-medium font-sans">
                          <li>Use <strong className="font-bold text-white uppercase">Vídeos Normais Gravação do YouTube</strong> (loops longos de lareiras, aquários, chuvas ou paisagens que já foram postados no canal). Eles são 100% estáveis e compatíveis com qualquer Smart TV!</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Premium presets */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Exemplos / Presets Rápidos
                  </label>
                  <div className="grid grid-cols-1 gap-1.5" id="video-presets-grid">
                    {PRESETS.videos.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => updateField('youtubeUrl', v.url)}
                        className={`text-left text-xs p-2.5 rounded-lg border flex items-center justify-between transition-all group cursor-pointer ${
                          config.youtubeUrl.includes(v.id) || (v.idActual && config.youtubeUrl.includes(v.idActual))
                            ? 'bg-red-500/10 border-red-500/30 text-white'
                            : 'bg-zinc-900/40 border-zinc-900 hover:bg-zinc-800/50 hover:border-zinc-700/50 text-zinc-300'
                        }`}
                      >
                        <span className="truncate font-sans font-medium pr-2">{v.title}</span>
                        <Check 
                          size={14} 
                          className={`text-red-400 shrink-0 transition-opacity ${
                            config.youtubeUrl.includes(v.id) || (v.idActual && config.youtubeUrl.includes(v.idActual)) ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Playback tweak parameters wrapper */}
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
                  <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-2">
                    <Sliders size={12} className="text-zinc-500" />
                    <span>Configurações do Player</span>
                  </div>

                  {/* Loop option */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-zinc-200">Repetir Continuamente (Loop)</span>
                      <span className="text-[10px] text-zinc-500">Reiniciar vídeo ao terminar</span>
                    </div>
                    <button
                      onClick={() => updateField('videoLoop', !config.videoLoop)}
                      className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        config.videoLoop ? 'bg-red-500' : 'bg-zinc-700'
                      }`}
                      id="toggle-loop"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                          config.videoLoop ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Mute option */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-zinc-200">Vídeo Silenciado (Mudo)</span>
                      <span className="text-[10px] text-zinc-500">Obrigatório para autoplay em navegadores</span>
                    </div>
                    <button
                      onClick={() => updateField('videoMuted', !config.videoMuted)}
                      className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        config.videoMuted ? 'bg-red-500' : 'bg-zinc-700'
                      }`}
                      id="toggle-mute"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                          config.videoMuted ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Autoplay option */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-zinc-200">Reprodução Automática</span>
                      <span className="text-[10px] text-zinc-500">Iniciar assim que o player carregar</span>
                    </div>
                    <button
                      onClick={() => updateField('videoAutoplay', !config.videoAutoplay)}
                      className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        config.videoAutoplay ? 'bg-red-500' : 'bg-zinc-700'
                      }`}
                      id="toggle-autoplay"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                          config.videoAutoplay ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show controls option */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-zinc-200">Exibir Controles do YouTube</span>
                      <span className="text-[10px] text-zinc-500">Barra de reprodução, volume e play</span>
                    </div>
                    <button
                      onClick={() => updateField('videoControls', !config.videoControls)}
                      className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        config.videoControls ? 'bg-red-500' : 'bg-zinc-700'
                      }`}
                      id="toggle-controls"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                          config.videoControls ? 'translate-x-4.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= OVERLAY TAB ================= */}
        {activeTab === 'overlay' && (
          <div className="space-y-5 animate-fadeIn" id="tab-overlay-content">
            {/* Google Drive Folder Selector */}
            <div className="space-y-2.5" id="image-links-block-validator">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon size={14} className={hasInvalid ? "text-amber-500 animate-pulse" : "text-blue-400"} />
                  Pasta de Origem no Google Drive
                </span>
                {hasInvalid && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold tracking-wider font-mono animate-pulse bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    <AlertTriangle size={12} />
                    ALERTA
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="Exemplo: https://drive.google.com/drive/folders/1lS..."
                value={config.driveFolderUrl}
                onChange={(e) => updateField('driveFolderUrl', e.target.value)}
                className={`w-full bg-zinc-900/90 border rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all font-mono leading-relaxed ${
                  hasInvalid 
                    ? 'border-amber-500/60 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40' 
                    : 'border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50'
                }`}
                id="input-drive-folder-url"
              />

              {/* Real-time Validation Warning Banner */}
              {hasInvalid && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-200/90 space-y-1.5 animate-fadeIn" id="url-validation-warning">
                  <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                    <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                    <span>Link incorreto:</span>
                  </div>
                  <p className="text-[10px] pl-1 text-amber-300">
                    {validationMessage}
                  </p>
                  <p className="text-[10px] text-zinc-500 pt-1 leading-normal">
                    Certifique-se de colar uma URL de pasta pública do Google Drive compartilhada para qualquer pessoa com o link.
                  </p>
                </div>
              )}

              {/* Real-time Validation Success Banner */}
              {!hasInvalid && config.driveFolderUrl.trim() && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-300 flex items-center gap-1.5 animate-fadeIn font-semibold" id="url-validation-success">
                  <Check size={14} className="shrink-0 text-emerald-400 bg-emerald-500/20 rounded-full p-0.5" />
                  <span>Pronto! O formato do link do Google Drive é válido.</span>
                </div>
              )}
              
              {/* Slideshow Interval Selector */}
              <div className="space-y-3 pt-3 border-t border-zinc-800/50" id="slideshow-interval-section">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    ⏱️ Tempo de Exibição de cada Imagem
                  </span>
                  <span className="text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[11px]">
                    {config.slideshowInterval >= 60 
                      ? `${Math.floor(config.slideshowInterval / 60)}m ${config.slideshowInterval % 60}s` 
                      : `${config.slideshowInterval} segundos`}
                  </span>
                </div>
                
                {/* Quick Presets Select Buttons */}
                <div className="grid grid-cols-6 gap-1" id="interval-presets-container">
                  {[
                    { label: '3s', value: 3 },
                    { label: '5s', value: 5 },
                    { label: '10s', value: 10 },
                    { label: '15s', value: 15 },
                    { label: '30s', value: 30 },
                    { label: '1m', value: 60 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => updateField('slideshowInterval', preset.value)}
                      className={`text-[10px] font-bold py-1.5 px-1 rounded transition-all text-center border cursor-pointer ${
                        config.slideshowInterval === preset.value
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Range manual slider to fine-tune */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="2"
                    max="300"
                    step="1"
                    value={config.slideshowInterval}
                    onChange={(e) => updateField('slideshowInterval', Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span>Mín: 2 seg</span>
                    <span>Máx: 5 min</span>
                  </div>
                </div>
              </div>

              {/* Slideshow Blank Transition Pause Selector */}
              <div className="space-y-3 pt-3 border-t border-zinc-800/50" id="slideshow-pause-section">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    ⏳ Intervalo de Pausa entre Imagens
                  </span>
                  <span className="text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                    {config.slideshowPauseTime === 0 ? 'Sem Pausa' : `${config.slideshowPauseTime} segundos`}
                  </span>
                </div>
                
                {/* Quick Presets for Pause Time */}
                <div className="grid grid-cols-5 gap-1" id="pause-presets-container">
                  {[
                    { label: 'Direto (0s)', value: 0 },
                    { label: '1s', value: 1 },
                    { label: '2s', value: 2 },
                    { label: '3s', value: 3 },
                    { label: '5s', value: 5 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => updateField('slideshowPauseTime', preset.value)}
                      className={`text-[10px] font-bold py-1.5 px-0.5 rounded transition-all text-center border cursor-pointer ${
                        config.slideshowPauseTime === preset.value
                          ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                          : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Range manual slider for pause */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    value={config.slideshowPauseTime}
                    onChange={(e) => updateField('slideshowPauseTime', Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span>Sem Pausa (0s)</span>
                    <span>Máx: 15 seg</span>
                  </div>
                </div>
              </div>

              {/* Entrance Animation Type Selector */}
              <div className="space-y-3 pt-3 pb-3 border-t border-zinc-800/50 animate-fadeIn" id="slideshow-animation-section">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    ✨ Efeito de Animação na Entrada
                  </span>
                </div>
                
                {/* Animation options buttons */}
                <div className="grid grid-cols-3 gap-1.5" id="animation-styles-container">
                  {[
                    { id: 'fade', label: 'Esmaecer', desc: 'Opacidade suave' },
                    { id: 'scale-up', label: 'Crescer', desc: 'Zoom de dentro' },
                    { id: 'scale-down', label: 'Encolher', desc: 'Encolher ao centro' },
                  ].map((anim) => (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => updateField('imageAnimationType', anim.id as AppConfig['imageAnimationType'])}
                      className={`py-2 px-1 rounded-lg border text-center transition-all group flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        config.imageAnimationType === anim.id
                          ? 'bg-blue-500/10 border-blue-500 text-blue-300 font-medium'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-[10px] font-semibold">{anim.label}</span>
                      <span className="text-[8px] text-zinc-550 group-hover:text-zinc-400">{anim.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Entrance Animation Duration Selector */}
              <div className="space-y-3 pt-3 pb-3 border-t border-zinc-800/50 animate-fadeIn" id="slideshow-anim-duration-section">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    ⚡ Duração da Entrada da Imagem
                  </span>
                  <span className="text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[11px]">
                    {config.imageAnimationDuration.toFixed(1)}s
                  </span>
                </div>

                {/* Quick Presets for Entrance Animation Duration */}
                <div className="grid grid-cols-5 gap-1" id="duration-presets-container">
                  {[0.2, 0.4, 0.6, 1.0, 2.0].map((presetDur) => (
                    <button
                      key={presetDur}
                      type="button"
                      onClick={() => updateField('imageAnimationDuration', presetDur)}
                      className={`text-[10px] font-bold py-1.5 px-0.5 rounded transition-all text-center border cursor-pointer ${
                        config.imageAnimationDuration === presetDur
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {presetDur}s
                    </button>
                  ))}
                </div>

                {/* Range manual slider to fine-tune */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={config.imageAnimationDuration}
                    onChange={(e) => updateField('imageAnimationDuration', Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span>Rápido (0.1s)</span>
                    <span>Suave (3s)</span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Portuguese guide on how to update / configure */}
              <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-3 text-[11px] text-zinc-300 leading-relaxed">
                <div>
                  <strong className="text-blue-400 block font-semibold mb-1">Como trocar as imagens após o app estar pronto?</strong>
                  <ul className="list-decimal pl-4 space-y-1.5 text-zinc-400">
                    <li><strong className="text-zinc-200">Não precisa mexer no código do site!</strong></li>
                    <li>Qualquer imagem adicionada, removida ou alterada na pasta do Drive aparecerá <strong className="text-zinc-200">automaticamente</strong> na tela em tempo real!</li>
                    <li>Sempre use formato de imagem padrão (<strong className="text-blue-300">JPEG, PNG, WEBP</strong>).</li>
                    <li>Se quiser usar <strong className="text-zinc-200">outra pasta</strong>, basta colar o novo link dela na caixa acima, ir na aba MÍDIA INDOOR e clicar em Copiar Link.</li>
                  </ul>
                </div>

                <div className="border-t border-zinc-800/60 pt-2.5">
                  <strong className="text-blue-400 block font-semibold mb-1">Como certificar a permissão pública no Google Drive?</strong>
                  <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                    <li>Na pasta do Drive, clique em <strong className="text-zinc-200">Compartilhar</strong>.</li>
                    <li>Mude o "Acesso Geral" de "Restrito" para <strong className="text-blue-300 font-bold">Qualquer pessoa com o link</strong>.</li>
                    <li>Dê permissão como <strong className="text-zinc-200">Leitor</strong> e copie o link.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Corner alignment grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Compass size={14} className="text-zinc-400" />
                Posicionamento Canto / Centralizado
              </label>
              <div className="grid grid-cols-2 gap-2" id="corners-selector-grid">
                {corners.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => updateField('corner', c.id)}
                    className={`py-2 px-3 text-xs font-medium border rounded-lg text-center transition-all cursor-pointer ${
                      c.id === 'center' ? 'col-span-2' : ''
                    } ${
                      config.corner === c.id
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-200 font-semibold'
                        : 'bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Geometry adjustments & sliders */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-2">
                <Sliders size={12} className="text-zinc-500" />
                <span>Ajuste de Tamanho (Expansão Máxima)</span>
              </div>

              {/* Width control */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Largura Máxima (Horizontal)</span>
                  <span className="text-blue-400 font-mono font-medium">{config.imageMaxWidth}px</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1200"
                  step="10"
                  value={config.imageMaxWidth}
                  onChange={(e) => updateField('imageMaxWidth', Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Height control */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Altura Máxima (Vertical)</span>
                  <span className="text-blue-400 font-mono font-medium">{config.imageMaxHeight}px</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1200"
                  step="10"
                  value={config.imageMaxHeight}
                  onChange={(e) => updateField('imageMaxHeight', Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Slider Opacity */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Transparência (Opacidade)</span>
                  <span className="text-blue-400 font-mono font-medium">{config.imageOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={config.imageOpacity}
                  onChange={(e) => updateField('imageOpacity', Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Slider Border Radius */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Arredondamento dos Cantos</span>
                  <span className="text-blue-400 font-mono font-medium">{config.imageBorderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="2"
                  value={config.imageBorderRadius}
                  onChange={(e) => updateField('imageBorderRadius', Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Slider Margin */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Distância da Borda (Margem)</span>
                  <span className="text-blue-400 font-mono font-medium">{config.imageMargin}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="4"
                  value={config.imageMargin}
                  onChange={(e) => updateField('imageMargin', Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="border-t border-zinc-800/80 my-3 pt-3" />

              {/* Click toggle overlay */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-200">Tornar Imagem Clicável</span>
                    <span className="text-[10px] text-zinc-500">Abre um link em nova guia ao clicar</span>
                  </div>
                  <button
                    onClick={() => updateField('imageClickable', !config.imageClickable)}
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                      config.imageClickable ? 'bg-blue-500' : 'bg-zinc-700'
                    }`}
                    id="toggle-image-clickable"
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                        config.imageClickable ? 'translate-x-4.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {config.imageClickable && (
                  <div className="space-y-3 animate-fadeIn border-t border-zinc-805 pt-3">
                    <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider text-[9.5px] block">Origem do Link de Destino</span>
                    <div className="grid grid-cols-2 gap-1.5" id="image-link-source-selector">
                      <button
                        type="button"
                        onClick={() => updateField('useDriveImageLink', false)}
                        className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                          !config.useDriveImageLink
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                            : 'bg-zinc-950/40 border-zinc-90 w-full hover:text-zinc-200'
                        }`}
                      >
                        ✍️ Site Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('useDriveImageLink', true)}
                        className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                          config.useDriveImageLink
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 animate-pulse'
                            : 'bg-zinc-950/40 border-zinc-90 w-full hover:text-zinc-200'
                        }`}
                        style={{ animationDuration: '3s' }}
                      >
                        💾 Google Drive (.txt)
                      </button>
                    </div>

                    {!config.useDriveImageLink ? (
                      <div className="space-y-1.5 animate-fadeIn">
                        <span className="text-[11px] text-zinc-400 font-medium">Link de destino (Manual)</span>
                        <input
                          type="text"
                          placeholder="Ex: canaldooutub.com ou dropbox.com..."
                          value={config.imageLink}
                          onChange={(e) => updateField('imageLink', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                          id="input-image-target-link"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-fadeIn">
                        <span className="text-[11px] text-zinc-400 font-medium text-blue-300">Link de Compartilhamento do arquivo .txt do Link do Site</span>
                        <input
                          type="text"
                          value={config.imageLinkDriveFileUrl}
                          onChange={(e) => updateField('imageLinkDriveFileUrl', e.target.value)}
                          placeholder="Ex: https://drive.google.com/file/d/1zagqw2WudDeMfdEoCRsnnYeGPHt49y7q/view?usp=drive_link"
                          className="w-full bg-zinc-950/90 border border-zinc-805 rounded-lg p-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <p className="text-[9.5px] text-zinc-500 leading-normal bg-zinc-950/40 p-2 rounded-lg border border-zinc-850">
                          Coloque um arquivo .txt público no Drive contendo apenas o endereço do site desejado (ex: <span className="font-mono text-zinc-400">https://quinelato.com</span>). Qualquer um com o link como Leitor.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= INDOOR MEDIA TAB ================= */}
        {activeTab === 'indoor' && (
          <div className="space-y-5 animate-fadeIn" id="tab-indoor-content">
            
            {/* Clock settings */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                    Relógio Digital (Hora & Data)
                  </span>
                </div>
                <button
                  onClick={() => updateField('showClock', !config.showClock)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-205 focus:outline-none cursor-pointer ${
                    config.showClock ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                  id="toggle-clock-visibility"
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-205 ${
                      config.showClock ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {config.showClock && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* Clock corner */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-zinc-400 font-medium">Alinhamento do Relógio</span>
                    <div className="grid grid-cols-2 gap-1.5" id="clock-corner-selector">
                      {[
                        { id: 'top-left', label: '↖ Superior Esq.' },
                        { id: 'top-right', label: '↗ Superior Dir.' },
                        { id: 'bottom-left', label: '↙ Inferior Esq.' },
                        { id: 'bottom-right', label: '↘ Inferior Dir.' },
                      ].map((cc) => (
                        <button
                          key={cc.id}
                          onClick={() => updateField('clockCorner', cc.id as any)}
                          className={`py-1.5 px-2 text-[10px] font-medium border rounded-md text-center transition-all cursor-pointer ${
                            config.clockCorner === cc.id
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                              : 'bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                          }`}
                        >
                          {cc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clock size */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-zinc-400 font-medium">Tamanho do Relógio</span>
                    <div className="grid grid-cols-3 gap-1.5" id="clock-size-selector">
                      {[
                        { id: 'sm', label: 'Pequeno' },
                        { id: 'md', label: 'Médio' },
                        { id: 'lg', label: 'Grande (TV)' },
                      ].map((cs) => (
                        <button
                          key={cs.id}
                          onClick={() => updateField('clockSize', cs.id as any)}
                          className={`py-1.5 px-2 text-[10px] font-medium border rounded-md text-center transition-all cursor-pointer ${
                            config.clockSize === cs.id
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                              : 'bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                          }`}
                        >
                          {cs.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Scrolling Ticker (Letreiro Digital) settings */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                  Letreiro Digital (Ticker)
                </span>
                <button
                  onClick={() => updateField('showTicker', !config.showTicker)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-205 focus:outline-none cursor-pointer ${
                    config.showTicker ? 'bg-red-500' : 'bg-zinc-700'
                  }`}
                  id="toggle-ticker-visibility"
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-205 ${
                      config.showTicker ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {config.showTicker && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Ticker source toggle choice */}
                  <div className="space-y-1.5 pb-2 border-b border-zinc-805">
                    <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider text-[9.5px]">Origem do Letreiro Digital</span>
                    <div className="grid grid-cols-2 gap-1.5" id="ticker-source-selector">
                      <button
                        type="button"
                        onClick={() => updateField('useDriveTickerText', false)}
                        className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                          !config.useDriveTickerText
                            ? 'bg-red-500/10 border-red-500/40 text-red-300'
                            : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        ✍️ Texto Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('useDriveTickerText', true)}
                        className={`py-2 px-1 text-[10px] font-bold border rounded-lg text-center transition-all cursor-pointer ${
                          config.useDriveTickerText
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 animate-pulse'
                            : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={{ animationDuration: '3s' }}
                      >
                        💾 Google Drive (.txt)
                      </button>
                    </div>
                  </div>

                  {!config.useDriveTickerText ? (
                    /* Ticker Text Input */
                    <div className="space-y-1.5 animate-fadeIn">
                      <span className="text-[11px] text-zinc-400 font-medium">Mensagem de Texto</span>
                      <textarea
                        rows={2}
                        value={config.tickerText}
                        onChange={(e) => updateField('tickerText', e.target.value)}
                        placeholder="Coloque avisos, promoções, notícias..."
                        className="w-full bg-zinc-950/90 border border-zinc-805 rounded-lg p-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-red-500 resize-none font-sans leading-relaxed"
                      />
                    </div>
                  ) : (
                    /* Google Drive .txt Link input block with detailed safe tips */
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-zinc-400 font-medium text-blue-300 block">Link de Compartilhamento do arquivo .txt</span>
                        <input
                          type="text"
                          value={config.tickerDriveFileUrl}
                          onChange={(e) => updateField('tickerDriveFileUrl', e.target.value)}
                          placeholder="Cole o link do Google Drive aqui..."
                          className="w-full bg-zinc-950/90 border border-zinc-805 rounded-lg p-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      
                      <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 space-y-2 text-[10px] text-zinc-400 leading-normal">
                        <p className="font-semibold text-blue-200 flex items-center gap-1">
                          🔄 Atualizações em tempo real (+-30s):
                        </p>
                        <p>
                          O aplicativo lerá as notícias diretamente do seu arquivo no Google Drive. Quando você quiser mudar o anúncio, mude no Drive e as TVs carregarão sozinhas!
                        </p>
                        <ul className="list-disc pl-3.5 space-y-1 text-zinc-400">
                          <li>Crie um arquivo <strong className="text-zinc-300">.txt</strong> simples no seu computador (com o Bloco de Notas) e envie para o Drive.</li>
                          <li>No Google Drive, selecione <strong className="text-zinc-200">Compartilhar</strong> e mude o acesso geral de Restrito para <strong className="text-blue-300 font-bold">"Qualquer pessoa com o link"</strong> como <strong className="text-zinc-200">Leitor</strong>.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Ticker Speed */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Velocidade do Texto (1 = muito lento, 100 = mais rápido)</span>
                      <span className="text-red-400 font-mono">{config.tickerSpeed}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={config.tickerSpeed}
                      onChange={(e) => updateField('tickerSpeed', Number(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                  </div>

                  {/* Ticker Size */}
                  <div className="space-y-1.5 animate-fadeIn">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Tamanho da Fonte (Letreiro)</span>
                      <span className="text-red-400 font-mono">{config.tickerFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="11"
                      max="150"
                      step="1"
                      value={config.tickerFontSize}
                      onChange={(e) => updateField('tickerFontSize', Number(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                  </div>

                  {/* Color pickers */}
                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div className="space-y-1.5" id="ticker-bg-color-container">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-400 font-semibold block uppercase tracking-wider">Cor de Fundo</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (config.tickerBgColor === 'transparent') {
                              updateField('tickerBgColor', '#000000');
                            } else {
                              updateField('tickerBgColor', 'transparent');
                            }
                          }}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                            config.tickerBgColor === 'transparent'
                              ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-500/20'
                              : 'bg-zinc-900 border-zinc-805 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800'
                          }`}
                        >
                          {config.tickerBgColor === 'transparent' ? '✓ Transparente' : 'Invisível'}
                        </button>
                      </div>
                      <div className="flex gap-1.5 items-center bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
                        <input
                          type="color"
                          disabled={config.tickerBgColor === 'transparent'}
                          value={config.tickerBgColor === 'transparent' ? '#000000' : config.tickerBgColor}
                          onChange={(e) => updateField('tickerBgColor', e.target.value)}
                          className={`w-6 h-6 border-0 p-0 bg-transparent rounded-sm cursor-pointer ${
                            config.tickerBgColor === 'transparent' ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                        />
                        <span className="text-[10px] font-mono text-zinc-300 select-none">
                          {config.tickerBgColor === 'transparent' ? 'sem fundo' : config.tickerBgColor}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5" id="ticker-fg-color-container">
                      <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">Cor da Fonte</span>
                      <div className="flex gap-1.5 items-center bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
                        <input
                          type="color"
                          value={config.tickerTextColor}
                          onChange={(e) => updateField('tickerTextColor', e.target.value)}
                          className="w-6 h-6 border-0 p-0 bg-transparent rounded-sm cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-zinc-300">{config.tickerTextColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TV & Performance Stability Section */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-2">
                <Sliders size={12} className="text-zinc-500" />
                <span>Otimizações para TV & TV Box</span>
              </div>

              {/* Toggle tvMode */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-medium text-zinc-200">Alta Estabilidade (Anti-Travamento)</span>
                  <span className="text-[10px] text-zinc-500">Recomendado para TV Box (desativa efeitos blur pesados que congelam o navegador)</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('tvMode', !config.tvMode)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 cursor-pointer ${
                    config.tvMode ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                  id="toggle-tv-mode"
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                      config.tvMode ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Slider for tvFontScale */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Escala de Resolução (TV)</span>
                  <span className="text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[11px]">{config.tvFontScale}%</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="175"
                  step="5"
                  id="input-tv-scale"
                  value={config.tvFontScale}
                  onChange={(e) => updateField('tvFontScale', Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-[9.5px] text-zinc-500 leading-normal">
                  Ajusta o tamanho geral do relógio e marca d'água na TV box para que fiquem mais legíveis à distância (sofá/balcão).
                </p>
              </div>

              {/* Toggle dpadNavigation */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-medium text-zinc-200">Controle por Setas (Controle Remoto)</span>
                  <span className="text-[10px] text-zinc-500">Use as setas Up/Down/Left/Right do controle e OK para alterar o menu</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('dpadNavigation', !config.dpadNavigation)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 cursor-pointer ${
                    config.dpadNavigation ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                  id="toggle-dpad-nav"
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                      config.dpadNavigation ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Quick Share / Signage Deployer Link */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-blue-950/20 to-zinc-900/60 border border-blue-500/20 space-y-3.5">
              <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
                  Deployer / Link de Transmissão
                </span>
              </div>
              
              <p className="text-[11px] text-zinc-400 leading-normal">
                Gere um link permanente configurado. Copie esta URL direta para rodar em outras TVs, Smart TVs ou computadores sem precisar configurar tudo de novo!
              </p>

              <button
                onClick={handleCopyLink}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  copiedLink
                    ? 'bg-emerald-600 text-white shadow-xl scale-102'
                    : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg active:scale-98'
                }`}
                id="cmd-copy-deployment-link"
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="animate-bounce" />
                    <span>Link Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <ExternalLink size={14} />
                    <span>Copiar Link e Salvar Configuração</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Footer controls: Restore / Confirm actions */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-850 flex items-center justify-between gap-3" id="panel-foot">
        <button
          onClick={onReset}
          className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-1 cursor-pointer hover:bg-zinc-800"
          title="Redefinir tudo"
          id="cmd-reset-configs"
        >
          <RotateCcw size={13} />
          <span>Resetar</span>
        </button>

        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors rounded-lg flex items-center justify-center gap-1 cursor-pointer hover:shadow-lg active:scale-98"
          id="cmd-save-confirm"
        >
          <Check size={13} />
          <span>Concluir</span>
        </button>
      </div>
    </motion.div>
  );
}
