import React, { useState, useEffect, useRef } from 'react';
import { AppConfig } from './types';
import { DEFAULT_CONFIG, parseUrlConfig, transformDriveImageUrl } from './utils/helpers';
import VideoPlayer from './components/VideoPlayer';
import ImageOverlay from './components/ImageOverlay';
import ClockOverlay from './components/ClockOverlay';
import NewsTicker from './components/NewsTicker';
import SettingsPanel from './components/SettingsPanel';
import { 
  Settings, 
  Sparkles, 
  Tv, 
  HelpCircle, 
  Info, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  RefreshCw,
  User,
  Lock,
  Mail,
  PlusCircle,
  LogIn,
  LogOut,
  Shield,
  Loader2,
  ChevronRight,
  Database,
  ArrowRight,
  Chrome,
  Wifi,
  Play,
  Home,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, signInWithGoogle, signUpWithEmail, signInWithEmail, logOut, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';


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
  const [showWelcomeTip, setShowWelcomeTip] = useState<boolean>(false);
  const [liveTickerText, setLiveTickerText] = useState<string>('');
  const [liveImageLink, setLiveImageLink] = useState<string>('');
  const [liveYoutubeUrl, setLiveYoutubeUrl] = useState<string>('');
  const [liveBgImageUrl, setLiveBgImageUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isUpdatingFromFirestore = useRef<boolean>(false);

  // Landing view or live player view
  const [viewMode, setViewMode] = useState<'landing' | 'player'>(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      return 'player';
    }
    return 'landing';
  });

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Email/Password login states
  const [emailForm, setEmailForm] = useState(() => {
    return localStorage.getItem('saved_email') || '';
  });
  const [passwordForm, setPasswordForm] = useState('');
  const [confirmPasswordForm, setConfirmPasswordForm] = useState('');
  const [displayNameForm, setDisplayNameForm] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authFormLoading, setAuthFormLoading] = useState(false);
  const [saveLogin, setSaveLogin] = useState<boolean>(() => {
    return localStorage.getItem('save_login_preference') !== 'false';
  });

  // Quick launch Firebase Channel state
  const [quickChannelId, setQuickChannelId] = useState(config.firebaseChannelId || '');

  // Synchronise quickChannelId state when config updates
  useEffect(() => {
    if (config.firebaseChannelId) {
      setQuickChannelId(config.firebaseChannelId);
    }
  }, [config.firebaseChannelId]);

  // Monitor Auth state globally
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (usr) => {
      const previouslyLoggedIn = currentUser !== null;
      setCurrentUser(usr);
      setIsAuthLoading(false);

      // If they were logged in and are now logged out, go back to landing view and close drawer
      if (!usr && previouslyLoggedIn) {
        setViewMode('landing');
        setIsSettingsOpen(false);
      }
    });
    return () => unsub();
  }, [currentUser]);

  // Adjust body overflow to prevent vertical or horizontal scrollbar issues
  useEffect(() => {
    if (viewMode === 'landing') {
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
      document.body.style.maxWidth = '100vw';
    } else {
      document.body.style.overflowY = 'hidden';
      document.body.style.overflowX = 'hidden';
      document.body.style.maxWidth = '100vw';
    }
    return () => {
      document.body.style.overflowY = '';
      document.body.style.overflowX = '';
      document.body.style.maxWidth = '';
    };
  }, [viewMode]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthFormLoading(true);

    const emailClean = emailForm.trim();
    const passwordClean = passwordForm;
    const nameClean = displayNameForm.trim();

    if (!emailClean || !passwordClean) {
      setAuthError("Por favor, preencha todos os campos obrigatórios.");
      setAuthFormLoading(false);
      return;
    }

    if (isSignUp) {
      if (passwordClean.length < 6) {
        setAuthError("A senha deve ter pelo menos 6 caracteres.");
        setAuthFormLoading(false);
        return;
      }
      if (passwordClean !== confirmPasswordForm) {
        setAuthError("As senhas não coincidem.");
        setAuthFormLoading(false);
        return;
      }
      if (!nameClean) {
        setAuthError("Por favor, informe seu nome.");
        setAuthFormLoading(false);
        return;
      }

      try {
        await setPersistence(auth, saveLogin ? browserLocalPersistence : browserSessionPersistence);
        const user = await signUpWithEmail(emailClean, passwordClean, nameClean);
        if (user) {
          if (saveLogin) {
            localStorage.setItem('saved_email', emailClean);
            localStorage.setItem('save_login_preference', 'true');
          } else {
            localStorage.removeItem('saved_email');
            localStorage.setItem('save_login_preference', 'false');
          }

          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            userId: user.uid,
            email: user.email || emailClean,
            displayName: nameClean,
            photoURL: '',
            lastLoginAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }, { merge: true });
          
          setEmailForm(saveLogin ? emailClean : '');
          setPasswordForm('');
          setConfirmPasswordForm('');
          setDisplayNameForm('');
          setAuthError(null);
          // Switch view mode to player and open settings
          setViewMode('player');
          setIsSettingsOpen(true);
        }
      } catch (err: any) {
        console.error("Signup error:", err);
        let msg = "Falha ao criar conta. Verifique os dados.";
        if (err.code === 'auth/email-already-in-use') {
          msg = "Este e-mail já está em uso.";
        } else if (err.code === 'auth/invalid-email') {
          msg = "E-mail inválido.";
        } else if (err.code === 'auth/weak-password') {
          msg = "A senha deve conter no mínimo 6 caracteres.";
        } else if (err.message) {
          msg = err.message;
        }
        setAuthError(msg);
      } finally {
        setAuthFormLoading(false);
      }
    } else {
      try {
        await setPersistence(auth, saveLogin ? browserLocalPersistence : browserSessionPersistence);
        const user = await signInWithEmail(emailClean, passwordClean);
        if (user) {
          if (saveLogin) {
            localStorage.setItem('saved_email', emailClean);
            localStorage.setItem('save_login_preference', 'true');
          } else {
            localStorage.removeItem('saved_email');
            localStorage.setItem('save_login_preference', 'false');
          }

          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            userId: user.uid,
            email: user.email || emailClean,
            displayName: user.displayName || 'Administrador',
            photoURL: user.photoURL || '',
            lastLoginAt: new Date().toISOString()
          }, { merge: true });

          setEmailForm(saveLogin ? emailClean : '');
          setPasswordForm('');
          setAuthError(null);
          // Switch view mode to player and open settings
          setViewMode('player');
          setIsSettingsOpen(true);
        }
      } catch (err: any) {
        console.error("Sign-in error:", err);
        let msg = "Falha no login. Verifique seu e-mail e senha.";
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = "E-mail ou senha incorretos ou inexistentes.";
        } else if (err.code === 'auth/invalid-email') {
          msg = "E-mail inválido.";
        } else if (err.message) {
          msg = err.message;
        }
        setAuthError(msg);
      } finally {
        setAuthFormLoading(false);
      }
    }
  };

  const handleGoogleSignInClick = async () => {
    try {
      setAuthError(null);
      await setPersistence(auth, saveLogin ? browserLocalPersistence : browserSessionPersistence);
      const user = await signInWithGoogle();
      if (user) {
        if (saveLogin && user.email) {
          localStorage.setItem('saved_email', user.email);
          localStorage.setItem('save_login_preference', 'true');
        } else {
          localStorage.removeItem('saved_email');
          localStorage.setItem('save_login_preference', 'false');
        }

        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          userId: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Administrador',
          photoURL: user.photoURL || '',
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, { merge: true });

        // Switch to player screen and open settings panel
        setViewMode('player');
        setIsSettingsOpen(true);
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setAuthError("Erro ao efetuar login com o Google. Certifique-se de que popups são permitidos.");
    }
  };

  const handleSignOutClick = async () => {
    try {
      await logOut();
      setViewMode('landing');
    } catch (err) {
      console.warn("Logout error:", err);
    }
  };

  const handleQuickLaunchPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = quickChannelId.trim();
    handleConfigChange({
      ...config,
      firebaseSyncEnabled: cleanId !== '',
      firebaseChannelId: cleanId,
    });
    setViewMode('player');
  };

  // Monitor e sincronização em tempo real das configurações via Cloud Firestore (Firebase)
  useEffect(() => {
    if (!config.firebaseSyncEnabled || !config.firebaseChannelId.trim()) {
      return;
    }

    const channelIdClean = config.firebaseChannelId.trim();
    const channelDocRef = doc(db, 'configs', channelIdClean);

    const unsubscribe = onSnapshot(channelDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data();
        if (cloudData) {
          isUpdatingFromFirestore.current = true;
          setConfig(prev => ({
            ...prev,
            ...cloudData,
            firebaseSyncEnabled: prev.firebaseSyncEnabled, // Prevent sync flag overrides
            firebaseChannelId: prev.firebaseChannelId     // Prevent ID updates
          }));
          setTimeout(() => {
            isUpdatingFromFirestore.current = false;
          }, 60);
        }
      }
    }, (error) => {
      console.warn("Firestore snapshot loading issue on channel listener:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `configs/${config.firebaseChannelId}`);
      } catch (e) {
        // Silently digest warnings
      }
    });

    return () => unsubscribe();
  }, [config.firebaseSyncEnabled, config.firebaseChannelId]);

  // Reporta sinal automático da tela (Heartbeat de telão corporativo Mídia Indoor)
  useEffect(() => {
    // Determine unique machine client identifier to register as dynamic screen
    let devId = localStorage.getItem('v_device_id');
    if (!devId) {
      devId = 'screen_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('v_device_id', devId);
    }

    const reportHeartbeat = async () => {
      const activeChannel = config.firebaseChannelId || 'default';
      const screenDocRef = doc(db, 'screens', devId!);
      try {
        await setDoc(screenDocRef, {
          deviceId: devId,
          deviceName: `Tela TV (${devId})`,
          lastSeen: new Date().toISOString(),
          currentConfigId: activeChannel,
          status: 'online',
          appVersion: '1.2.0'
        });
      } catch (e) {
        // Silent recovery when running in closed sandboxed environments
      }
    };

    // Immediate report then repeat every 15 seconds
    reportHeartbeat();
    const heartbeatTimer = setInterval(reportHeartbeat, 15000);

    return () => clearInterval(heartbeatTimer);
  }, [config.firebaseChannelId]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1500);
  };

  // Auto-save e sincronização das modificações para o servidor
  const handleConfigChange = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to save to web storage', e);
    }

    // Se a sincronização estiver ligada, propaga a alteração para a nuvem
    if (newConfig.firebaseSyncEnabled && newConfig.firebaseChannelId && !isUpdatingFromFirestore.current) {
      const channelIdClean = newConfig.firebaseChannelId.trim();
      const channelDocRef = doc(db, 'configs', channelIdClean);
      try {
        await setDoc(channelDocRef, {
          ...newConfig,
          ownerId: auth.currentUser?.uid || 'anonymous',
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Failed to propagate local configurations to Firestore:", e);
        try {
          handleFirestoreError(e, OperationType.WRITE, `configs/${channelIdClean}`);
        } catch (err) {
          // Silent digest
        }
      }
    }
  };

  // Reset to initial settings
  const [showResetSuccess, setShowResetSuccess] = useState(false);
  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      setShowResetSuccess(true);
      setTimeout(() => setShowResetSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save on reset', e);
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
        // Reload live page or sync on R key
        if (e.key === 'r' || e.key === 'R') {
          setRefreshKey(prev => prev + 1);
          setIsSyncing(true);
          setTimeout(() => {
            setIsSyncing(false);
          }, 1500);
          e.preventDefault();
        } else if (
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

  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100 flex flex-col justify-between overflow-x-hidden p-4 md:p-8 selection:bg-indigo-500 selection:text-white" id="landing-container">
        {/* Top Navbar */}
        <header className="w-full max-w-7xl mx-auto flex items-center justify-between border-b border-zinc-800 pb-4 md:pb-6" id="landing-header">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Tv size={24} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white font-sans">Mídia Indoor Pro</h1>
              <p className="text-[10px] md:text-xs text-indigo-400/80 font-mono tracking-wider font-semibold uppercase">Digital Signage Screen Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800 animate-fadeIn">
            <Wifi size={12} className="text-emerald-400 animate-ping shrink-0" />
            <span>Sistema Online</span>
          </div>
        </header>

        {/* Main Content Sections */}
        <main className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 my-auto py-8 md:py-12 animate-fadeIn" id="landing-main">
          {/* Left Column: Product pitch & quick play */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 md:space-y-8" id="landing-left-column">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <Sparkles size={12} />
                <span>Pronto para uso comercial</span>
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.1] font-sans">
                Seu canal de transmissão corporativo em <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">tempo real</span>
              </h2>
              <p className="text-sm md:text-base text-zinc-400 max-w-xl leading-relaxed">
                Gerencie letreiros informativos, relógio digital, slides com imagens do Google Drive e vídeos do YouTube diretamente na nuvem. Ideal para TVs, recepções, comércios e telas comerciais inteligentes.
              </p>
            </div>
          </div>

          {/* Right Column: Authentication Card / Active User greeting */}
          <div className="lg:col-span-5 flex items-center" id="landing-right-column">
            <div className="w-full bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden" id="auth-panel-card">
              {/* Subtle top decorative border glow */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              {isAuthLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3" id="auth-loading-spinner">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                  <span className="text-xs font-mono text-zinc-500">Autenticando sessão...</span>
                </div>
              ) : currentUser ? (
                /* Authenticated User state */
                <div className="space-y-6 animate-fadeIn" id="auth-logged-in-view">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto text-xl font-bold">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : <User size={28} />}
                    </div>
                    <div className="pt-2">
                      <h3 className="text-base font-bold text-white leading-tight">
                        Olá, {currentUser.displayName || 'Administrador'}!
                      </h3>
                      <p className="text-xs text-zinc-400 truncate max-w-full block pt-0.5">{currentUser.email}</p>
                    </div>
                    <span className="inline-block mt-2 px-3 py-0.5 bg-indigo-500/10 text-emerald-400 text-[10px] font-bold uppercase rounded-full tracking-wider border border-emerald-500/15">
                      Sessão Administrativa Ativa
                    </span>
                  </div>

                  <div className="h-px bg-zinc-800" />

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setViewMode('player');
                        setIsSettingsOpen(true);
                      }}
                      className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-98 transition-all rounded-xl text-xs text-white font-bold flex items-center justify-center gap-2 cursor-pointer border border-indigo-500/30"
                    >
                      <Settings size={15} className="rotate-45" />
                      <span>ABRIR PAINEL DE CONTROLE DE MÍDIAS</span>
                    </button>

                    <button
                      onClick={() => setViewMode('player')}
                      className="w-full py-2.5 px-4 bg-zinc-850 hover:bg-zinc-800 hover:text-white active:scale-98 transition-all rounded-xl text-xs text-zinc-300 font-semibold flex items-center justify-center gap-2 cursor-pointer border border-zinc-700/50"
                    >
                      <Play size={13} />
                      <span>Visualizar Player em Tela Cheia</span>
                    </button>

                    <button
                      onClick={handleSignOutClick}
                      className="w-full py-2.5 px-4 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/30 transition-all rounded-xl text-xs text-red-400 font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>Sair da Conta (Logout)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated Auth forms */
                <div className="space-y-5 animate-fadeIn" id="auth-forms-view">
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-bold text-white">Acesso do Administrador</h3>
                    <p className="text-xs text-zinc-400">
                      Acesse sua conta para gerenciar mídias e canais em nuvem.
                    </p>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-4" id="auth-form-submission">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Endereço de E-mail</label>
                      <div className="relative">
                        <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-650" />
                        <input
                          type="email"
                          value={emailForm}
                          onChange={(e) => setEmailForm(e.target.value)}
                          placeholder="nome@empresa.com"
                          className="w-full bg-black/40 border border-zinc-800 focus:border-indigo-500 transition-colors rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Senha de Acesso</label>
                      <div className="relative">
                        <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-650" />
                        <input
                          type="password"
                          value={passwordForm}
                          onChange={(e) => setPasswordForm(e.target.value)}
                          placeholder="Senha com min. 6 dígitos"
                          className="w-full bg-black/40 border border-zinc-800 focus:border-indigo-500 transition-colors rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Lembrar e deixar salvo opção de login - Permite múltiplos usuários */}
                    <div className="flex items-center justify-between py-1 bg-black/10 px-1 rounded-lg" id="auth-options">
                      <label className="flex items-center gap-2 text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer text-xs select-none">
                        <input
                          type="checkbox"
                          checked={saveLogin}
                          onChange={(e) => setSaveLogin(e.target.checked)}
                          className="rounded border-zinc-800 bg-black/60 text-indigo-500 focus:ring-indigo-600 focus:ring-offset-zinc-900 focus:ring-2 h-3.5 w-3.5 cursor-pointer accent-indigo-500"
                        />
                        <span>Lembrar meu e-mail</span>
                      </label>
                      
                      {emailForm && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailForm('');
                            localStorage.removeItem('saved_email');
                          }}
                          className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 hover:text-zinc-300 transition-all font-semibold"
                          title="Limpar e-mail salvo para permitir que outro usuário faça login"
                        >
                          Usar outra conta
                        </button>
                      )}
                    </div>

                    {authError && (
                      <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/15 rounded-xl text-[10.5px] text-red-400 block leading-relaxed" id="auth-error-banner">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <div className="flex justify-center pt-2">
                      <button
                        type="submit"
                        disabled={authFormLoading}
                        className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/10 active:scale-98 transition-all rounded-xl text-xs text-white font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                      >
                        {authFormLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <>
                            <LogIn size={13} className="shrink-0" />
                            <span>Entrar no Sistema</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer Area */}
        <footer className="w-full max-w-7xl mx-auto border-t border-zinc-800/60 pt-4 text-center text-[11px] text-zinc-500 flex flex-col md:flex-row items-center justify-between gap-2.5" id="landing-footer">
          <p>© 2026 Mídia Indoor Pro. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 flex items-center gap-1">
              <Shield size={12} className="text-indigo-400" />
              <span>Conexão Segura Integrada</span>
            </span>
          </div>
        </footer>
      </div>
    );
  }

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
          key={refreshKey}
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
            <div className="glassmorphism py-2 px-4 rounded-full flex items-center gap-3 shadow-xl pointer-events-auto border border-zinc-700/60 max-w-full overflow-x-auto">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2 h-2 rounded-full bg-red-500 shrink-0 ${isSyncing ? 'animate-ping' : 'animate-pulse'}`} />
                <span className="text-[11px] font-mono font-medium text-zinc-300 tracking-wide truncate max-w-[80px] md:max-w-[120px]">
                  {isSyncing ? 'Sincronizando...' : isSettingsOpen ? 'Configurando...' : 'Vídeo Ativo'}
                </span>
              </div>
              <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />
              <button
                onClick={() => setViewMode('landing')}
                className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white transition-all bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-full cursor-pointer hover:bg-zinc-800 hover:scale-105 active:scale-95 shadow-md font-sans shrink-0"
                id="hud-trigger-home"
                title="Voltar à tela inicial ou Log Out"
              >
                <Home size={12} className="text-zinc-400 shrink-0" />
                <span>Voltar ao Início</span>
              </button>
              {currentUser && (
                <>
                  <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />
                  <button
                    onClick={handleSignOutClick}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-all bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/30 px-2.5 py-1 rounded-full cursor-pointer hover:scale-105 active:scale-95 shadow-md font-sans shrink-0"
                    id="hud-trigger-logout"
                    title="Sair da Conta (Logout)"
                  >
                    <LogOut size={12} className="shrink-0" />
                    <span>Sair</span>
                  </button>
                </>
              )}
              <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white transition-all bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-full cursor-pointer hover:bg-zinc-800 hover:scale-105 active:scale-95 shadow-md font-sans shrink-0"
                id="hud-trigger-refresh"
                title="Sincronizar vídeo ao vivo"
              >
                <RefreshCw size={12} className={`text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizar AO VIVO</span>
              </button>
              <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white transition-all bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-full cursor-pointer hover:bg-zinc-800 hover:scale-105 active:scale-95 shadow-md font-sans shrink-0"
                id="hud-trigger-settings"
              >
                <Settings size={12} className="text-red-400 rotate-45 shrink-0" />
                <span>Painel de Ajustes</span>
              </button>
              <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white transition-all bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-full cursor-pointer hover:bg-zinc-800 hover:scale-105 active:scale-95 shadow-md font-sans shrink-0"
                id="hud-trigger-fullscreen"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 size={12} className="text-blue-400 shrink-0" />
                    <span>Sair Cheia</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={12} className="text-blue-400 shrink-0" />
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
              onLogout={() => {
                setViewMode('landing');
                setIsSettingsOpen(false);
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

