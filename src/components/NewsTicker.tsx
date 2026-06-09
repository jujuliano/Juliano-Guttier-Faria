import { motion } from 'motion/react';
import { Radio } from 'lucide-react';

interface NewsTickerProps {
  showTicker: boolean;
  text: string;
  speed: number; // lower means faster iteration, custom speed
  bgColor: string;
  textColor: string;
  fontSize?: number; // font size of the ticker text in pixels
}

export default function NewsTicker({
  showTicker,
  text,
  speed,
  bgColor,
  textColor,
  fontSize = 14,
}: NewsTickerProps) {
  if (!showTicker) return null;

  // Validate or build styles safely
  const customBg = bgColor || '#000000';
  const customFg = textColor || '#ffffff';

  // Make sure text repeats so there's no blank gaps in the loop!
  const textGroup = `${text} \u00a0\u00a0\u00a0\u00a0\u00a0\u00a0 \u2022 \u00a0\u00a0\u00a0\u00a0\u00a0\u00a0 `;
  const repeatedText = Array(8).fill(textGroup).join('');

  // Slower speed = dynamic animation duration
  // Relies on speed range from 1 to 100.
  const clampedSpeed = Math.min(Math.max(1, speed), 100);

  // Power curve speed scaling for a highly requested wider range:
  // Speed of 100 corresponds to 5.0 seconds (fast, readable loop).
  // Speed of 30 (default) corresponds to around 34.3 seconds (comfortable reading speed).
  // Speed of 10 corresponds to around 199.0 seconds (very leisurely).
  // Speed of 1 corresponds to ~7,924 seconds (extremely slow, nearly static).
  const baseDuration = Math.pow(100 / clampedSpeed, 1.6) * 5;

  // Compensate for font size so that the physical horizontal scroll speed (pixels/sec) remains consistent
  // regardless of how large the font size becomes (ranging up to 150px)
  const durationCompensated = baseDuration * (fontSize / 14);
  const duration = Math.min(10000, Math.max(3, durationCompensated));

  // Dynamic bar height proportional to font size
  const barHeight = fontSize + 24;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 border-t border-white/10 z-20 flex items-center overflow-hidden font-sans shadow-2xl select-none"
      style={{ backgroundColor: customBg, height: `${barHeight}px` }}
      id="news-ticker-bar"
    >
      {/* Fixed Glowing badge in the left */}
      <div 
        className="h-full px-4 flex items-center shrink-0 select-none z-30 text-red-500"
        id="ticker-badge"
      >
        <Radio size={Math.max(14, fontSize)} className="animate-spin shrink-0" style={{ animationDuration: '4s' }} />
      </div>

      <div className="relative w-full overflow-hidden h-full flex items-center">
        <motion.div
          key={duration}
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            repeat: Infinity,
            ease: 'linear',
            duration: duration,
          }}
          className="flex whitespace-nowrap font-semibold tracking-wide"
          style={{ color: customFg, fontSize: `${fontSize}px` }}
          id="ticker-animation-wrapper"
        >
          <span className="inline-block pr-4" id="ticker-text-block-1">
            {repeatedText}
          </span>
          <span className="inline-block pr-4" id="ticker-text-block-2">
            {repeatedText}
          </span>
        </motion.div>
      </div>

      {/* Subtle indicator for live time inside the ticker */}
      <div 
        className="h-full px-4 bg-black/40 flex items-center shrink-0 z-30 gap-1 border-l border-zinc-800" 
        id="ticker-aside-clock"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>
    </div>
  );
}
