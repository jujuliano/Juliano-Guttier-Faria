import { AppConfig } from '../types';

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats.
 */
export function getYouTubeVideoId(url: string): string | null {
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;

  // If it's already an 11-character ID, return it
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  const regexes = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /youtube\.com\/shorts\/([^"&?\/\s]{11})/i,
    /youtube\.com\/embed\/([^"&?\/\s]{11})/i,
    /youtube\.com\/watch\?v=([^"&?\/\s]{11})/i,
  ];

  for (const regex of regexes) {
    const match = cleanUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Fallback pattern match for any 11-char string following an equal sign or slash
  const fallbackMatch = cleanUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1];
  }

  return null;
}

/**
 * Transforms a standard Dropbox shared link (e.g. ending in dl=0)
 * into a direct raw download URL suitable for an image src attribute.
 */
export function transformDropboxUrl(url: string): string {
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  // Return standard data URLs as-is
  if (cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }

  try {
    const parsedUrl = new URL(cleanUrl);
    
    // Check if it's a Dropbox URL
    if (
      parsedUrl.hostname.includes('dropbox.com') ||
      parsedUrl.hostname === 'db.tt'
    ) {
      // Modern approach: replace hostname with dl.dropboxusercontent.com
      parsedUrl.hostname = 'dl.dropboxusercontent.com';
      
      // Remove any parameters that block raw serving, and force raw=1
      parsedUrl.searchParams.set('raw', '1');
      parsedUrl.searchParams.delete('dl');
      
      return parsedUrl.toString();
    }
  } catch (e) {
    // String replacement fallback if native URL parsing fails
    if (cleanUrl.includes('dropbox.com')) {
      let modified = cleanUrl
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('dropbox.com', 'dl.dropboxusercontent.com');

      if (modified.includes('dl=0')) {
        modified = modified.replace('dl=0', 'raw=1');
      } else if (!modified.includes('raw=1')) {
        modified += (modified.includes('?') ? '&' : '?') + 'raw=1';
      }
      return modified;
    }
  }

  return cleanUrl;
}

/**
 * Transforms a standard MS OneDrive shared link into a direct raw download URL.
 */
export function transformOneDriveUrl(url: string): string {
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  // If it's already a direct API link, leave as-is
  if (cleanUrl.includes('api.onedrive.com')) {
    return cleanUrl;
  }

  try {
    if (cleanUrl.includes('onedrive.live.com') || cleanUrl.includes('1drv.ms') || cleanUrl.includes('sharepoint.com')) {
      // Create direct link by base64 encoding the share link
      // Pattern supported officially by Microsoft Graph Shares API
      const base64 = btoa(cleanUrl);
      const urlSafeBase64 = base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''); // Strip padding character "="
      
      return `https://api.onedrive.com/v1.0/shares/u!${urlSafeBase64}/root/content`;
    }
  } catch (e) {
    console.error('Failed to transform OneDrive link', e);
  }

  return cleanUrl;
}

/**
 * Automatically detects whether the link belongs to Dropbox, OneDrive or Unsplash/Generic
 * and returns the converted direct raw visual media asset URL.
 */
export function transformImageSourceUrl(url: string): string {
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  if (cleanUrl.includes('dropbox.com') || cleanUrl.includes('db.tt')) {
    return transformDropboxUrl(cleanUrl);
  }

  if (cleanUrl.includes('onedrive.live.com') || cleanUrl.includes('1drv.ms') || cleanUrl.includes('sharepoint.com')) {
    return transformOneDriveUrl(cleanUrl);
  }

  return cleanUrl;
}

/**
 * Extracts a Google Drive file ID from standard sharing URLs.
 */
export function getGoogleDriveFileId(url: string): string | null {
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;
  const match = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]{28,45})/i) || 
                cleanUrl.match(/\/d\/([a-zA-Z0-9_-]{28,45})/i) || 
                cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]{28,45})/i);
  return match ? match[1] : null;
}

/**
 * Transforms a Google Drive image URL or file ID into a proxy link.
 */
export function transformDriveImageUrl(url: string): string {
  if (!url) return '';
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    return `/api/drive-image-proxy?id=${fileId}`;
  }
  return transformImageSourceUrl(url); // Fallback to other checks
}


/**
 * Parses query parameters from a URL and merges them with the default configuration.
 * This allows quick deployment of screens with unique media links.
 */
