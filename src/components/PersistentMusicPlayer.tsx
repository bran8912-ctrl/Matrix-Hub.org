import { useState, useEffect, useRef, useCallback } from 'react';

interface Track {
  title: string;
  artist: string;
  url: string;
  genre: string;
}

const GENRES = ['All', 'Rap / Hip-Hop', 'Rock', 'Metal', 'Electronic / EDM', 'Ambient / Chill', 'Sci-Fi / Cyberpunk'] as const;
type Genre = typeof GENRES[number];

const matrixPlaylist: Track[] = [
  // --- Electronic / EDM ---
  { title: "Cyberpunk City", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/140/140.mp3", genre: "Electronic / EDM" },
  { title: "Deep Techno Ambience", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/134/134.mp3", genre: "Electronic / EDM" },
  { title: "Techno Fest Vibes", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/124/124.mp3", genre: "Electronic / EDM" },
  { title: "Minimal Techno 01", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/162/162.mp3", genre: "Electronic / EDM" },
  { title: "Machine Drum Vibes", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/117/117.mp3", genre: "Electronic / EDM" },
  { title: "Dub Techno Groove", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/133/133.mp3", genre: "Electronic / EDM" },
  { title: "Trance Party", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/166/166.mp3", genre: "Electronic / EDM" },
  { title: "Infected Vibes", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/157/157.mp3", genre: "Electronic / EDM" },
  { title: "Goa Trance Mantra", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/137/137.mp3", genre: "Electronic / EDM" },
  { title: "Tech House vibes", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/130/130.mp3", genre: "Electronic / EDM" },
  { title: "B.O.R.N", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/620/620.mp3", genre: "Electronic / EDM" },
  { title: "Deep Urban", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/623/623.mp3", genre: "Electronic / EDM" },
  { title: "Feedback Dreams", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/588/588.mp3", genre: "Electronic / EDM" },
  { title: "Fragments Of Bangkok", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/625/625.mp3", genre: "Electronic / EDM" },
  { title: "Digital Override", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/115/115.mp3", genre: "Electronic / EDM" },
  { title: "Voltage", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/116/116.mp3", genre: "Electronic / EDM" },
  { title: "Frequency War", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/118/118.mp3", genre: "Electronic / EDM" },
  { title: "Binary Drift", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/123/123.mp3", genre: "Electronic / EDM" },
  { title: "Deep Protocol", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/628/628.mp3", genre: "Electronic / EDM" },
  { title: "Voltage Core", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/630/630.mp3", genre: "Electronic / EDM" },
  // New Electronic / EDM tracks
  { title: "Tech House", artist: "Mixkit", url: "https://assets.mixkit.co/music/3/3.mp3", genre: "Electronic / EDM" },
  { title: "Dance Pop", artist: "Mixkit", url: "https://assets.mixkit.co/music/10/10.mp3", genre: "Electronic / EDM" },
  { title: "Synthwave", artist: "Mixkit", url: "https://assets.mixkit.co/music/25/25.mp3", genre: "Electronic / EDM" },
  { title: "Deep Bass", artist: "Mixkit", url: "https://assets.mixkit.co/music/571/571.mp3", genre: "Electronic / EDM" },
  { title: "Neon Lights", artist: "Mixkit", url: "https://assets.mixkit.co/music/572/572.mp3", genre: "Electronic / EDM" },
  { title: "Digital Dreams", artist: "Mixkit", url: "https://assets.mixkit.co/music/573/573.mp3", genre: "Electronic / EDM" },
  { title: "Cyber Pulse", artist: "Mixkit", url: "https://assets.mixkit.co/music/574/574.mp3", genre: "Electronic / EDM" },
  { title: "Future Bass", artist: "Mixkit", url: "https://assets.mixkit.co/music/575/575.mp3", genre: "Electronic / EDM" },
  // Local library (Wave 12)
  { title: "Carefree", artist: "Kevin MacLeod", url: "/music/carefree.mp3", genre: "Electronic / EDM" },
  { title: "Wallpaper", artist: "Kevin MacLeod", url: "/music/wallpaper.mp3", genre: "Electronic / EDM" },
  // --- Ambient / Chill ---
  { title: "Hazy After Hours", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/132/132.mp3", genre: "Ambient / Chill" },
  { title: "Minimal Emotion", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/160/160.mp3", genre: "Ambient / Chill" },
  { title: "Kodama Night Town", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/114/114.mp3", genre: "Ambient / Chill" },
  { title: "Digital Clouds", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/175/175.mp3", genre: "Ambient / Chill" },
  { title: "Slow Rain", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/122/122.mp3", genre: "Ambient / Chill" },
  { title: "Sun in Your Eyes", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/131/131.mp3", genre: "Ambient / Chill" },
  { title: "Better Times are Coming", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/173/173.mp3", genre: "Ambient / Chill" },
  { title: "Lonerism", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/159/159.mp3", genre: "Ambient / Chill" },
  { title: "Skyline", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/601/601.mp3", genre: "Ambient / Chill" },
  { title: "Silent Descent", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/614/614.mp3", genre: "Ambient / Chill" },
  { title: "Echoes", artist: "Andrew Ev", url: "https://assets.mixkit.co/music/188/188.mp3", genre: "Ambient / Chill" },
  { title: "Dream Sequence", artist: "Andrew Ev", url: "https://assets.mixkit.co/music/189/189.mp3", genre: "Ambient / Chill" },
  // Local library (Wave 12)
  { title: "Für Elise", artist: "Ludwig van Beethoven (perf. Gaodifan)", url: "/music/fur-elise-cc0.mp3", genre: "Ambient / Chill" },
  { title: "Bossa Antigua", artist: "Kevin MacLeod", url: "/music/bossa-antigua.mp3", genre: "Ambient / Chill" },
  { title: "Bright Wish", artist: "Kevin MacLeod", url: "/music/bright-wish.mp3", genre: "Ambient / Chill" },
  { title: "Gymnopedie No 1", artist: "Kevin MacLeod", url: "/music/gymnopedie-no-1.mp3", genre: "Ambient / Chill" },
  { title: "Inspired", artist: "Kevin MacLeod", url: "/music/inspired.mp3", genre: "Ambient / Chill" },
  { title: "Lobby Time", artist: "Kevin MacLeod", url: "/music/lobby-time.mp3", genre: "Ambient / Chill" },
  { title: "Local Forecast", artist: "Kevin MacLeod", url: "/music/local-forecast.mp3", genre: "Ambient / Chill" },
  { title: "Merry Go", artist: "Kevin MacLeod", url: "/music/merry-go.mp3", genre: "Ambient / Chill" },
  { title: "Quasi Motion", artist: "Kevin MacLeod", url: "/music/quasi-motion.mp3", genre: "Ambient / Chill" },
  { title: "Spacial Harvest", artist: "Kevin MacLeod", url: "/music/spacial-harvest.mp3", genre: "Ambient / Chill" },
  // New Ambient / Chill tracks
  { title: "Serene", artist: "Mixkit", url: "https://assets.mixkit.co/music/1/1.mp3", genre: "Ambient / Chill" },
  { title: "Calm Waters", artist: "Mixkit", url: "https://assets.mixkit.co/music/2/2.mp3", genre: "Ambient / Chill" },
  { title: "Peaceful", artist: "Mixkit", url: "https://assets.mixkit.co/music/20/20.mp3", genre: "Ambient / Chill" },
  { title: "Morning Dew", artist: "Mixkit", url: "https://assets.mixkit.co/music/576/576.mp3", genre: "Ambient / Chill" },
  { title: "Floating", artist: "Mixkit", url: "https://assets.mixkit.co/music/577/577.mp3", genre: "Ambient / Chill" },
  { title: "Gentle Breeze", artist: "Mixkit", url: "https://assets.mixkit.co/music/578/578.mp3", genre: "Ambient / Chill" },
  { title: "Horizon", artist: "Mixkit", url: "https://assets.mixkit.co/music/579/579.mp3", genre: "Ambient / Chill" },
  // --- Sci-Fi / Cyberpunk ---
  { title: "Sci-Fi Game", artist: "Arulo", url: "https://assets.mixkit.co/music/395/395.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Sci-Fi Score", artist: "Arulo", url: "https://assets.mixkit.co/music/464/464.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Neon Skyline", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/626/626.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Digital Mirage", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/627/627.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Night Drive", artist: "Arulo", url: "https://assets.mixkit.co/music/396/396.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Quantum Lock", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/135/135.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Data Flux", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/136/136.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Neon Protocol", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/161/161.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Cipher Loop", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/163/163.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Matrix Signal", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/168/168.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "System Pulse", artist: "Alejandro Magaña", url: "https://assets.mixkit.co/music/119/119.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Synthwave Override", artist: "Eugenio Mininni", url: "https://assets.mixkit.co/music/629/629.mp3", genre: "Sci-Fi / Cyberpunk" },
  // Local library (Wave 12)
  { title: "Cipher", artist: "Kevin MacLeod", url: "/music/cipher.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Floating Cities", artist: "Kevin MacLeod", url: "/music/floating-cities.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "Rynos Theme", artist: "Kevin MacLeod", url: "/music/rynos-theme.mp3", genre: "Sci-Fi / Cyberpunk" },
  { title: "The Descent", artist: "Kevin MacLeod", url: "/music/the-descent.mp3", genre: "Sci-Fi / Cyberpunk" },
  // --- Rap / Hip-Hop ---
  { title: "Hip Hop 02", artist: "Mixkit", url: "https://assets.mixkit.co/music/100/100.mp3", genre: "Rap / Hip-Hop" },
  { title: "Hip Hop Beat", artist: "Mixkit", url: "https://assets.mixkit.co/music/120/120.mp3", genre: "Rap / Hip-Hop" },
  { title: "Urban Beat", artist: "Mixkit", url: "https://assets.mixkit.co/music/146/146.mp3", genre: "Rap / Hip-Hop" },
  { title: "Street Vibe", artist: "Mixkit", url: "https://assets.mixkit.co/music/155/155.mp3", genre: "Rap / Hip-Hop" },
  { title: "Trap Beat", artist: "Mixkit", url: "https://assets.mixkit.co/music/665/665.mp3", genre: "Rap / Hip-Hop" },
  { title: "Dark Trap", artist: "Mixkit", url: "https://assets.mixkit.co/music/666/666.mp3", genre: "Rap / Hip-Hop" },
  { title: "Lo-Fi Hip Hop", artist: "Mixkit", url: "https://assets.mixkit.co/music/668/668.mp3", genre: "Rap / Hip-Hop" },
  // --- Rock ---
  { title: "Rock On", artist: "Mixkit", url: "https://assets.mixkit.co/music/4/4.mp3", genre: "Rock" },
  { title: "Driving Rock", artist: "Mixkit", url: "https://assets.mixkit.co/music/44/44.mp3", genre: "Rock" },
  { title: "Power Rock", artist: "Mixkit", url: "https://assets.mixkit.co/music/45/45.mp3", genre: "Rock" },
  { title: "Stadium Rock", artist: "Mixkit", url: "https://assets.mixkit.co/music/46/46.mp3", genre: "Rock" },
  { title: "Hard Rock", artist: "Mixkit", url: "https://assets.mixkit.co/music/562/562.mp3", genre: "Rock" },
  // --- Metal ---
  { title: "Heavy Metal Storm", artist: "Mixkit", url: "https://assets.mixkit.co/music/42/42.mp3", genre: "Metal" },
  { title: "Metal Forge", artist: "Mixkit", url: "https://assets.mixkit.co/music/43/43.mp3", genre: "Metal" },
  { title: "Thrash", artist: "Mixkit", url: "https://assets.mixkit.co/music/561/561.mp3", genre: "Metal" },
  { title: "Metal Core", artist: "Mixkit", url: "https://assets.mixkit.co/music/563/563.mp3", genre: "Metal" },
  { title: "Dark Metal", artist: "Mixkit", url: "https://assets.mixkit.co/music/564/564.mp3", genre: "Metal" },
  { title: "Steel Forge", artist: "Mixkit", url: "https://assets.mixkit.co/music/565/565.mp3", genre: "Metal" },
  { title: "Iron Thunder", artist: "Mixkit", url: "https://assets.mixkit.co/music/566/566.mp3", genre: "Metal" },
];

export default function PersistentMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const shouldAutoPlayRef = useRef(false);
  const errorCountRef = useRef(0);

  const [isEnabled, setIsEnabled] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [isLoopOn, setIsLoopOn] = useState(false);
  const [isAutoplayOn, setIsAutoplayOn] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true);
  const [playedTracks, setPlayedTracks] = useState<number[]>([]);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [activeGenre, setActiveGenre] = useState<Genre>('All');

  // Load all persisted state on mount
  useEffect(() => {
    const savedEnabled = localStorage.getItem('matrixPlayerEnabled');
    const savedIndex = localStorage.getItem('matrixPlayerIndex');
    const savedShuffle = localStorage.getItem('matrixPlayerShuffle');
    const savedLoop = localStorage.getItem('matrixPlayerLoop');
    const savedAutoplay = localStorage.getItem('matrixPlayerAutoplay');
    const savedMinimized = localStorage.getItem('matrixPlayerMinimized');
    const savedVolume = localStorage.getItem('matrixPlayerVolume');
    const savedMuted = localStorage.getItem('matrixPlayerMuted');

    if (savedEnabled) setIsEnabled(savedEnabled === 'true');
    if (savedIndex !== null) {
      const parsedIndex = parseInt(savedIndex, 10);
      // Clamp to the current playlist: the list changed size in the
      // Wave 13 sync, and an out-of-range saved index must not crash.
      if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < matrixPlaylist.length) {
        setCurrentTrackIndex(parsedIndex);
      }
    }
    if (savedShuffle) setIsShuffleOn(savedShuffle === 'true');
    if (savedLoop) setIsLoopOn(savedLoop === 'true');
    if (savedAutoplay) setIsAutoplayOn(savedAutoplay === 'true');
    if (savedMinimized) setIsMinimized(savedMinimized === 'true');
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedMuted) setIsMuted(savedMuted === 'true');
    const savedGenre = localStorage.getItem('matrixPlayerGenre');
    if (savedGenre && (GENRES as readonly string[]).includes(savedGenre)) {
      setActiveGenre(savedGenre as Genre);
    }
  }, []);

  // Sync audio element volume/mute whenever those states change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  // Persist each state value individually
  useEffect(() => {
    localStorage.setItem('matrixPlayerEnabled', isEnabled.toString());
  }, [isEnabled]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerIndex', currentTrackIndex.toString());
  }, [currentTrackIndex]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerShuffle', isShuffleOn.toString());
  }, [isShuffleOn]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerLoop', isLoopOn.toString());
  }, [isLoopOn]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerAutoplay', isAutoplayOn.toString());
  }, [isAutoplayOn]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerMinimized', isMinimized.toString());
  }, [isMinimized]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem('matrixPlayerVolume', volume.toString());
    }, 150);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerMuted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem('matrixPlayerGenre', activeGenre);
  }, [activeGenre]);

  // Restore saved playback position after track loads
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const savedTime = localStorage.getItem('matrixPlayerTime');

    const onLoaded = () => {
      if (savedTime) {
        audio.currentTime = parseFloat(savedTime);
      }
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    return () => audio.removeEventListener('loadedmetadata', onLoaded);
  }, [currentTrackIndex]);

  // Save playback position every 5 seconds of play time
  useEffect(() => {
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        localStorage.setItem('matrixPlayerTime', audio.currentTime.toString());
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Set --player-height on <html> so TabNav sticks right below the player
  useEffect(() => {
    const el = playerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          '--player-height',
          `${Math.round(entry.contentRect.height)}px`,
        );
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty('--player-height', '0px');
    };
  }, []);

  // Trigger playback after a track change (replaces the old setTimeout approach)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleCanPlay = () => {
      if (shouldAutoPlayRef.current) {
        shouldAutoPlayRef.current = false;
        audio.play().catch((err) => {
          console.error('Auto-play on track change failed:', err);
          setIsPlaying(false);
        });
      }
    };
    audio.addEventListener('canplay', handleCanPlay);
    return () => audio.removeEventListener('canplay', handleCanPlay);
  }, [currentTrackIndex]);

  // Web Audio API: set up AudioContext + AnalyserNode on first enable
  const setupAudioContext = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioContextRef.current) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;               // frequencyBinCount = fftSize/2 = 256 bins
      analyser.smoothingTimeConstant = 0.8; // gentle smoothing (default)

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;

      // Drive all audio-reactive CSS variables every animation frame
      const frequencyData = new Uint8Array(analyser.frequencyBinCount); // 256 elements
      let smoothedBass = 0; // slow EMA used for beat threshold
      let beatValue    = 0; // decays 0→1→0 on each detected beat

      const tick = () => {
        analyser.getByteFrequencyData(frequencyData);

        // Bass:   bins 0-5   (~0–430 Hz, approx. based on 44100 Hz sample rate / 512)
        let bassSum = 0;
        for (let i = 0; i < 6; i++) bassSum += frequencyData[i];
        const bass = bassSum / 6 / 255;

        // Mid:    bins 6-35  (~516–3010 Hz, approx.)
        let midSum = 0;
        for (let i = 6; i < 36; i++) midSum += frequencyData[i];
        const mid = midSum / 30 / 255;

        // Energy: average of first 100 bins (~0–8600 Hz, approx.)
        let energySum = 0;
        for (let i = 0; i < 100; i++) energySum += frequencyData[i];
        const energy = energySum / 100 / 255;

        // Beat detection: spike in bass above 1.5× recent average
        smoothedBass = smoothedBass * 0.9 + bass * 0.1;
        if (bass > smoothedBass * 1.5 && bass > 0.08) {
          beatValue = 1.0;
        } else {
          beatValue *= 0.88; // ~200 ms full decay at 60 fps
          if (beatValue < 0.001) beatValue = 0;
        }

        const root = document.documentElement.style;
        root.setProperty('--matrix-bass',   bass.toFixed(3));
        root.setProperty('--matrix-mid',    mid.toFixed(3));
        root.setProperty('--matrix-beat',   beatValue.toFixed(3));
        root.setProperty('--matrix-energy', energy.toFixed(3));

        animFrameRef.current = requestAnimationFrame(tick);
      };

      animFrameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('Web Audio API setup failed:', err);
    }
  }, []);

  // Clean up Web Audio on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      audioContextRef.current?.close().catch(() => {});
      // Reset audio-reactive CSS variables
      const root = document.documentElement.style;
      root.setProperty('--matrix-bass',   '0');
      root.setProperty('--matrix-mid',    '0');
      root.setProperty('--matrix-beat',   '0');
      root.setProperty('--matrix-energy', '0');
    };
  }, []);

  // Resume AudioContext on user interaction (browsers require it)
  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  const handleEnable = useCallback(() => {
    setIsEnabled(true);
    setupAudioContext();
    const audio = audioRef.current;
    if (audio) {
      resumeAudioContext();
      audio.play().catch((err) => {
        console.error('Audio playback failed:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [setupAudioContext, resumeAudioContext]);

  const handlePlay = useCallback(() => {
    setupAudioContext();
    resumeAudioContext();
    const audio = audioRef.current;
    if (audio) {
      audio.play().catch((err) => {
        console.error('Audio playback failed:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [setupAudioContext, resumeAudioContext]);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handlePrevious = useCallback(() => {
    const pool = activeGenre === 'All'
      ? matrixPlaylist.map((_, i) => i)
      : matrixPlaylist.map((_, i) => i).filter((i) => matrixPlaylist[i].genre === activeGenre);
    if (pool.length === 0) return;
    let newIndex: number;
    if (isShuffleOn) {
      const unplayed = pool.filter((i) => i !== currentTrackIndex && !playedTracks.includes(i));
      if (unplayed.length === 0) {
        const allOther = pool.filter((i) => i !== currentTrackIndex);
        newIndex = allOther.length > 0 ? allOther[Math.floor(Math.random() * allOther.length)] : pool[0];
        setPlayedTracks([currentTrackIndex, newIndex]);
      } else {
        newIndex = unplayed[Math.floor(Math.random() * unplayed.length)];
        setPlayedTracks((prev) => [...prev, currentTrackIndex]);
      }
    } else {
      const pos = pool.indexOf(currentTrackIndex);
      const prevPos = (pos <= 0 ? pool.length : pos) - 1;
      newIndex = pool[prevPos];
    }

    localStorage.removeItem('matrixPlayerTime');
    if (isPlaying || isAutoplayOn) shouldAutoPlayRef.current = true;
    setCurrentTrackIndex(newIndex);
  }, [currentTrackIndex, isShuffleOn, isPlaying, playedTracks, activeGenre, isAutoplayOn]);

  const handleNext = useCallback(() => {
    const pool = activeGenre === 'All'
      ? matrixPlaylist.map((_, i) => i)
      : matrixPlaylist.map((_, i) => i).filter((i) => matrixPlaylist[i].genre === activeGenre);
    if (pool.length === 0) return;
    let newIndex: number;
    if (isShuffleOn) {
      const unplayed = pool.filter((i) => i !== currentTrackIndex && !playedTracks.includes(i));
      if (unplayed.length === 0) {
        const allOther = pool.filter((i) => i !== currentTrackIndex);
        newIndex = allOther.length > 0 ? allOther[Math.floor(Math.random() * allOther.length)] : pool[0];
        setPlayedTracks([currentTrackIndex, newIndex]);
      } else {
        newIndex = unplayed[Math.floor(Math.random() * unplayed.length)];
        setPlayedTracks((prev) => [...prev, currentTrackIndex]);
      }
    } else {
      const pos = pool.indexOf(currentTrackIndex);
      const nextPos = pos < 0 ? 0 : (pos + 1) % pool.length;
      newIndex = pool[nextPos];
    }

    localStorage.removeItem('matrixPlayerTime');
    if (isPlaying || isAutoplayOn) shouldAutoPlayRef.current = true;
    setCurrentTrackIndex(newIndex);
  }, [currentTrackIndex, isShuffleOn, isPlaying, playedTracks, activeGenre, isAutoplayOn]);

  const handleEnded = useCallback(() => {
    if (isAutoplayOn && !isLoopOn) {
      // Autoplay is on and not looping: advance to the next track, keep isPlaying true
      shouldAutoPlayRef.current = true;
      handleNext();
    } else if (!isLoopOn) {
      // Autoplay is off and not looping: playback has stopped, reflect that in state
      setIsPlaying(false);
    }
  }, [isAutoplayOn, isLoopOn, handleNext]);

  // Media Session API for background / lock-screen controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const track = matrixPlaylist[currentTrackIndex];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'Matrix Hub Playlist',
      artwork: [{ src: '/favicon.ico', sizes: '96x96', type: 'image/x-icon' }],
    });

    // Route through handleEnable/handlePlay so AudioContext is initialised/resumed
    // and isEnabled is set correctly, keeping behaviour consistent with in-UI controls.
    navigator.mediaSession.setActionHandler('play', () => {
      if (!isEnabled) {
        handleEnable();
      } else {
        handlePlay();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('previoustrack', handlePrevious);
    navigator.mediaSession.setActionHandler('nexttrack', handleNext);
  }, [currentTrackIndex, isEnabled, handleEnable, handlePlay, handlePrevious, handleNext]);

  const currentTrack = matrixPlaylist[currentTrackIndex];

  return (
    <div ref={playerRef} data-genre={activeGenre} className={`persistent-music-player${isMinimized ? ' minimized' : ''}`}>
      <audio
        ref={audioRef}
        src={currentTrack.url}
        preload="metadata"
        crossOrigin="anonymous"
        loop={isLoopOn}
        onEnded={handleEnded}
        onPlay={() => { setIsPlaying(true); errorCountRef.current = 0; }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          console.warn(`[MatrixPlayer] Track failed to load: ${currentTrack.url}`);
          errorCountRef.current += 1;
          if (errorCountRef.current < matrixPlaylist.length) {
            handleNext();
          } else {
            console.error('[MatrixPlayer] All tracks failed to load.');
            setIsPlaying(false);
            errorCountRef.current = 0;
          }
        }}
      />

      {/* Header — always visible */}
      <div className="player-header">
        <button
          className="minimize-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Expand Player' : 'Minimize Player'}
          aria-label={isMinimized ? 'Expand Player' : 'Minimize Player'}
        >
          {isMinimized ? '▼' : '▲'}
        </button>
        <span className="player-title">MATRIX MP3 PLAYER</span>

        {/* Enable Music button — always visible for autoplay policy compliance */}
        {!isEnabled ? (
          <button
            className="enable-btn"
            onClick={handleEnable}
            aria-label="Enable music playback"
          >
            ▶ ENABLE MUSIC
          </button>
        ) : (
          <span className="now-playing-mini">
            {isPlaying ? '♫ ' : '⏸ '}
            {currentTrack.title}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {!isMinimized && (
        <div className="player-content">
          {/* Genre filter buttons */}
          <div className="genre-tabs" role="group" aria-label="Filter by genre">
            {GENRES.map((genre) => {
              const count = genre === 'All' ? matrixPlaylist.length : matrixPlaylist.filter((t) => t.genre === genre).length;
              return (
                <button
                  key={genre}
                  className={`genre-tab${activeGenre === genre ? ' active' : ''}`}
                  onClick={() => setActiveGenre(genre)}
                  aria-pressed={activeGenre === genre}
                  title={genre}
                >
                  {genre} <span className="genre-count">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="now-playing">
            <div className="now-playing-label">Now Playing</div>
            <div className="track-title">{currentTrack.title}</div>
            <div className="track-artist">{currentTrack.artist}</div>
            <div className="track-genre-badge">{currentTrack.genre}</div>
            <div className="track-number">
              {(() => {
                const pool = activeGenre === 'All'
                  ? matrixPlaylist.map((_, i) => i)
                  : matrixPlaylist.map((_, i) => i).filter((i) => matrixPlaylist[i].genre === activeGenre);
                const pos = pool.indexOf(currentTrackIndex);
                return pos >= 0
                  ? `Track ${pos + 1} of ${pool.length}${activeGenre !== 'All' ? ` in ${activeGenre}` : ''}`
                  : `Track ${currentTrackIndex + 1} of ${matrixPlaylist.length}`;
              })()}
            </div>
          </div>

          <div className="player-controls">
            <button onClick={handlePrevious} title="Previous" aria-label="Previous track">
              ⏮
            </button>
            {isPlaying ? (
              <button onClick={handlePause} title="Pause" aria-label="Pause">
                ⏸
              </button>
            ) : (
              <button onClick={handlePlay} title="Play" aria-label="Play">
                ▶
              </button>
            )}
            <button onClick={handleNext} title="Next" aria-label="Next track">
              ⏭
            </button>
          </div>

          <div className="secondary-controls">
            <button
              className={isShuffleOn ? 'active' : ''}
              onClick={() => setIsShuffleOn(!isShuffleOn)}
              title="Shuffle"
              aria-label="Toggle shuffle"
              aria-pressed={isShuffleOn}
            >
              🔀
            </button>
            <button
              className={isLoopOn ? 'active' : ''}
              onClick={() => setIsLoopOn(!isLoopOn)}
              title="Loop"
              aria-label="Toggle loop"
              aria-pressed={isLoopOn}
            >
              🔁
            </button>
            <button
              className={isAutoplayOn ? 'active' : ''}
              onClick={() => setIsAutoplayOn(!isAutoplayOn)}
              title="Autoplay"
              aria-label="Toggle autoplay"
              aria-pressed={isAutoplayOn}
            >
              🔊
            </button>
          </div>

          {/* Volume and mute controls */}
          <div className="volume-controls">
            <button
              className={isMuted ? 'active' : ''}
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              aria-pressed={isMuted}
            >
              {isMuted ? '🔇' : '🔉'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setVolume(newVolume);
                if (isMuted && newVolume > 0) setIsMuted(false);
              }}
              aria-label="Volume"
              className="volume-slider"
            />
            <span className="volume-display">{isMuted ? '0' : Math.round(volume * 100)}%</span>
          </div>

          <div className="player-status">
            Loop: {isLoopOn ? 'ON' : 'OFF'} | Shuffle: {isShuffleOn ? 'ON' : 'OFF'} | Autoplay:{' '}
            {isAutoplayOn ? 'ON' : 'OFF'}
          </div>

          <div className="music-notice">
            <strong>Music License:</strong> All tracks are royalty-free or licensed under Creative
            Commons.
            <br />
            <span style={{ fontSize: '0.85em' }}>
              Kevin MacLeod (incompetech.com): CC BY 4.0 |{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://creativecommons.org/licenses/by/4.0/
              </a>
            </span>
          </div>
        </div>
      )}

      <style>{`
        .persistent-music-player {
          position: sticky;
          top: 0;
          z-index: var(--z-index-music-player, 1001);
          background: var(--theme-bg-panel, rgba(0, 20, 0, 0.95));
          border-bottom: 2px solid var(--theme-primary, #00ff00);
          box-shadow: 0 4px 20px var(--theme-glow, rgba(0, 255, 0, 0.3));
          font-family: 'Courier New', monospace;
          backdrop-filter: blur(10px);
        }

        .player-header {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .minimize-btn {
          background: transparent;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 4px 10px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 4px;
          transition: 0.2s;
          font-size: 12px;
          flex-shrink: 0;
        }

        .minimize-btn:hover {
          background: var(--theme-primary, #00ff00);
          color: black;
        }

        .player-title {
          font-size: 14px;
          color: var(--theme-primary, #00ff00);
          text-shadow: 0 0 8px var(--theme-glow, rgba(0, 255, 0, 0.5));
          flex-shrink: 0;
        }

        .enable-btn {
          background: var(--theme-primary, #00ff00);
          color: black;
          border: none;
          padding: 5px 14px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 4px;
          transition: 0.2s;
          font-size: 12px;
          font-weight: bold;
          flex-shrink: 0;
          animation: pulse-glow 1.8s ease-in-out infinite;
        }

        .enable-btn:hover {
          opacity: 0.85;
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 6px var(--theme-glow, rgba(0, 255, 0, 0.6)); }
          50% { box-shadow: 0 0 18px var(--theme-glow, rgba(0, 255, 0, 0.9)); }
        }

        .now-playing-mini {
          font-size: 12px;
          color: var(--theme-secondary, #00ffff);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .player-content {
          padding: 16px;
          border-top: 1px solid var(--theme-border, rgba(0, 255, 0, 0.3));
        }

        .now-playing {
          background: rgba(0, 255, 65, 0.08);
          border: 1px solid var(--theme-border, #00ff00);
          border-radius: 5px;
          padding: 12px;
          margin-bottom: 15px;
          text-align: center;
        }

        .now-playing-label {
          font-size: 10px;
          color: var(--theme-primary, #00ff00);
          margin-bottom: 5px;
          text-transform: uppercase;
          opacity: 0.7;
        }

        .track-title {
          font-size: 14px;
          color: var(--theme-primary, #00ff00);
          font-weight: bold;
          margin-bottom: 3px;
          text-shadow: 0 0 5px var(--theme-glow, rgba(0, 255, 0, 0.5));
        }

        .track-artist {
          font-size: 12px;
          color: var(--theme-secondary, #00ffff);
        }

        .track-number {
          font-size: 11px;
          color: var(--theme-text, #00ffff);
          margin-top: 5px;
          opacity: 0.7;
        }

        .player-controls {
          text-align: center;
          margin-bottom: 10px;
        }

        .player-controls button {
          background: black;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 10px 14px;
          margin: 4px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 5px;
          transition: 0.2s;
          font-size: 14px;
        }

        .player-controls button:hover {
          background: var(--theme-primary, #00ff00);
          color: black;
        }

        .secondary-controls {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .secondary-controls button {
          background: black;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 6px 10px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 5px;
          transition: 0.2s;
          font-size: 12px;
        }

        .secondary-controls button:hover,
        .secondary-controls button.active {
          background: var(--theme-primary, #00ff00);
          color: black;
        }

        .volume-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          padding: 0 4px;
        }

        .volume-controls button {
          background: black;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 5px 8px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 5px;
          transition: 0.2s;
          font-size: 14px;
          flex-shrink: 0;
        }

        .volume-controls button:hover,
        .volume-controls button.active {
          background: var(--theme-primary, #00ff00);
          color: black;
        }

        .volume-slider {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: var(--theme-border, #00ff00);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          opacity: 0.8;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          background: var(--theme-primary, #00ff00);
          border-radius: 50%;
          cursor: pointer;
        }

        .volume-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: var(--theme-primary, #00ff00);
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }

        .volume-display {
          font-size: 11px;
          color: var(--theme-text, #00ffff);
          min-width: 32px;
          text-align: right;
        }

        .player-status {
          text-align: center;
          font-size: 11px;
          color: var(--theme-text, #00ffff);
          opacity: 0.7;
          margin-bottom: 12px;
        }

        .music-notice {
          margin-top: 12px;
          font-size: 0.85em;
          color: var(--theme-secondary, #00ffff);
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          padding: 8px;
          text-align: center;
        }

        .music-notice a {
          color: var(--theme-primary, #00ff00);
          text-decoration: underline;
        }

        .genre-tabs {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          gap: 6px;
          padding: 0 0 10px 0;
          margin-bottom: 12px;
          scrollbar-width: thin;
          scrollbar-color: var(--theme-border, #00ff00) transparent;
        }

        .genre-tabs::-webkit-scrollbar {
          height: 3px;
        }

        .genre-tabs::-webkit-scrollbar-thumb {
          background: var(--theme-border, #00ff00);
          border-radius: 2px;
        }

        .genre-tab {
          background: black;
          color: var(--theme-primary, #00ff00);
          border: 1px solid var(--theme-border, #00ff00);
          padding: 5px 10px;
          cursor: pointer;
          font-family: inherit;
          border-radius: 20px;
          font-size: 11px;
          white-space: nowrap;
          transition: 0.2s;
          flex-shrink: 0;
        }

        .genre-tab:hover {
          background: rgba(0, 255, 0, 0.15);
        }

        .genre-tab.active {
          background: var(--theme-primary, #00ff00);
          color: black;
          font-weight: bold;
        }

        .genre-count {
          opacity: 0.7;
          font-size: 10px;
        }

        .genre-tab.active .genre-count {
          opacity: 0.85;
        }

        .track-genre-badge {
          display: inline-block;
          font-size: 10px;
          color: black;
          background: var(--theme-primary, #00ff00);
          border-radius: 10px;
          padding: 1px 8px;
          margin: 4px 0 2px;
          opacity: 0.85;
        }

        @media (max-width: 768px) {
          .player-header {
            padding: 6px 12px;
            gap: 8px;
          }

          .player-title {
            font-size: 12px;
          }

          .player-content {
            padding: 12px;
          }

          .player-controls button {
            padding: 8px 12px;
            font-size: 12px;
          }

          .enable-btn {
            font-size: 11px;
            padding: 4px 10px;
          }
        }
      `}</style>
    </div>
  );
}