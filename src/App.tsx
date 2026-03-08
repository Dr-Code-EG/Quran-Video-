import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Download, 
  Settings, 
  Music, 
  Type, 
  Image as ImageIcon, 
  Layers,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Video,
  Eye,
  EyeOff,
  Palette,
  Wind,
  Save,
  Check,
  RefreshCw,
  Info,
  AlertCircle,
  Maximize2
} from 'lucide-react';
import { 
  Surah, 
  Reciter, 
  Verse, 
  RECITERS, 
  ASPECT_RATIOS, 
  ARABIC_FONTS, 
  AMBIENT_SOUNDS, 
  TEMPLATES 
} from './types';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { fetchSurahs, fetchVerses, fetchVerseByVerseData } from './services/quranApi';

export default function App() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(1);
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(RECITERS[0]);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [audioFiles, setAudioFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Visual Settings
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=1080');
  const [isVideoBg, setIsVideoBg] = useState(false);
  const [bgColor, setBgColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(55);
  const [selectedFont, setSelectedFont] = useState(ARABIC_FONTS[0]);
  const [layoutStyle, setLayoutStyle] = useState<'classic' | 'editorial'>('classic');
  
  // Toggles
  const [showTranslation, setShowTranslation] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState('@QuranStudio');
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  
  // Audio
  const [ambientSound, setAmbientSound] = useState(AMBIENT_SOUNDS[0]);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [reciterVolume, setReciterVolume] = useState(1.0);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);
  const ffmpegRef = useRef(new FFmpeg());

  const loadFFmpeg = async (attempt = 0) => {
    setFfmpegError(null);
    const isIsolated = window.crossOriginIsolated;
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    console.log(`FFmpeg Load Attempt ${attempt}: Isolated=${isIsolated}, SAB=${hasSAB}`);
    
    const configs = [
      { base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd', type: 'umd' },
      { base: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd', type: 'umd' },
      { base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.4/dist/umd', type: 'umd' },
      { base: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd', type: 'umd' },
      { base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.2/dist/umd', type: 'umd' },
    ];

    if (attempt >= configs.length) {
      if (!hasSAB) {
        setFfmpegError("المتصفح يمنع تشغيل محرك التصدير لأسباب أمنية (SharedArrayBuffer missing). يرجى فتح الموقع في نافذة جديدة أو تجربة متصفح Chrome.");
      } else {
        setFfmpegError("فشل تحميل محرك التصدير من جميع المصادر المتاحة. قد يكون ذلك بسبب ضعف الاتصال أو قيود الشبكة. يرجى المحاولة لاحقاً.");
      }
      return;
    }

    const { base: baseURL, type } = configs[attempt];
    const ffmpeg = ffmpegRef.current;

    try {
      ffmpeg.on('log', ({ message }) => {
        console.log("FFmpeg Log:", message);
      });

      const loadPromise = (async () => {
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
        const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
        await ffmpeg.load({ coreURL, wasmURL, workerURL });
      })();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("FFmpeg load timeout")), 60000)
      );

      await Promise.race([loadPromise, timeoutPromise]);
      setFfmpegLoaded(true);
      console.log("FFmpeg loaded successfully from:", baseURL);
    } catch (error: any) {
      console.error(`FFmpeg load failed for ${baseURL}:`, error);
      // Try next configuration after a short delay
      setTimeout(() => loadFFmpeg(attempt + 1), 1500);
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoBgRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    fetchSurahs().then(setSurahs);
    // Load saved settings
    const saved = localStorage.getItem('quran_video_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBgImage(parsed.bgImage || bgImage);
        setTextColor(parsed.textColor || textColor);
        setBgColor(parsed.bgColor || bgColor);
        setFontSize(parsed.fontSize || fontSize);
        setWatermarkText(parsed.watermarkText || watermarkText);
      } catch (e) { console.error(e); }
    }
  }, []);

  const saveSettings = () => {
    const settings = { bgImage, textColor, bgColor, fontSize, watermarkText };
    localStorage.setItem('quran_video_settings', JSON.stringify(settings));
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setBgImage(template.bgImage);
    setBgColor(template.bgColor);
    setTextColor(template.textColor);
    setFontSize(template.fontSize);
    setIsVideoBg(false);
    setLayoutStyle(template.id === 'editorial' ? 'editorial' : 'classic');
  };

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const surah = surahs.find(s => s.id === parseInt(e.target.value));
    if (surah) {
      setSelectedSurah(surah);
      setStartVerse(1);
      setEndVerse(Math.min(5, surah.verses_count));
    }
  };

  const loadData = async () => {
    if (!selectedSurah) return;
    setLoading(true);
    try {
      const verseData = await fetchVerses(selectedSurah.id, startVerse, endVerse);
      const audioData = await fetchVerseByVerseData(selectedReciter.id, selectedSurah.id, startVerse, endVerse);
      
      setVerses(verseData);
      setAudioFiles(audioData);
      setCurrentVerseIndex(0);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      ambientAudioRef.current?.pause();
    } else {
      audioRef.current.play();
      if (ambientSound.url) ambientAudioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    if (currentVerseIndex < audioFiles.length - 1) {
      setCurrentVerseIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentVerseIndex(0);
      ambientAudioRef.current?.pause();
    }
  };

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
  }, [currentVerseIndex]);

  // Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      // Clear
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Background (Video or Image)
      if (isVideoBg && videoBgRef.current) {
        const video = videoBgRef.current;
        const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
        const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
        ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
      } else if (bgImage) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = bgImage;
        // Note: For export, we ensure images are loaded before calling render
        if (img.complete) {
          const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width / 2) - (img.width / 2) * scale;
          const y = (canvas.height / 2) - (img.height / 2) * scale;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        } else {
          img.onload = () => {
            // Trigger a re-render once loaded
            if (!isExporting) render();
          };
        }
      } else if (layoutStyle === 'editorial') {
        // Subtle gradient for editorial
        const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#f5f2ed');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Overlay
      if (showOverlay && (isVideoBg || bgImage)) {
        ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw Arabic Text
      if (verses[currentVerseIndex]) {
        if (layoutStyle === 'editorial') {
          // Editorial Layout (Instagram Style)
          const margin = canvas.width * 0.08;
          const maxWidth = canvas.width - (margin * 2);
          
          // 1. Surah Header Frame
          if (selectedSurah) {
            const headerY = canvas.height * 0.15;
            const headerWidth = canvas.width * 0.8;
            const headerHeight = 80;
            const headerX = (canvas.width - headerWidth) / 2;
            
            // Draw Decorative Frame (Instagram/Quranic Style)
            const frameColor = '#c5a059'; // Muted Gold
            ctx.strokeStyle = frameColor;
            ctx.lineWidth = 2;
            
            // Outer double lines
            ctx.strokeRect(headerX, headerY, headerWidth, headerHeight);
            ctx.strokeRect(headerX + 5, headerY + 5, headerWidth - 10, headerHeight - 10);
            
            // Decorative corners
            const accentSize = 12;
            ctx.fillStyle = frameColor;
            
            const corners = [
              [headerX, headerY],
              [headerX + headerWidth, headerY],
              [headerX, headerY + headerHeight],
              [headerX + headerWidth, headerY + headerHeight]
            ];
            
            corners.forEach(([cx, cy]) => {
              ctx.beginPath();
              ctx.arc(cx, cy, accentSize, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.stroke();
            });
            
            // Surah Name in Header
            ctx.fillStyle = '#1a1a1a';
            ctx.font = `bold 36px ${selectedFont.family}`;
            ctx.textAlign = 'center';
            ctx.fillText(`سورة ${selectedSurah.name_arabic}`, canvas.width / 2, headerY + (headerHeight / 2) + 12);
            
            // 2. Arabic Text
            const arabicY = headerY + headerHeight + 150;
            ctx.fillStyle = '#1a1a1a';
            ctx.font = `bold ${fontSize}px ${selectedFont.family}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const verse = verses[currentVerseIndex];
            const text = verse.text_uthmani;
            wrapText(ctx, text, canvas.width / 2, arabicY, maxWidth, fontSize * 1.8);
            
            // 3. Translation Box
            if (showTranslation && verse.translation) {
              const transText = verse.translation!;
              
              // Measure translation text to size the box
              ctx.font = `italic 30px sans-serif`;
              const words = transText.split(' ');
              let line = '';
              let lineCount = 1;
              for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth - 100 && n > 0) {
                  lineCount++;
                  line = words[n] + ' ';
                } else {
                  line = testLine;
                }
              }
              
              const boxPadding = 60;
              const boxHeight = (lineCount * 45) + (boxPadding * 2);
              const transY = arabicY + 400;
              const boxY = transY - (boxHeight / 2);
              
              // Draw Box (Subtle Card)
              ctx.shadowColor = 'rgba(0,0,0,0.05)';
              ctx.shadowBlur = 20;
              ctx.shadowOffsetY = 10;
              ctx.fillStyle = '#f8f9fa';
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(margin, boxY, maxWidth, boxHeight, 40);
              } else {
                ctx.rect(margin, boxY, maxWidth, boxHeight);
              }
              ctx.fill();
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetY = 0;
              
              // Translation Header
              ctx.fillStyle = '#a0a0a0';
              ctx.font = `bold 18px sans-serif`;
              ctx.textAlign = 'left';
              ctx.fillText('SAHEEH INTERNATIONAL (ENGLISH)', margin + 20, boxY - 25);
              
              // Translation Text
              ctx.fillStyle = '#2d3436';
              ctx.font = `italic 30px sans-serif`;
              ctx.textAlign = 'center';
              wrapText(ctx, transText, canvas.width / 2, transY, maxWidth - 120, 45);
            }
          }
        } else {
          // Classic Layout
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${fontSize}px ${selectedFont.family}`;
          
          const text = verses[currentVerseIndex].text_uthmani;
          const maxWidth = canvas.width * 0.85;
          const centerY = canvas.height / 2 - (showTranslation ? 40 : 0);
          wrapText(ctx, text, canvas.width / 2, centerY, maxWidth, fontSize * 1.6);
  
          // Draw Translation
          if (showTranslation && verses[currentVerseIndex].translation) {
            ctx.font = `italic ${fontSize * 0.45}px sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            const transText = verses[currentVerseIndex].translation!;
            wrapText(ctx, transText, canvas.width / 2, centerY + (fontSize * 1.8), maxWidth, fontSize * 0.6);
          }
        }
      }

      // Watermark
      if (showWatermark) {
        ctx.font = `bold 24px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'right';
        ctx.fillText(watermarkText, canvas.width - 40, canvas.height - 40);
      }

      // Surah Info
      if (selectedSurah) {
        ctx.font = `bold 28px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(`${selectedSurah.name_arabic} | الآية ${startVerse + currentVerseIndex}`, 40, canvas.height - 40);
      }

      if (isVideoBg || isExporting) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [currentVerseIndex, verses, aspectRatio, bgImage, isVideoBg, bgColor, textColor, fontSize, selectedFont, showTranslation, showWatermark, watermarkText, showOverlay, overlayOpacity, layoutStyle]);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (let k = 0; k < lines.length; k++) {
      ctx.fillText(lines[k], x, startY + k * lineHeight);
    }
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const reciterSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ambientSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const exportVideo = async () => {
    if (ffmpegError) {
      loadFFmpeg();
      return;
    }
    if (verses.length === 0 || !ffmpegLoaded) return;
    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(false);
    
    const ffmpeg = ffmpegRef.current;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    
    try {
      // 1. Prepare Audio Files and Calculate Durations
      const audioInfo: { name: string, duration: number, verseIndex: number }[] = [];
      let totalDuration = 0;

      for (let i = 0; i < verses.length; i++) {
        const verse = verses[i];
        const audioItem = audioFiles.find(af => af.verse_key === verse.verse_key);
        const audioUrl = audioItem ? `https://verses.quran.com/${audioItem.url}` : null;
        if (audioUrl) {
          const response = await fetch(audioUrl);
          const data = await response.arrayBuffer();
          const fileName = `audio_${i}.mp3`;
          await ffmpeg.writeFile(fileName, new Uint8Array(data));
          
          const duration = await new Promise<number>((resolve) => {
            const audio = new Audio(audioUrl);
            audio.onloadedmetadata = () => resolve(audio.duration);
          });
          audioInfo.push({ name: fileName, duration, verseIndex: i });
          totalDuration += duration;
        }
      }

      // 2. Render Frames
      const fps = 24; // Lower FPS for faster export in browser
      let frameCount = 0;
      let currentTime = 0;
      const totalFrames = Math.ceil(totalDuration * fps);

      for (const info of audioInfo) {
        const verseFrames = Math.ceil(info.duration * fps);
        setCurrentVerseIndex(info.verseIndex);
        
        for (let f = 0; f < verseFrames; f++) {
          // If video background, seek it
          if (isVideoBg && videoBgRef.current) {
            videoBgRef.current.currentTime = currentTime % (videoBgRef.current.duration || 1);
            // Wait a bit for video to seek (this is tricky in browser)
            await new Promise(resolve => setTimeout(resolve, 30));
          }

          // Manually trigger a render frame
          // We'll use a helper to draw everything
          drawFrame(ctx, canvas, info.verseIndex);

          const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.8));
          const frameData = await blob.arrayBuffer();
          await ffmpeg.writeFile(`frame_${String(frameCount).padStart(6, '0')}.jpg`, new Uint8Array(frameData));
          
          frameCount++;
          currentTime += 1/fps;
          setExportProgress(Math.round((frameCount / totalFrames) * 70)); // 70% for rendering
        }
      }

      // 3. Create Concatenation Script for Audio
      let filterComplex = "";
      let inputs: string[] = [];
      for (let i = 0; i < audioInfo.length; i++) {
        inputs.push("-i", `audio_${i}.mp3`);
        filterComplex += `[${i}:a]`;
      }
      filterComplex += `concat=n=${audioInfo.length}:v=0:a=1[reciter_audio]`;

      if (ambientSound.url) {
        const ambientResponse = await fetch(ambientSound.url);
        const ambientData = await ambientResponse.arrayBuffer();
        await ffmpeg.writeFile('ambient.mp3', new Uint8Array(ambientData));
        
        inputs.push("-stream_loop", "-1", "-i", "ambient.mp3");
        const ambientIdx = audioInfo.length;
        filterComplex += `;[${ambientIdx}:a]volume=${ambientVolume}[ambient_audio];[reciter_audio]volume=${reciterVolume}[reciter_vol];[reciter_vol][ambient_audio]amix=inputs=2:duration=first[aout]`;
      } else {
        filterComplex += `;[reciter_audio]volume=${reciterVolume}[aout]`;
      }

      await ffmpeg.exec([
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[aout]',
        'combined_audio.mp3'
      ]);

      // 4. Combine Frames and Audio
      setExportProgress(80);
      await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'frame_%06d.jpg',
        '-i', 'combined_audio.mp3',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        'output.mp4'
      ]);

      setExportProgress(95);
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quran_video_${selectedSurah?.name_simple}_${Date.now()}.mp4`;
      a.click();

      // Cleanup
      const files = await ffmpeg.listDir('.');
      for (const file of files) {
        if (file.name !== '.' && file.name !== '..') {
          await ffmpeg.deleteFile(file.name);
        }
      }

    } catch (error) {
      console.error("Export failed:", error);
      alert("فشل التصدير. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setCurrentVerseIndex(0);
    }
  };

  const drawFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, vIndex: number) => {
    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    if (isVideoBg && videoBgRef.current) {
      const video = videoBgRef.current;
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
      const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
      ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
    } else if (bgImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = bgImage;
      // During export, we should ideally wait for images, but for now we draw if complete
      if (img.complete) {
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      }
    } else if (layoutStyle === 'editorial') {
      const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#f5f2ed');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Overlay
    if (showOverlay && (isVideoBg || bgImage)) {
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw Arabic Text
    if (verses[vIndex]) {
      if (layoutStyle === 'editorial') {
        const margin = canvas.width * 0.08;
        const maxWidth = canvas.width - (margin * 2);
        
        if (selectedSurah) {
          const headerY = canvas.height * 0.15;
          const headerWidth = canvas.width * 0.8;
          const headerHeight = 80;
          const headerX = (canvas.width - headerWidth) / 2;
          
          const frameColor = '#c5a059';
          ctx.strokeStyle = frameColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(headerX, headerY, headerWidth, headerHeight);
          ctx.strokeRect(headerX + 5, headerY + 5, headerWidth - 10, headerHeight - 10);
          
          const accentSize = 12;
          ctx.fillStyle = frameColor;
          [[headerX, headerY], [headerX + headerWidth, headerY], [headerX, headerY + headerHeight], [headerX + headerWidth, headerY + headerHeight]].forEach(([cx, cy]) => {
            ctx.beginPath(); ctx.arc(cx, cy, accentSize, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
          });
          
          ctx.fillStyle = '#1a1a1a';
          ctx.font = `bold 36px ${selectedFont.family}`;
          ctx.textAlign = 'center';
          ctx.fillText(`سورة ${selectedSurah.name_arabic}`, canvas.width / 2, headerY + (headerHeight / 2) + 12);
          
          const arabicY = headerY + headerHeight + 150;
          ctx.fillStyle = '#1a1a1a';
          ctx.font = `bold ${fontSize}px ${selectedFont.family}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          wrapText(ctx, verses[vIndex].text_uthmani, canvas.width / 2, arabicY, maxWidth, fontSize * 1.8);
          
          if (showTranslation && verses[vIndex].translation) {
            const transText = verses[vIndex].translation!;
            ctx.font = `italic 30px sans-serif`;
            const words = transText.split(' ');
            let line = ''; let lineCount = 1;
            for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > maxWidth - 100 && n > 0) { lineCount++; line = words[n] + ' '; } else { line = testLine; }
            }
            const boxPadding = 60;
            const boxHeight = (lineCount * 45) + (boxPadding * 2);
            const transY = arabicY + 400;
            const boxY = transY - (boxHeight / 2);
            
            ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
            ctx.fillStyle = '#f8f9fa';
            ctx.beginPath();
            if (ctx.roundRect) { ctx.roundRect(margin, boxY, maxWidth, boxHeight, 40); } else { ctx.rect(margin, boxY, maxWidth, boxHeight); }
            ctx.fill();
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            
            ctx.fillStyle = '#a0a0a0'; ctx.font = `bold 18px sans-serif`; ctx.textAlign = 'left';
            ctx.fillText('SAHEEH INTERNATIONAL (ENGLISH)', margin + 20, boxY - 25);
            
            ctx.fillStyle = '#2d3436'; ctx.font = `italic 30px sans-serif`; ctx.textAlign = 'center';
            wrapText(ctx, transText, canvas.width / 2, transY, maxWidth - 120, 45);
          }
        }
      } else {
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px ${selectedFont.family}`;
        
        const text = verses[vIndex].text_uthmani;
        const maxWidth = canvas.width * 0.85;
        const centerY = canvas.height / 2 - (showTranslation ? 40 : 0);
        wrapText(ctx, text, canvas.width / 2, centerY, maxWidth, fontSize * 1.6);

        if (showTranslation && verses[vIndex].translation) {
          ctx.font = `italic ${fontSize * 0.45}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          const transText = verses[vIndex].translation!;
          wrapText(ctx, transText, canvas.width / 2, centerY + (fontSize * 1.8), maxWidth, fontSize * 0.6);
        }
      }
    }

    // Watermark
    if (showWatermark) {
      ctx.font = `bold 24px sans-serif`;
      ctx.fillStyle = layoutStyle === 'editorial' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(watermarkText, canvas.width - 40, canvas.height - 40);
    }

    // Surah Info
    if (selectedSurah && layoutStyle !== 'editorial') {
      ctx.font = `bold 28px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'left';
      ctx.fillText(`${selectedSurah.name_arabic} | الآية ${startVerse + vIndex}`, 40, canvas.height - 40);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col" dir="rtl">
      {/* Header */}
      <header className="border-b border-white/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/40 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <Video className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">صانع فيديوهات القرآن</h1>
            <p className="text-[10px] text-emerald-400 uppercase tracking-[0.2em] font-bold">استوديو احترافي</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
          <button 
            onClick={saveSettings}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
            title="حفظ الإعدادات"
          >
            <Save size={20} />
          </button>
          <button 
            onClick={exportVideo}
            disabled={isExporting || verses.length === 0 || !ffmpegLoaded}
            className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black px-8 py-3 rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-500/30"
          >
            {isExporting ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : ffmpegError ? (
              <AlertCircle className="text-red-400" size={20} />
            ) : !ffmpegLoaded ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Download size={20} />
            )}
            {isExporting 
              ? `جاري التصدير ${exportProgress}%` 
              : ffmpegError
                ? 'فشل التحميل (اضغط للمحاولة)'
                : !ffmpegLoaded 
                  ? 'جاري تحميل المحرك...' 
                  : 'تصدير الفيديو'}
          </button>
          {ffmpegError && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-[10px] text-red-400 text-center max-w-[200px] mx-auto">
                {ffmpegError}
              </p>
              {ffmpegError.includes("SharedArrayBuffer") && (
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Maximize2 size={12} />
                  فتح في نافذة جديدة
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Right Sidebar: Controls */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-l border-white/5 bg-[#111318] custom-scrollbar order-2 lg:order-1">
          <div className="p-6 space-y-10">
            {/* Content Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-400">
                <Layers size={20} />
                <h2 className="text-sm font-black uppercase tracking-widest">اختيار المحتوى</h2>
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">السورة</label>
                  <select 
                    onChange={handleSurahChange}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm appearance-none"
                  >
                    <option value="" className="bg-[#111318]">اختر السورة</option>
                    {surahs.map(s => (
                      <option key={s.id} value={s.id} className="bg-[#111318]">{s.id}. {s.name_arabic} ({s.name_simple})</option>
                    ))}
                  </select>
                </div>

                {selectedSurah && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">من آية</label>
                      <input 
                        type="number" 
                        min={1} 
                        max={selectedSurah.verses_count || 1}
                        value={isNaN(startVerse) ? '' : startVerse}
                        onChange={(e) => setStartVerse(parseInt(e.target.value) || 1)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">إلى آية</label>
                      <input 
                        type="number" 
                        min={isNaN(startVerse) ? 1 : startVerse} 
                        max={selectedSurah.verses_count || 1}
                        value={isNaN(endVerse) ? '' : endVerse}
                        onChange={(e) => setEndVerse(parseInt(e.target.value) || 1)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">القارئ</label>
                  <select 
                    value={selectedReciter.id}
                    onChange={(e) => setSelectedReciter(RECITERS.find(r => r.id === parseInt(e.target.value))!)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm appearance-none"
                  >
                    {RECITERS.map(r => (
                      <option key={r.id} value={r.id} className="bg-[#111318]">{r.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={loadData}
                  disabled={!selectedSurah || loading}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/5"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : 'تطبيق الاختيار'}
                </button>
              </div>
            </section>

            {/* Visuals Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-400">
                <Palette size={20} />
                <h2 className="text-sm font-black uppercase tracking-widest">الإعدادات البصرية</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">القوالب الجاهزة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold hover:border-emerald-500/50 transition-all"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">الأبعاد</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIOS.map(ratio => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio)}
                        className={`p-2 rounded-xl border text-[10px] font-bold transition-all ${aspectRatio.id === ratio.id ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                      >
                        {ratio.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">الخط العربي</label>
                  <div className="grid grid-cols-1 gap-2">
                    {ARABIC_FONTS.map(font => (
                      <button
                        key={font.id}
                        onClick={() => setSelectedFont(font)}
                        className={`p-3 rounded-xl border text-sm transition-all text-right ${selectedFont.id === font.id ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">خلفية فيديو؟</label>
                    <button 
                      onClick={() => setIsVideoBg(!isVideoBg)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${isVideoBg ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isVideoBg ? 'left-1' : 'left-6'}`} />
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={bgImage}
                    onChange={(e) => setBgImage(e.target.value)}
                    placeholder={isVideoBg ? "رابط فيديو مباشر..." : "رابط صورة..."}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60">إظهار الترجمة</span>
                    <button onClick={() => setShowTranslation(!showTranslation)} className="text-emerald-400">
                      {showTranslation ? <Eye size={18} /> : <EyeOff size={18} className="text-white/20" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60">إظهار العلامة المائية</span>
                    <button onClick={() => setShowWatermark(!showWatermark)} className="text-emerald-400">
                      {showWatermark ? <Eye size={18} /> : <EyeOff size={18} className="text-white/20" />}
                    </button>
                  </div>
                  {showWatermark && (
                    <input 
                      type="text" 
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </section>

            {/* Audio Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-400">
                <Wind size={20} />
                <h2 className="text-sm font-black uppercase tracking-widest">المؤثرات الصوتية</h2>
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="text-[10px] text-white/30 font-black uppercase tracking-wider">صوت الطبيعة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AMBIENT_SOUNDS.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setAmbientSound(s)}
                        className={`p-2 rounded-xl border text-[10px] font-bold transition-all ${ambientSound.id === s.id ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/30">
                    <span>حجم صوت الطبيعة</span>
                    <span>{Math.round((ambientVolume || 0) * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={isNaN(ambientVolume) ? 0.2 : ambientVolume} 
                    onChange={(e) => setAmbientVolume(parseFloat(e.target.value) || 0)}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            </section>
          </div>
        </aside>

        {/* Center: Preview */}
        <main className="flex-none lg:flex-1 bg-[#07080a] flex flex-col items-center justify-center p-4 lg:p-12 relative overflow-hidden order-1 lg:order-2 min-h-[50vh] lg:min-h-0">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 blur-[160px] rounded-full pointer-events-none" />
          
          <div 
            className="relative shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 rounded-3xl overflow-hidden bg-black flex items-center justify-center group"
            style={{ 
              width: '100%', 
              maxWidth: aspectRatio.ratio > 1 ? '900px' : '450px',
              aspectRatio: `${aspectRatio.width}/${aspectRatio.height}`
            }}
          >
            <canvas 
              ref={canvasRef}
              width={aspectRatio.width}
              height={aspectRatio.height}
              className="w-full h-full object-contain"
            />

            {/* Playback Overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-8">
              <button 
                onClick={() => setCurrentVerseIndex(prev => Math.max(0, prev - 1))}
                className="w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center transition-all active:scale-90"
              >
                <ChevronRight size={32} />
              </button>
              <button 
                onClick={togglePlay}
                className="w-24 h-24 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-all active:scale-95 shadow-2xl shadow-white/20"
              >
                {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="mr-2" />}
              </button>
              <button 
                onClick={() => setCurrentVerseIndex(prev => Math.min(verses.length - 1, prev + 1))}
                className="w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center transition-all active:scale-90"
              >
                <ChevronLeft size={32} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
              <motion.div 
                className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]"
                initial={{ width: 0 }}
                animate={{ width: `${verses.length > 0 ? ((currentVerseIndex + 1) / verses.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Hidden Elements */}
          {audioFiles[currentVerseIndex] && (
            <audio 
              ref={audioRef}
              src={`https://verses.quran.com/${audioFiles[currentVerseIndex].url}`}
              onEnded={handleAudioEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}
          {ambientSound.url && (
            <audio 
              ref={ambientAudioRef}
              src={ambientSound.url}
              loop
              onPlay={() => { if (ambientAudioRef.current) ambientAudioRef.current.volume = ambientVolume; }}
            />
          )}
          {isVideoBg && (
            <video 
              ref={videoBgRef}
              src={bgImage}
              autoPlay
              loop
              muted
              className="hidden"
            />
          )}
        </main>

        {/* Left Sidebar: Verses */}
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-r border-white/5 bg-[#111318] custom-scrollbar order-3">
          <div className="p-6 border-b border-white/5 sticky top-0 bg-[#111318]/80 backdrop-blur-xl z-10">
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <Music size={20} />
              <h2 className="text-sm font-black uppercase tracking-widest">قائمة الآيات</h2>
            </div>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">اضغط للانتقال السريع</p>
          </div>

          <div className="p-4 space-y-3">
            {verses.length === 0 ? (
              <div className="py-32 text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto rotate-12">
                  <Type className="text-white/10" size={40} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-black text-white/40">لا توجد آيات محملة</p>
                  <p className="text-[10px] text-white/20 px-12 leading-relaxed">قم باختيار السورة والآيات من القائمة الجانبية ثم اضغط تطبيق.</p>
                </div>
              </div>
            ) : (
              verses.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => setCurrentVerseIndex(idx)}
                  className={`w-full text-right p-5 rounded-2xl border transition-all group relative overflow-hidden ${currentVerseIndex === idx ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5' : 'bg-white/5 border-transparent hover:border-white/10'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${currentVerseIndex === idx ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/40'}`}>
                      {v.verse_key}
                    </span>
                    {currentVerseIndex === idx && isPlaying && (
                      <div className="flex gap-1 items-end h-4">
                        {[0, 150, 300].map(delay => (
                          <div key={delay} className="w-1 h-full bg-emerald-500 animate-bounce rounded-full" style={{ animationDelay: `${delay}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className={`text-xl font-arabic leading-relaxed mb-2 ${currentVerseIndex === idx ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                    {v.text_uthmani}
                  </p>
                  {showTranslation && v.translation && (
                    <p className="text-[10px] text-white/30 font-medium leading-relaxed" dir="ltr">
                      {v.translation}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Toasts */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-6 py-3 rounded-2xl font-black flex items-center gap-3 shadow-2xl z-[100]"
          >
            <Check size={20} />
            تم حفظ الإعدادات بنجاح
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}
