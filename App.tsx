
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from './components/Header';
import AudioCard from './components/AudioCard';
import { VoiceName, AudioItem } from './types';
import { generateTTS } from './services/geminiService';
import { audioBufferToWav, decode, mergeAudioBuffers } from './utils/audioUtils';
import * as Storage from './utils/storage';

const MAX_CHARS = 20000;
const CHUNK_SIZE = 3000;

function splitTextIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let currentText = text;

  while (currentText.length > 0) {
    if (currentText.length <= maxSize) {
      chunks.push(currentText);
      break;
    }

    let splitIndex = maxSize;
    const lookbackRange = Math.min(maxSize, 500);
    const searchArea = currentText.substring(maxSize - lookbackRange, maxSize);
    
    const lastPunctuation = Math.max(
      searchArea.lastIndexOf('. '),
      searchArea.lastIndexOf('? '),
      searchArea.lastIndexOf('! '),
      searchArea.lastIndexOf('\n')
    );

    if (lastPunctuation !== -1) {
      splitIndex = (maxSize - lookbackRange) + lastPunctuation + 1;
    } else {
      const lastSpace = searchArea.lastIndexOf(' ');
      if (lastSpace !== -1) {
        splitIndex = (maxSize - lookbackRange) + lastSpace + 1;
      }
    }

    chunks.push(currentText.substring(0, splitIndex).trim());
    currentText = currentText.substring(splitIndex).trim();
  }
  return chunks;
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.CHARON);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPartInfo, setCurrentPartInfo] = useState<{current: number, total: number} | null>(null);
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
  const [lastBatchCount, setLastBatchCount] = useState<number>(0);
  const [lastBatchIds, setLastBatchIds] = useState<string[]>([]);
  
  // States for specific item regeneration
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenProgress, setRegenProgress] = useState(0);
  
  const progressIntervalRef = useRef<number | null>(null);
  const regenIntervalRef = useRef<number | null>(null);
  const isAbortedRef = useRef<boolean>(false);

  const charCount = inputText.length;
  const charPercentage = Math.min(100, (charCount / MAX_CHARS) * 100);
  const isOverLimit = charCount > MAX_CHARS;

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const storedItems = await Storage.getAllItems();
        const itemsWithUrls = storedItems.map(item => {
          const binary = decode(item.base64Data);
          const blob = new Blob([binary], { type: 'audio/wav' });
          return {
            ...item,
            audioUrl: URL.createObjectURL(blob)
          } as AudioItem;
        });
        setHistory(itemsWithUrls);
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    };
    loadHistory();

    return () => {
      setHistory(prev => {
        prev.forEach(item => URL.revokeObjectURL(item.audioUrl));
        return [];
      });
    };
  }, []);

  // Main generator progress handler
  useEffect(() => {
    if (isLoading && !isMerging && !regeneratingId) {
      setProgress(1);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev;
          const increment = prev < 70 ? (Math.random() * 8 + 3) : (Math.random() * 2 + 0.1);
          return parseFloat((prev + increment).toFixed(1));
        });
      }, 300);
    } else if (!isLoading && !isMerging && !regeneratingId) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (progress > 0 && !isAbortedRef.current) setProgress(100);
      const timer = setTimeout(() => {
        if (!isMerging) setProgress(0);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isLoading, isMerging, regeneratingId]);

  // Specific item regeneration progress handler
  useEffect(() => {
    if (regeneratingId) {
      setRegenProgress(1);
      regenIntervalRef.current = window.setInterval(() => {
        setRegenProgress(prev => {
          if (prev >= 96) return prev;
          const increment = prev < 60 ? (Math.random() * 10 + 5) : (Math.random() * 3 + 1);
          return Math.min(99, prev + increment);
        });
      }, 200);
    } else {
      if (regenIntervalRef.current) clearInterval(regenIntervalRef.current);
      setRegenProgress(0);
    }
    return () => {
      if (regenIntervalRef.current) clearInterval(regenIntervalRef.current);
    };
  }, [regeneratingId]);

  const handleStop = () => {
    isAbortedRef.current = true;
    setIsLoading(false);
    setIsMerging(false);
    setRegeneratingId(null);
    setCurrentPartInfo(null);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (regenIntervalRef.current) clearInterval(regenIntervalRef.current);
  };

  const performMerge = async (items: AudioItem[]): Promise<string> => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sortedItems = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const buffers: AudioBuffer[] = [];
    
    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const response = await fetch(item.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      buffers.push(buffer);
    }
    
    const mergedBuffer = mergeAudioBuffers(buffers, audioContext);
    const wavBlob = audioBufferToWav(mergedBuffer);
    return URL.createObjectURL(wavBlob);
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError("Vui lòng nhập văn bản.");
      return;
    }
    if (isOverLimit) {
      setError("Vượt quá giới hạn ký tự (20,000).");
      return;
    }

    setIsLoading(true);
    setIsMerging(false);
    setError(null);
    setMergedAudioUrl(null);
    isAbortedRef.current = false;

    const chunks = splitTextIntoChunks(inputText, CHUNK_SIZE);
    const totalChunks = chunks.length;
    const sessionItems: AudioItem[] = [];

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (isAbortedRef.current) break;

        setCurrentPartInfo({ current: i + 1, total: totalChunks });
        setProgress(1); 

        const currentText = chunks[i];
        const { audioBuffer } = await generateTTS(currentText, selectedVoice);
        
        if (isAbortedRef.current) break;

        const wavBlob = audioBufferToWav(audioBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(wavBlob);
        });

        const id = Math.random().toString(36).substring(2, 9);
        const timestamp = Date.now() + i; 
        
        const displayLabel = totalChunks > 1 ? `[Phần ${i + 1}/${totalChunks}] ` : '';
        const itemText = displayLabel + currentText;

        const newItem: AudioItem = {
          id,
          text: itemText,
          voice: selectedVoice,
          timestamp,
          audioUrl,
          duration: audioBuffer.duration
        };

        await Storage.saveItem({
          id,
          text: itemText,
          voice: selectedVoice,
          timestamp,
          duration: audioBuffer.duration,
          base64Data
        });

        sessionItems.push(newItem);
        setHistory(prev => [newItem, ...prev]);
        
        if (i < totalChunks - 1) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
      
      if (!isAbortedRef.current && totalChunks > 1) {
        setIsMerging(true);
        setCurrentPartInfo(null);
        setProgress(5);
        const url = await performMerge(sessionItems);
        setMergedAudioUrl(url);
        setLastBatchCount(totalChunks);
        setLastBatchIds(sessionItems.map(item => item.id));
        setProgress(100);
      }
    } catch (err: any) {
      if (!isAbortedRef.current) {
        setError(err.message || "Đã có lỗi xảy ra khi tạo giọng nói.");
      }
    } finally {
      setIsLoading(false);
      setIsMerging(false);
    }
  };

  const handleRegenerate = async (item: AudioItem) => {
    if (isLoading || isMerging || regeneratingId) return;
    
    setRegeneratingId(item.id);
    setError(null);
    isAbortedRef.current = false;

    try {
      const cleanText = item.text.replace(/^\[Phần \d+\/\d+\] /, '');
      const { audioBuffer } = await generateTTS(cleanText, item.voice);
      
      const wavBlob = audioBufferToWav(audioBuffer);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(wavBlob);
      });

      const updatedItem: AudioItem = {
        ...item,
        audioUrl,
        duration: audioBuffer.duration
      };

      await Storage.saveItem({
        id: item.id,
        text: item.text,
        voice: item.voice,
        timestamp: item.timestamp,
        duration: audioBuffer.duration,
        base64Data
      });

      setRegenProgress(100);
      setHistory(prev => prev.map(h => h.id === item.id ? updatedItem : h));

      // Re-trigger auto-merge if this item is part of the current session batch
      if (lastBatchIds.includes(item.id)) {
        setIsMerging(true);
        // Get latest history from state
        setHistory(currentHistory => {
          const itemsToMerge = currentHistory.filter(h => lastBatchIds.includes(h.id));
          performMerge(itemsToMerge).then(url => {
            setMergedAudioUrl(url);
            setIsMerging(false);
          });
          return currentHistory;
        });
      }
      
      setTimeout(() => setRegeneratingId(null), 600);
    } catch (err: any) {
      setError("Lỗi khi tạo lại phần này: " + err.message);
      setRegeneratingId(null);
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    try {
      await Storage.deleteItem(id);
      setHistory(prev => {
        const item = prev.find(i => i.id === id);
        if (item) URL.revokeObjectURL(item.audioUrl);
        return prev.filter(i => i.id !== id);
      });
      if (lastBatchIds.includes(id)) {
        setMergedAudioUrl(null);
        setLastBatchIds(prev => prev.filter(bid => bid !== id));
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  }, [lastBatchIds]);

  const handleClearHistory = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử?")) {
      try {
        await Storage.clearAllItems();
        setHistory(prev => {
          prev.forEach(item => URL.revokeObjectURL(item.audioUrl));
          return [];
        });
        setMergedAudioUrl(null);
        setLastBatchIds([]);
      } catch (err) {
        console.error("Failed to clear history:", err);
      }
    }
  };

  const handleDownloadAllIndividual = () => {
    if (history.length === 0) return;
    history.forEach((item, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = item.audioUrl;
        const safeName = item.text.substring(0, 30).replace(/[/\\?%*:|"<>]/g, '-').trim();
        link.download = `${safeName || 'voice'}-${item.id}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 250);
    });
  };

  const handleDownloadMerged = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `voice-studio-full-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const voices = useMemo(() => [
    VoiceName.CHARON,
    VoiceName.KORE,
    VoiceName.PUCK,
    VoiceName.FENRIR,
    VoiceName.ZEPHYR
  ], []);

  return (
    <div className="min-h-screen flex flex-col pb-12 bg-slate-950 text-white">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-bold text-slate-100">Soạn thảo văn bản</label>
              <div className="flex flex-col items-end">
                <div className={`text-sm font-medium ${isOverLimit ? 'text-red-400' : 'text-slate-400'}`}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} ({charPercentage.toFixed(1)}%)
                </div>
                <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${isOverLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${charPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <textarea
              className="w-full h-80 p-5 bg-slate-950/50 border border-white/5 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-950 transition-all text-slate-200 leading-relaxed placeholder:text-slate-600"
              placeholder="Nhập nội dung bạn muốn chuyển sang giọng nói vào đây..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chọn giọng nói</label>
                <div className="grid grid-cols-3 gap-2">
                  {voices.map((voice) => (
                    <button
                      key={voice}
                      onClick={() => setSelectedVoice(voice)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                        selectedVoice === voice 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {voice}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-end">
                {(isLoading || isMerging) && !regeneratingId && (
                   <div className="mb-3 bg-slate-950/50 p-3 rounded-2xl border border-indigo-500/20">
                     <div className="flex justify-between items-center mb-1.5">
                       <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                         {isMerging ? 'Đang cập nhật bản đầy đủ...' : (currentPartInfo ? `Đang tạo Phần ${currentPartInfo.current}/${currentPartInfo.total}` : 'Đang xử lý...')}
                       </span>
                       <span className="text-sm font-mono font-bold text-indigo-400">
                         {progress}%
                       </span>
                     </div>
                     <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-[2px]">
                       <div 
                         className={`h-full bg-gradient-to-r ${isMerging ? 'from-emerald-500 to-indigo-500' : 'from-indigo-600 to-purple-500'} rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]`}
                         style={{ width: `${progress}%` }}
                       ></div>
                     </div>
                   </div>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || isMerging || !!regeneratingId || !inputText.trim() || isOverLimit}
                    className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all shadow-xl ${
                      isLoading || isMerging || regeneratingId || !inputText.trim() || isOverLimit
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none'
                        : 'gradient-bg text-white hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] shadow-indigo-500/10'
                    }`}
                  >
                    {isLoading || isMerging ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{isMerging ? 'Đang ghép nối...' : `Phần ${currentPartInfo?.current}: ${progress}%`}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Tạo giọng nói ngay</span>
                      </>
                    )}
                  </button>

                  {(isLoading || isMerging || !!regeneratingId) && (
                    <button
                      onClick={handleStop}
                      className="px-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 font-bold hover:bg-red-500/20 transition-all flex items-center justify-center"
                      title="Dừng tạo"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {mergedAudioUrl && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between animate-fade-in ring-1 ring-emerald-500/20">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-100">Cập nhật bản đầy đủ ({lastBatchCount} phần)</h4>
                    <p className="text-[10px] text-emerald-300 uppercase tracking-widest font-bold">Bản nối mới nhất đã sẵn sàng</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownloadMerged(mergedAudioUrl)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-xl shadow-emerald-500/20 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Tải bản đầy đủ</span>
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-start space-x-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-100">Lịch sử studio</h2>
            <div className="flex items-center space-x-3">
              {history.length > 0 && (
                <>
                  <button 
                    onClick={handleDownloadAllIndividual}
                    className="text-[10px] font-bold text-slate-400 uppercase hover:text-slate-300 transition-colors flex items-center space-x-1"
                    title="Tải riêng lẻ từng file"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Tải tất cả</span>
                  </button>
                  <button 
                    onClick={handleClearHistory}
                    className="text-[10px] font-bold text-red-500 uppercase hover:text-red-400 transition-colors"
                  >
                    Xóa hết
                  </button>
                </>
              )}
              <span className="text-xs font-bold text-slate-500 uppercase bg-slate-900 px-2 py-1 rounded border border-white/5">
                {history.length} Clips
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[640px] pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-900/50 border-2 border-dashed border-white/5 rounded-3xl">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-700">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-slate-400 font-medium">Chưa có bản ghi nào</h3>
                <p className="text-slate-500 text-xs mt-1">Hệ thống sẽ tự động ghép các phần lại khi hoàn tất batch xử lý.</p>
              </div>
            ) : (
              history.map(item => (
                <AudioCard 
                  key={item.id} 
                  item={item} 
                  onDelete={handleDelete} 
                  onRegenerate={handleRegenerate}
                  isRegenerating={regeneratingId === item.id}
                  regenerationProgress={regeneratingId === item.id ? regenProgress : 0}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="mt-auto pt-12 text-center text-slate-600 text-xs">
        <p>&copy; {new Date().getFullYear()} Gemini Voice Studio - Công nghệ giọng nói Google AI tiên tiến nhất.</p>
      </footer>
    </div>
  );
};

export default App;
