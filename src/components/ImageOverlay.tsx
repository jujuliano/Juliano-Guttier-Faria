import { useState, useEffect } from 'react';
import { ImageOff, ExternalLink, HelpCircle, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageOverlayProps {
  driveFolderUrl: string;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  maxWidth: number;
  maxHeight: number;
  opacity: number;
  clickable: boolean;
  link: string;
  borderRadius: number;
  margin: number;
  isTickerActive?: boolean;
  slideshowInterval: number;
  slideshowPauseTime: number;
  imageAnimationType: 'fade' | 'scale-up' | 'scale-down';
  imageAnimationDuration: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

export default function ImageOverlay({
  driveFolderUrl,
  corner,
  maxWidth,
  maxHeight,
  opacity,
  clickable,
  link,
  borderRadius,
  margin,
  isTickerActive = false,
  slideshowInterval,
  slideshowPauseTime,
  imageAnimationType,
  imageAnimationDuration,
}: ImageOverlayProps) {
  const [images, setImages] = useState<DriveFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showImage, setShowImage] = useState<boolean>(true);

  // Fetch images list from public Google Drive folder proxy backend route
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setHasError(false);

    if (!driveFolderUrl.trim()) {
      setImages([]);
      setIsLoading(false);
      return;
    }

    // Call public proxy endpoint
    fetch(`/api/drive-images?folder=${encodeURIComponent(driveFolderUrl)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Status error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (active) {
          if (data && Array.isArray(data.files) && data.files.length > 0) {
            setImages(data.files);
            setCurrentIndex(0);
            setShowImage(true);
            setHasError(false);
          } else {
            setImages([]);
            setHasError(data?.error ? true : false); // If API structure succeeded but has 0 files or API error
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading images list from server api", err);
        if (active) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [driveFolderUrl]);

  // Slideshow transition interval and pause logic
  useEffect(() => {
    if (images.length === 0) return;
    if (images.length === 1) {
      setShowImage(true);
      return;
    }

    let timer: NodeJS.Timeout;

    if (showImage) {
      // The current image stays on screen for slideshowInterval seconds
      const showingMs = slideshowInterval * 1000;
      timer = setTimeout(() => {
        if (slideshowPauseTime > 0) {
          setShowImage(false);
        } else {
          // Immediately rotate to the next image
          setCurrentIndex((prev) => (prev + 1) % images.length);
        }
      }, showingMs);
    } else {
      // Blank phase represents the transitional interval (pause) between images
      const pausingMs = slideshowPauseTime * 1000;
      timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setShowImage(true);
      }, pausingMs);
    }

    return () => clearTimeout(timer);
  }, [images.length, slideshowInterval, slideshowPauseTime, showImage, currentIndex]);

  // Transform position enum to Tailwind CSS mapping classes
  const getPositionClasses = () => {
    switch (corner) {
      case 'top-left':
        return 'top-0 left-0';
      case 'top-right':
        return 'top-0 right-0';
      case 'bottom-left':
        return 'bottom-0 left-0';
      case 'center':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'bottom-right':
      default:
        return 'bottom-0 right-0';
    }
  };

  const hasNoSource = !driveFolderUrl.trim();

  // Outer container padding + safe area space based on ticker presence
  const containerStyle = {
    padding: `${margin}px`,
    paddingBottom: isTickerActive && (corner === 'bottom-left' || corner === 'bottom-right')
      ? `${margin + 44}px`
      : `${margin}px`,
  };

  // Image layout properties to respect maximal limits & stretch appropriately
  const imageStyle = {
    maxWidth: `${maxWidth}px`,
    maxHeight: `${maxHeight}px`,
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const, // Contain is best to avoid cutoff, but will stretch up to limits
    opacity: opacity / 100,
    borderRadius: `${borderRadius}px`,
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  // Build movement/entrance properties dynamically for Framer Motion
  const getAnimationProps = () => {
    switch (imageAnimationType) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: imageAnimationDuration, ease: 'easeInOut' }
        };
      case 'scale-up':
        return {
          initial: { opacity: 0, scale: 0.6 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.6 },
          transition: { duration: imageAnimationDuration, ease: [0.16, 1, 0.3, 1] }
        };
      case 'scale-down':
      default:
        // Encolher para o centro na entrada: starts big and settles down into place
        return {
          initial: { opacity: 0, scale: 1.25 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.8 },
          transition: { duration: imageAnimationDuration, ease: [0.16, 1, 0.3, 1] }
        };
    }
  };

  const renderImageOnly = () => {
    const activeImage = images[currentIndex];
    if (!activeImage) return null;

    const imageElement = (
      <img
        src={activeImage.url}
        alt={`Slide ${currentIndex + 1}: ${activeImage.name}`}
        style={imageStyle}
        className={`shadow-2xl transition-all duration-300 ${
          clickable ? 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]' : 'pointer-events-none'
        }`}
        id="image-overlay-element"
        referrerPolicy="no-referrer"
      />
    );

    if (clickable && link) {
      return (
        <a 
          href={link.startsWith('http') ? link : `https://${link}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="relative block group pointer-events-auto"
          id="image-overlay-linked-wrapper"
        >
          {imageElement}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white text-xs gap-1 font-mono rounded-[inherit]" style={{ borderRadius: `${borderRadius}px` }}>
            <ExternalLink size={14} className="animate-pulse" />
            <span>Visitar Link</span>
          </div>
        </a>
      );
    }

    return <div className="pointer-events-auto">{imageElement}</div>;
  };

  const renderLoader = () => {
    return (
      <div 
        style={{ width: `${Math.min(maxWidth, 180)}px`, height: '80px' }} 
        className="glassmorphism rounded-xl flex items-center justify-center placeholder-loading-overlay animate-pulse"
        id="overlay-loader"
      >
        <div className="flex flex-col items-center gap-1.5 text-[10px] font-mono text-zinc-400">
          <RefreshCcw className="text-blue-400 animate-spin" size={16} />
          <span>Lendo Drive...</span>
        </div>
      </div>
    );
  };

  const renderStatusCards = () => {
    if (hasNoSource) {
      return (
        <div 
          style={{ width: `${Math.min(maxWidth, 280)}px`, borderRadius: `${borderRadius}px` }}
          className="glassmorphism p-4 text-center border border-zinc-700/50 flex flex-col items-center justify-center text-zinc-400 gap-2 pointer-events-auto"
          id="overlay-no-source"
        >
          <HelpCircle className="text-blue-400/80" size={24} />
          <div className="text-[11px] font-mono leading-tight">Nenhuma pasta do Drive configurada</div>
        </div>
      );
    }

    if (hasError) {
      return (
        <div 
          style={{ width: `${Math.min(maxWidth, 300)}px`, borderRadius: `${borderRadius}px` }}
          className="glassmorphism p-4 text-center border border-dashed border-red-500/30 flex flex-col items-center justify-center text-zinc-300 gap-2 pointer-events-auto shadow-2xl"
          id="overlay-error-state"
        >
          <ImageOff className="text-red-400/80 animate-bounce" size={24} />
          <div className="text-[11px] font-mono leading-tight text-red-200 font-semibold">Falha ao ler o Google Drive</div>
          <p className="text-[9.5px] text-zinc-400 leading-normal">
            Verifique se o link da pasta é público e se possui imagens nela.
          </p>
        </div>
      );
    }

    if (images.length === 0) {
      return (
        <div 
          style={{ width: `${Math.min(maxWidth, 300)}px`, borderRadius: `${borderRadius}px` }}
          className="glassmorphism p-4 text-center border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 gap-2 pointer-events-auto"
          id="overlay-empty-state"
        >
          <ImageOff className="text-amber-400" size={24} />
          <div className="text-[11px] font-mono leading-tight">Nenhuma imagem encontrada</div>
          <p className="text-[9px] text-zinc-500 leading-normal">
            Certifique-se de que a pasta contém arquivos de imagem (JPEG, PNG).
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div 
      className={`absolute ${getPositionClasses()} z-10 select-none flex items-center justify-center`}
      style={containerStyle}
      id="overlay-outer-cnt"
    >
      <AnimatePresence mode="wait">
        {showImage && !isLoading && images.length > 0 && !hasError && !hasNoSource ? (
          <motion.div
            key={`animated-slide-${currentIndex}`}
            {...getAnimationProps()}
            className="relative flex items-center justify-center pointer-events-auto"
          >
            {renderImageOnly()}
          </motion.div>
        ) : !showImage && images.length > 0 && !isLoading && !hasError && !hasNoSource ? (
          // During pause transition phase, we render a silent spacing block or let it shrink to nothing
          null
        ) : (
          // Loaders, onboarding, and error panels
          <motion.div
            key="status-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="relative flex items-center justify-center pointer-events-auto"
          >
            {isLoading ? renderLoader() : renderStatusCards()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