export function parseUrlConfig(urlStr: string, baseConfig: AppConfig): AppConfig {
  try {
    const url = new URL(urlStr);
    const params = url.searchParams;
    const config = { ...baseConfig };

    if (params.has('v')) {
      const vVal = params.get('v') || '';
      if (vVal.length === 11) {
        config.youtubeUrl = `https://www.youtube.com/watch?v=${vVal}`;
      } else {
        config.youtubeUrl = decodeURIComponent(vVal);
      }
    }
    
    if (params.has('db')) config.dropboxUrl = decodeURIComponent(params.get('db') || '');
    if (params.has('drive')) config.driveFolderUrl = decodeURIComponent(params.get('drive') || '');
    if (params.has('corner')) {
      const c = params.get('corner');
      if (c === 'top-left' || c === 'top-right' || c === 'bottom-left' || c === 'bottom-right' || c === 'center') {
        config.corner = c;
      }
    }
    if (params.has('size')) config.imageSize = Number(params.get('size')) || config.imageSize;
    if (params.has('maxw')) config.imageMaxWidth = Number(params.get('maxw')) || config.imageMaxWidth;
    if (params.has('maxh')) config.imageMaxHeight = Number(params.get('maxh')) || config.imageMaxHeight;
    if (params.has('opacity')) config.imageOpacity = Number(params.get('opacity')) || config.imageOpacity;
    if (params.has('radius')) config.imageBorderRadius = Number(params.get('radius')) || config.imageBorderRadius;
    if (params.has('margin')) config.imageMargin = Number(params.get('margin')) || config.imageMargin;
    if (params.has('animdur')) {
      const val = Number(params.get('animdur'));
      if (val >= 0.1 && val <= 3.0) {
        config.imageAnimationDuration = val;
      }
    }
    
    // Playback settings
    if (params.has('loop')) config.videoLoop = params.get('loop') === 'true' || params.get('loop') === '1';
    if (params.has('mute')) config.videoMuted = params.get('mute') === 'true' || params.get('mute') === '1';
    if (params.has('autoplay')) config.videoAutoplay = params.get('autoplay') === 'true' || params.get('autoplay') === '1';
    if (params.has('controls')) config.videoControls = params.get('controls') === 'true' || params.get('controls') === '1';

    // Mídia Indoor
    if (params.has('clock')) config.showClock = params.get('clock') === 'true' || params.get('clock') === '1';
    if (params.has('clockcorner')) {
      const cc = params.get('clockcorner');
      if (cc === 'top-left' || cc === 'top-right' || cc === 'bottom-left' || cc === 'bottom-right') {
        config.clockCorner = cc;
      }
    }
    if (params.has('clocksize')) {
      const cs = params.get('clocksize');
      if (cs === 'sm' || cs === 'md' || cs === 'lg') {
        config.clockSize = cs;
      }
    }
    
    if (params.has('ticker')) config.showTicker = params.get('ticker') === 'true' || params.get('ticker') === '1';
    if (params.has('text')) config.tickerText = decodeURIComponent(params.get('text') || '');
    if (params.has('speed')) config.tickerSpeed = Number(params.get('speed')) || config.tickerSpeed;
    if (params.has('bg')) {
      const bgVal = params.get('bg') || '';
      config.tickerBgColor = bgVal === 'transparent' ? 'transparent' : '#' + bgVal.replace('#', '');
    }
    if (params.has('fg')) config.tickerTextColor = '#' + (params.get('fg') || '').replace('#', '');
    if (params.has('interval')) config.slideshowInterval = Number(params.get('interval')) || config.slideshowInterval;
    if (params.has('pause')) {
      const pVal = params.get('pause');
      if (pVal !== null) config.slideshowPauseTime = Number(pVal);
    }
    if (params.has('anim')) {
      const animType = params.get('anim');
      if (animType === 'fade' || animType === 'scale-up' || animType === 'scale-down') {
        config.imageAnimationType = animType;
      }
    }
    if (params.has('usetickerfile')) config.useDriveTickerText = params.get('usetickerfile') === 'true' || params.get('usetickerfile') === '1';
    if (params.has('tickerfileurl')) config.tickerDriveFileUrl = decodeURIComponent(params.get('tickerfileurl') || '');
    if (params.has('usedrivelink')) config.useDriveImageLink = params.get('usedrivelink') === 'true' || params.get('usedrivelink') === '1';
    if (params.has('linkfileurl')) config.imageLinkDriveFileUrl = decodeURIComponent(params.get('linkfileurl') || '');
    if (params.has('tickersize')) config.tickerFontSize = Number(params.get('tickersize')) || config.tickerFontSize;
    if (params.has('usedriveyoutube')) config.useDriveYoutubeUrl = params.get('usedriveyoutube') === 'true' || params.get('usedriveyoutube') === '1';
    if (params.has('youtubefileurl')) config.youtubeDriveFileUrl = decodeURIComponent(params.get('youtubefileurl') || '');

    // TV & Older Android Box Optimizations
    if (params.has('tvmode')) config.tvMode = params.get('tvmode') === 'true' || params.get('tvmode') === '1';
    if (params.has('scale')) config.tvFontScale = Number(params.get('scale')) || config.tvFontScale;
    if (params.has('dpad')) config.dpadNavigation = params.get('dpad') === 'true' || params.get('dpad') === '1';

    // Background type and links
    if (params.has('bgtype')) {
      const bt = params.get('bgtype');
      if (bt === 'video' || bt === 'image') config.backgroundType = bt;
    }
    if (params.has('bgimg')) config.backgroundImageUrl = decodeURIComponent(params.get('bgimg') || '');
    if (params.has('usedrivebgimg')) config.useDriveBackgroundImageUrl = params.get('usedrivebgimg') === 'true' || params.get('usedrivebgimg') === '1';
    if (params.has('bgimgfileurl')) config.backgroundImageDriveFileUrl = decodeURIComponent(params.get('bgimgfileurl') || '');

    return config;
  } catch (e) {
    console.error('Error parsing URL configuration', e);
    return baseConfig;
  }
}

