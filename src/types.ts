export interface AppConfig {
  youtubeUrl: string;
  dropboxUrl: string; // for compatibility
  driveFolderUrl: string; // Google Drive folder link
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  imageSize: number; // width in pixels (or max width fallback)
  imageMaxWidth: number; // Maximum width in pixels
  imageMaxHeight: number; // Maximum height in pixels
  imageOpacity: number; // 0 to 100
  imageClickable: boolean; // if true, click opens the link
  imageLink: string; // custom URL file redirects on click
  imageBorderRadius: number; // corner rounding in pixels [0..100]
  imageMargin: number; // margin from corner in pixels [0..60]
  imageAnimationDuration: number; // Animation duration in seconds [0.1..3]
  hideUIWhenIdle: boolean; // auto-hide floating control buttons when idle
  videoLoop: boolean;
  videoMuted: boolean;
  videoAutoplay: boolean;
  videoControls: boolean;
  // Background selection: 'video' | 'image'
  backgroundType: 'video' | 'image';
  backgroundImageUrl: string; // direct image url or Google Drive image share link
  useDriveBackgroundImageUrl: boolean; // if true, reads the image url from a Google Drive txt file
  backgroundImageDriveFileUrl: string; // Google Drive text file link containing background image URL
  // Mídia Indoor additions
  showClock: boolean;
  clockCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  clockSize: 'sm' | 'md' | 'lg';
  showTicker: boolean;
  tickerText: string;
  tickerSpeed: number; // lower is slower, higher is faster
  tickerBgColor: string;
  tickerTextColor: string;
  slideshowInterval: number; // Slideshow rotation time in seconds (e.g. 10s)
  slideshowPauseTime: number; // Blank/empty screen pause interval between images in seconds
  imageAnimationType: 'fade' | 'scale-up' | 'scale-down'; // Selected entrance transition effect
  useDriveTickerText: boolean; // Enables fetching letreiro dynamically from a public Google Drive txt file
  tickerDriveFileUrl: string; // Google Drive file sharing link for the txt file
  useDriveImageLink: boolean; // Enables fetching the click target URL dynamically from a public Google Drive txt file
  imageLinkDriveFileUrl: string; // Google Drive file sharing link for the website URL txt file
  tickerFontSize: number; // Font size of the digital ticker/letreiro in pixels
  useDriveYoutubeUrl: boolean; // Enables fetching the YouTube URL dynamically from a public Google Drive txt file
  youtubeDriveFileUrl: string; // Google Drive file sharing link for the YouTube video URL txt file
  // TV & Older Android Box Optimizations
  tvMode: boolean; // Enables low-spec optimizations (replaces hardware-heavy backdrop-filter blur with solid color background blocks to prevent lagginess and freezes)
  tvFontScale: number; // Overall UI scaling percentage for TV displays (e.g. 100 for default, 50 to 200)
  dpadNavigation: boolean; // Enables remote D-Pad arrow keys focus navigation for settings panel inputs and page elements
  // Firebase Live Sync Properties
  firebaseSyncEnabled: boolean; // Enables remote management synchronisation via cloud Firestore
  firebaseChannelId: string; // The channel identifier or code used for remote real-time control (e.g. "loja_1")
}
