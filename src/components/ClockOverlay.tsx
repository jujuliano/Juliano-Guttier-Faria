import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface ClockOverlayProps {
  showClock: boolean;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: 'sm' | 'md' | 'lg';
  margin: number;
  isTickerActive?: boolean;
}

export default function ClockOverlay({
  showClock,
  corner,
  size,
  margin,
  isTickerActive = false,
}: ClockOverlayProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!showClock) return;
    
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [showClock]);

  if (!showClock) return null;

  // Format date and time in Portuguese
  const formatTime = () => {
    return time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = () => {
    const day = time.toLocaleDateString('pt-BR', { day: '2-digit' });
    const month = time.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const weekday = time.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return `${weekday}, ${day} ${month}`.toUpperCase();
  };

  // Positioning
  const getPositionClasses = () => {
    switch (corner) {
      case 'top-left':
        return 'top-0 left-0';
      case 'top-right':
        return 'top-0 right-0';
      case 'bottom-left':
        return 'bottom-0 left-0';
      case 'bottom-right':
      default:
        return 'bottom-0 right-0';
    }
  };

  // Font size config
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          time: 'text-2xl font-semibold leading-none tracking-tight',
          date: 'text-[10px] tracking-widest text-zinc-400 font-mono mt-0.5',
          box: 'px-4 py-2.5 rounded-xl gap-0.5',
        };
      case 'lg':
        return {
          time: 'text-5xl font-bold leading-none tracking-tighter',
          date: 'text-xs tracking-widest text-zinc-400 font-mono mt-1.5',
          box: 'px-7 py-4.5 rounded-2xl gap-1.5',
        };
      case 'md':
      default:
        return {
          time: 'text-3.5xl font-bold leading-none tracking-tight',
          date: 'text-[11px] tracking-widest text-zinc-400 font-mono mt-1',
          box: 'px-5 py-3.5 rounded-xl gap-1',
        };
    }
  };

  const { time: timeClass, date: dateClass, box: boxClass } = getSizeStyles();

  const containerStyle = {
    padding: `${margin}px`,
    paddingBottom: isTickerActive && (corner === 'bottom-left' || corner === 'bottom-right')
      ? `${margin + 44}px`
      : `${margin}px`,
  };

  return (
    <div
      className={`absolute ${getPositionClasses()} z-10 select-none transition-all duration-500`}
      style={containerStyle}
      id="clock-overlay-outer"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`glassmorphism flex flex-col items-center justify-center font-sans text-white border-white/10 ${boxClass} shadow-3xl text-center`}
        id="clock-overlay-container"
      >
        <span className={`${timeClass} font-mono`} id="clock-overlay-time">
          {formatTime()}
        </span>
        <span className={`${dateClass} uppercase`} id="clock-overlay-date">
          {formatDate()}
        </span>
      </motion.div>
    </div>
  );
}