/**
 * Generates an automated launch URL containing the configuration as query parameters.
 */
export function generateConfigUrl(baseUrl: string, config: AppConfig): string {
  try {
    const url = new URL(baseUrl);
    
    // Extract video ID to keep sharing link short if possible
    const videoId = getYouTubeVideoId(config.youtubeUrl);
    url.searchParams.set('v', videoId || encodeURIComponent(config.youtubeUrl));
    
    if (config.dropboxUrl) url.searchParams.set('db', encodeURIComponent(config.dropboxUrl));
    if (config.driveFolderUrl) url.searchParams.set('drive', encodeURIComponent(config.driveFolderUrl));
    url.searchParams.set('corner', config.corner);
    url.searchParams.set('size', config.imageSize.toString());
    url.searchParams.set('maxw', config.imageMaxWidth.toString());
    url.searchParams.set('maxh', config.imageMaxHeight.toString());
    url.searchParams.set('opacity', config.imageOpacity.toString());
    url.searchParams.set('radius', config.imageBorderRadius.toString());
    url.searchParams.set('margin', config.imageMargin.toString());
    url.searchParams.set('animdur', config.imageAnimationDuration.toString());
    
    url.searchParams.set('loop', config.videoLoop ? '1' : '0');
    url.searchParams.set('mute', config.videoMuted ? '1' : '0');
    url.searchParams.set('autoplay', config.videoAutoplay ? '1' : '0');
    url.searchParams.set('controls', config.videoControls ? '1' : '0');

    url.searchParams.set('clock', config.showClock ? '1' : '0');
    url.searchParams.set('clockcorner', config.clockCorner);
    url.searchParams.set('clocksize', config.clockSize);
    url.searchParams.set('ticker', config.showTicker ? '1' : '0');
    if (config.tickerText) url.searchParams.set('text', encodeURIComponent(config.tickerText));
    url.searchParams.set('speed', config.tickerSpeed.toString());
    url.searchParams.set('bg', config.tickerBgColor === 'transparent' ? 'transparent' : config.tickerBgColor.replace('#', ''));
    url.searchParams.set('fg', config.tickerTextColor.replace('#', ''));
    url.searchParams.set('interval', config.slideshowInterval.toString());
    url.searchParams.set('pause', config.slideshowPauseTime.toString());
    url.searchParams.set('anim', config.imageAnimationType);
    url.searchParams.set('usetickerfile', config.useDriveTickerText ? '1' : '0');
    if (config.tickerDriveFileUrl) url.searchParams.set('tickerfileurl', encodeURIComponent(config.tickerDriveFileUrl));
    url.searchParams.set('usedrivelink', config.useDriveImageLink ? '1' : '0');
    if (config.imageLinkDriveFileUrl) url.searchParams.set('linkfileurl', encodeURIComponent(config.imageLinkDriveFileUrl));
    url.searchParams.set('tickersize', config.tickerFontSize.toString());
    url.searchParams.set('usedriveyoutube', config.useDriveYoutubeUrl ? '1' : '0');
    if (config.youtubeDriveFileUrl) url.searchParams.set('youtubefileurl', encodeURIComponent(config.youtubeDriveFileUrl));

    url.searchParams.set('bgtype', config.backgroundType);
    url.searchParams.set('bgimg', encodeURIComponent(config.backgroundImageUrl));
    url.searchParams.set('usedrivebgimg', config.useDriveBackgroundImageUrl ? '1' : '0');
    if (config.backgroundImageDriveFileUrl) url.searchParams.set('bgimgfileurl', encodeURIComponent(config.backgroundImageDriveFileUrl));

    // TV & Older Android Box Optimizations
    url.searchParams.set('tvmode', config.tvMode ? '1' : '0');
    url.searchParams.set('scale', config.tvFontScale.toString());
    url.searchParams.set('dpad', config.dpadNavigation ? '1' : '0');

    return url.toString();
  } catch (e) {
    return baseUrl;
  }
}

