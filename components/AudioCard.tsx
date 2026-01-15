
import React, { useState, useRef, useEffect } from 'react';
import { AudioItem } from '../types';

interface AudioCardProps {
  item: AudioItem;
  onDelete: (id: string) => void;
}

const AudioCard: React.FC<AudioCardProps> = ({ item, onDelete }) => {
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

  const skipTime = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + amount));
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
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col space-y-3 hover:bg-slate-800/50 transition-all">
      <audio ref={audioRef} src={item.audioUrl} className="hidden" />
      
      <div className="flex items-center space-x-4">
        <button 
          onClick={togglePlay}
          className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center transition-all ${
            isPlaying ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400'
          }`}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
          ) : (
            <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 line-clamp-1">{item.text}</p>
          <div className="flex items-center space-x-3 mt-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-tight">
              {item.voice}
            </span>
            <span className="text-[10px] text-slate-500">
              {new Date(item.timestamp).toLocaleString('vi-VN')}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <a 
            href={item.audioUrl} 
            download={`gemini-audio-${item.id}.wav`}
            className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
            title="Tải về"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
          <button 
            onClick={() => onDelete(item.id)}
            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
            title="Xóa"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col space-y-1 bg-slate-950/30 p-2 rounded-xl border border-white/5">
        <div className="flex items-center space-x-3">
          <button onClick={() => skipTime(-5)} className="text-slate-500 hover:text-indigo-400 transition-colors" title="Lùi 5s">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          
          <input 
            type="range" 
            min="0" 
            max={duration || 0} 
            step="0.01"
            value={currentTime} 
            onChange={handleSeek}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />

          <button onClick={() => skipTime(5)} className="text-slate-500 hover:text-indigo-400 transition-colors" title="Tiến 5s">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>

          <div className="text-[10px] font-mono text-slate-400 min-w-[70px] text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioCard;
