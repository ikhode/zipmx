let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// Gentle chime for passenger notifications (e.g., driver arriving)
export const playNotificationSound = () => {
  try {
    const ctx = initAudio();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
    
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
};

// Attention-grabbing beeps for drivers (e.g., new ride requested)
export const playAlertSound = () => {
  try {
    const ctx = initAudio();
    if (!ctx) return;
    
    const playBeep = (timeOffset: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime + timeOffset); // A5
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime + timeOffset);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.2);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + timeOffset + 0.2);
    };

    playBeep(0);
    playBeep(0.3);
    playBeep(0.6);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
};

// Positive chime for successes (e.g., ride accepted)
export const playSuccessSound = () => {
  try {
    const ctx = initAudio();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1); // C#5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2); // E5
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
};