/**
 * Premium default presets for instant satisfaction when opening the app.
 */
export const PRESETS = {
  videos: [
    {
      id: 'hBgK_0O9u5Q',
      title: 'Chuva Relaxante em Tóquio (Ambiente)',
      url: 'https://www.youtube.com/watch?v=hBgK_0O9u5Q',
    },
    {
      id: 'jfKfPfyJRdk',
      title: 'Canal de Rádio Lofi Girl (Chill)',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    },
    {
      id: 'Ke1_xX6C-zU',
      title: 'Rio de Floresta em Ultra HD (Natureza)',
      url: 'https://www.youtube.com/watch?v=Ke1_xX6C-zU',
    },
    {
      id: 'CozyCabin',
      idActual: 'HxoXmQ8m5kM',
      title: 'Cabana Rústica com Lareira (Aconchegante)',
      url: 'https://www.youtube.com/watch?v=HxoXmQ8m5kM',
    },
  ],
  images: [
    {
      name: 'Logo Premium Transparente (Padrão)',
      url: 'https://dl.dropboxusercontent.com/scl/fi/7m96m6n5fom85oiyc8dsu/crown_watermark.png?rlkey=hz9bybepmgh7p5isbyesf1or6&raw=1',
      fallback: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300&auto=format&fit=crop',
    },
    {
      name: 'Badge Studio Minimalista',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop',
    },
    {
      name: 'Ícone Cyber Tech Neon',
      url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop',
    }
  ]
};

export const DEFAULT_CONFIG: AppConfig = {
  youtubeUrl: 'https://www.youtube.com/watch?v=Ke1_xX6C-zU',
  dropboxUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300&auto=format&fit=crop',
  driveFolderUrl: 'https://drive.google.com/drive/folders/1lS0Pwe_qD7dWTrtgxs_Afjzyd5oCFoaJ?usp=drive_link', // Default requested Google Drive folder
  corner: 'bottom-right',
  imageSize: 180,
  imageMaxWidth: 380,
  imageMaxHeight: 380,
  imageOpacity: 100, // Make it fully visible by default as requested
  imageClickable: false,
  imageLink: '',
  imageBorderRadius: 16,
  imageMargin: 24,
  imageAnimationDuration: 0.6,
  hideUIWhenIdle: true,
  videoLoop: true,
  videoMuted: false,
  videoAutoplay: true,
  videoControls: false,
  backgroundType: 'video',
  backgroundImageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200&auto=format&fit=crop',
  useDriveBackgroundImageUrl: false,
  backgroundImageDriveFileUrl: '',
  // Midia Indoor defaults
  showClock: true,
  clockCorner: 'top-right',
  clockSize: 'md',
  showTicker: true,
  tickerText: '★ YT Mídia Indoor | Fique por dentro das novidades | Soluções completas de sinalização digital e entretenimento ★',
  tickerSpeed: 30,
  tickerBgColor: '#000000',
  tickerTextColor: '#ffffff',
  slideshowInterval: 10,
  slideshowPauseTime: 1, // 1 second blank pause between transitions by default
  imageAnimationType: 'scale-down', // shrink to center animation on entry
  useDriveTickerText: true, // Enabled by default to read from user's Drive file
  tickerDriveFileUrl: 'https://drive.google.com/file/d/1oyDcM3oNNkkMcZVbr4ZYmlP77am_HVW_/view?usp=drive_link', // Shared Google Drive txt file link requested by user
  useDriveImageLink: true, // Fetch click link from text file if enabled
  imageLinkDriveFileUrl: 'https://drive.google.com/file/d/1zagqw2WudDeMfdEoCRsnnYeGPHt49y7q/view?usp=drive_link', // User's requested default for direct site link source
  tickerFontSize: 14, // Default letreiro font size
  useDriveYoutubeUrl: true, // Enabled by default to read from user's Drive file
  youtubeDriveFileUrl: 'https://drive.google.com/file/d/1zagqw2WudDeMfdEoCRsnnYeGPHt49y7q/view?usp=drive_link', // Shared Google Drive txt file link for video URL
  // TV & Older Android Box Optimizations
  tvMode: false, // Low-spec stability option (replaces CPU-demanding backdrop blurred layers with solid ones)
  tvFontScale: 100, // Multiplier for visual elements (50% to 200%)
  dpadNavigation: true, // Immediate TV Remote focus control
};
