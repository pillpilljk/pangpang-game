import { StageId } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // 스테이지별 MP3 URL 설정
  private bgmUrls: Record<string, string> = {
    'LOBBY': 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    [StageId.CAN_CRUSH]: 'https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3',
    [StageId.EXTINGUISH_FIRE]: 'https://assets.mixkit.co/music/preview/mixkit-complex-236.mp3',
    [StageId.COLOR_REFLEX]: 'https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3',
    [StageId.MEMORY_SEQUENCE]: 'https://assets.mixkit.co/music/preview/mixkit-electro-summer-81.mp3',
    [StageId.MIND_CRASH]: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
  };

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Compressor for punchy, arcade-grade limiter and presence
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);

      // Pre-generate 1-second white noise buffer for impact & splash effects
      const bufferSize = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getDestination(): AudioNode {
    this.init();
    return this.compressor || (this.ctx as AudioContext).destination;
  }

  stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.bgmAudio = null;
    }
  }

  playBGM(type: 'LOBBY' | StageId) {
    this.stopBGM();
    const url = this.bgmUrls[type.toString()];
    if (!url) return;

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.28;
    audio.play().catch(e => console.warn("BGM Autoplay prevented", e));
    this.bgmAudio = audio;
  }

  /**
   * 1. 캔 찌그러트리기 / 강력 타격 효과음 (CAN CRUSH)
   * 묵직한 서브우퍼 베이스 킥 + 캔 찌그러지는 메탈릭 크런치 노이즈 레이어링
   */
  playCrush() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    // 레이어 1: 묵직한 서브 킥 (240Hz -> 38Hz 초고속 피치 드롭)
    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kickOsc.type = 'triangle';
    kickOsc.frequency.setValueAtTime(260, now);
    kickOsc.frequency.exponentialRampToValueAtTime(36, now + 0.18);

    kickGain.gain.setValueAtTime(0.7, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    kickOsc.connect(kickGain);
    kickGain.connect(dest);
    kickOsc.start(now);
    kickOsc.stop(now + 0.23);

    // 레이어 2: 찌그러지는 캔 크런치 메탈 사운드 (Square 버스트)
    const metalOsc = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metalOsc.type = 'sawtooth';
    metalOsc.frequency.setValueAtTime(480, now);
    metalOsc.frequency.linearRampToValueAtTime(110, now + 0.12);

    metalGain.gain.setValueAtTime(0.35, now);
    metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    metalOsc.connect(metalGain);
    metalGain.connect(dest);
    metalOsc.start(now);
    metalOsc.stop(now + 0.15);

    // 레이어 3: 바스락거리는 노이즈 임팩트 (캔 압축 파열음)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.linearRampToValueAtTime(400, now + 0.15);
      filter.Q.setValueAtTime(2.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.16);
    }
  }

  /**
   * 2. 화재 진압 / 연속 타격 효과음 (FIRE EXTINGUISH)
   * 고에너지 스팀 소화 노즐 분사 + 수압 버스트 (피치 변조 스팀 쉭쉭!)
   */
  playSplash() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    // 레이어 1: 시원한 고압 분사 노이즈
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(900, now + 0.16);
      filter.Q.setValueAtTime(3.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.19);
    }

    // 레이어 2: 짧고 청량한 버블 팝 톤
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(950, now);
    popOsc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

    popGain.gain.setValueAtTime(0.28, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    popOsc.connect(popGain);
    popGain.connect(dest);
    popOsc.start(now);
    popOsc.stop(now + 0.12);
  }

  /**
   * 3. 타겟 스폰 효과음 (TARGET SPAWN)
   * 미래지향적인 사이버 타겟 락온 비프 (상승하는 더블 짹!)
   */
  playSpawn() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // D6

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 4. 정답 / 성공 / 획득 효과음 (SUCCESS DING)
   * 영롱하고 맑은 아케이드 보상 하모닉 차임 (화음 + 반짝이는 릴리즈)
   */
  playDing() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    // C6 + E6 + G6 밝은 메이저 하모닉스
    const freqs = [1046.50, 1318.51, 1567.98];
    freqs.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.025);

      const vol = i === 2 ? 0.3 : 0.22;
      gain.gain.setValueAtTime(vol, now + i * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.025 + 0.28);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + i * 0.025);
      osc.stop(now + i * 0.025 + 0.3);
    });
  }

  /**
   * 5. 오답 / 경고 / 페널티 효과음 (WARNING BUZZ)
   * 묵직하고 거친 아케이드 듀얼 쏘우투스 감속 버저 (강렬한 감점 피드백)
   */
  playWarning() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    // 두 개의 살짝 디튠된 쏘우투스 파형으로 거친 질감 연출
    [150, 158].forEach(freq => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(75, now + 0.25);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  /**
   * 6. 스테이지 클리어 축하 팡파레 (STAGE CLEAR)
   * 속도감 있는 신스 브라스 아르페지오 + 웅장한 승리 코드
   */
  playClear() {
    this.stopBGM();
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    // 상승하는 4단계 아르페지오 (C5 -> E5 -> G5 -> C6 -> High Chord)
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const noteTime = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      const duration = idx === notes.length - 1 ? 0.7 : 0.18;
      gain.gain.setValueAtTime(0.28, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(noteTime);
      osc.stop(noteTime + duration + 0.05);
    });

    // 마지막 샴페인 폭죽 버스트 노이즈
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3000, now + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setValueAtTime(0.3, now + 0.42);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now + 0.4);
      noise.stop(now + 0.9);
    }
  }

  /**
   * 7. 타임오버 / 게임오버 효과음 (GAMEOVER)
   * 묵직하게 가라앉는 사이버네틱 파워다운 저음 스윕
   */
  playGameOver() {
    this.stopBGM();
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.8);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  /**
   * 8. 카운트다운 틱 효과음 (COUNTDOWN 3, 2, 1)
   */
  playCountdownTick() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * 9. 카운트다운 시작 효과음 (COUNTDOWN GO!)
   */
  playCountdownGo() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.getDestination();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, now); // C6
    osc2.frequency.setValueAtTime(1318.51, now); // E6

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  /**
   * 10. 일반 UI 클릭 / 탭 효과음 (CLICK)
   */
  playClick() {
    this.playCountdownTick();
  }
}

export const audioService = new AudioService();
