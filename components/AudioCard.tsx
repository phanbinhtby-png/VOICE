
import React, { useState, useRef, useEffect } from 'react';
import { AudioItem } from '../types';

interface AudioCardProps {
  item: AudioItem;
  onDelete: (id: string) => void;
  onRegenerate: (item: AudioItem) => void;
  isRegenerating?: boolean;
  regenerationProgress?: number;
}

const AudioCard: React.FC<AudioCardProps> = ({ 
  item, 
  onDelete, 
  onRegenerate, 
  isRegenerating = false, 
  regenerationProgress = 0 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [item.audioUrl]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // SVG circular progress parameters
  const size = 48;
  const strokeWidth = 3;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (regenerationProgress / 100) * circumference;

  return (
    <div className={`bg-slate-900 rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col space-y-3 hover:bg-slate-800/50 transition-all group relative overflow-hidden ${isRegenerating ? 'ring-1 ring-indigo-500/30 bg-indigo-500/5' : ''}`}>
      <audio ref={audioRef} src={item.audioUrl} className="hidden" />
      
      <div className="flex items-center space-x-4">
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          {isRegenerating ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke="rgba(30, 41, 59, 0.5)"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke="#6366f1"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  style={{ 
                    strokeDashoffset: offset,
                    transition: 'stroke-dashoffset 0.3s ease-in-out'
                  }}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-indigo-400 font-mono">
                {Math.round(regenerationProgress)}%
              </span>
            </div>
          ) : (
            <button 
              onClick={togglePlay}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isPlaying ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-slate-800 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400'
              }`}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
              ) : (
                <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 line-clamp-1">{item.text}</p>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.voice}</span>
            <span className="text-slate-700 text-xs">•</span>
            <span className="text-[10px] font-mono text-slate-500">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isRegenerating && (
            <button 
              onClick={() => onRegenerate(item)}
              className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
              title="Tạo lại giọng nói cho phần này"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button 
            onClick={() => onDelete(item.id)}
            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
            title="Xóa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3 pt-1">
        <span className="text-[10px] font-mono text-slate-500 w-8">{formatTime(currentTime)}</span>
        <input 
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
        />
        <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default AudioCard;
