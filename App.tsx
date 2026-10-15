import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  GameState, 
  StageId, 
  GameSettings, 
  StepRecord, 
  BoardInput,
  AgeGroup,
  BenchmarkDifficulty
} from './types';
import { 
  DEFAULT_SETTINGS, 
  STAGE_TITLES, 
  STAGE_KEY_PHRASES,
  STAGE_DESCRIPTIONS,
  COLORS,
  AGE_BENCHMARKS,
  DIFFICULTY_CONFIG,
  get_scaled_benchmark,
  get_stage4_target_level
} from './constants';
import { serialService } from './services/serialService';
import { audioService } from './services/audioService';
import { storageService } from './services/storageService';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Board } from './components/Board';
import { Report } from './components/Report';
import { AdminRecordsModal } from './components/AdminRecordsModal';
import { 
  Settings, 
  Target, 
  Zap, 
  AlertTriangle, 
  ChevronRight, 
  CheckCircle2, 
  User, 
  Baby, 
  PersonStanding, 
  UserRound,
  ArrowRightCircle,
  Gauge,
  Footprints,
  Home,
  FileSpreadsheet
} from 'lucide-react';

const App: React.FC = () => {
  // Global State
  const [gameState, setGameState] = useState<GameState>(GameState.AGE_SELECTION);
  const [isAdminRecordsOpen, setIsAdminRecordsOpen] = useState(false);
  const [selectedAge, setSelectedAge] = useState<AgeGroup>(AgeGroup.YOUTH);
  const [difficulty, setDifficulty] = useState<BenchmarkDifficulty>(BenchmarkDifficulty.NORMAL);
  const [currentStage, setCurrentStage] = useState<StageId>(StageId.CAN_CRUSH);
  const [connected, setConnected] = useState(false);
  const [inputs, setInputs] = useState<BoardInput>({
    1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false, 8: false, 9: false,
    SELECT: false, START: false
  });
  const [records, setRecords] = useState<StepRecord[]>([]);
  const [settings, setSettings] = useState<Record<StageId, GameSettings>>(DEFAULT_SETTINGS);
  
  // Game Logic State
  const [targets, setTargets] = useState<number[]>([]);
  const [targetHealth, setTargetHealth] = useState<Record<number, number>>({});
  const [splashes, setSplashes] = useState<Record<number, boolean>>({});
  const [targetContent, setTargetContent] = useState<Record<number, React.ReactNode>>({});
  const [score, setScore] = useState(0);
  const [stageCompletedCount, setStageCompletedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [shake, setShake] = useState(false);
  
  // Instruction & Countdown state
  const [countdown, setCountdown] = useState<string | number>(3);
  const [previewTimer, setPreviewTimer] = useState(0);

  // Stage specific state
  const [activeGoalColor, setActiveGoalColor] = useState<typeof COLORS[0] | null>(null);
  const [activeGoalDisplayHex, setActiveGoalDisplayHex] = useState<string | null>(null);
  const [padColors, setPadColors] = useState<Record<number, typeof COLORS[0]>>({});
  const [sequence, setSequence] = useState<number[]>([]);
  const [sequencePlayerIdx, setSequencePlayerIdx] = useState(0);
  const [displayingSequence, setDisplayingSequence] = useState<number | null>(null);
  const [isWatchingSequence, setIsWatchingSequence] = useState(false);
  const [stage5CorrectPads, setStage5CorrectPads] = useState<number[]>([]);
  
  const lastProcessedInputs = useRef<BoardInput>({ ...inputs });
  const startTimeRef = useRef<number>(0);
  const lastTargetRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  const ACTIVE_PADS = [1, 2, 3, 4, 6, 7, 8, 9];

  const gameRefs = useRef({
    gameState,
    currentStage,
    targets,
    targetHealth,
    score,
    stageCompletedCount,
    sequence,
    sequencePlayerIdx,
    isWatchingSequence,
    activeGoalColor,
    padColors,
    targetContent,
    settings,
    inputs,
    stage5CorrectPads,
    records,
    selectedAge,
    difficulty
  });

  useEffect(() => {
    gameRefs.current = {
      gameState,
      currentStage,
      targets,
      targetHealth,
      score,
      stageCompletedCount,
      sequence,
      sequencePlayerIdx,
      isWatchingSequence,
      activeGoalColor,
      padColors,
      targetContent,
      settings,
      inputs,
      stage5CorrectPads,
      records,
      selectedAge,
      difficulty
    };
  }, [gameState, currentStage, targets, targetHealth, score, stageCompletedCount, sequence, sequencePlayerIdx, isWatchingSequence, activeGoalColor, padColors, targetContent, settings, inputs, stage5CorrectPads, records, selectedAge, difficulty]);

  useEffect(() => {
    if (gameState === GameState.LOBBY || gameState === GameState.AGE_SELECTION) {
      audioService.playBGM('LOBBY');
    } else if (gameState === GameState.PLAYING || gameState === GameState.PREVIEW) {
      audioService.playBGM(currentStage);
    } else if (gameState === GameState.REPORT) {
      audioService.playBGM('LOBBY');
    } else {
      audioService.stopBGM();
    }
    return () => audioService.stopBGM();
  }, [gameState, currentStage]);

  const triggerVisualFeedback = (idx?: number) => {
    setShake(true);
    setTimeout(() => setShake(false), 200);
    if (idx !== undefined) {
      setSplashes(prev => ({ ...prev, [idx]: true }));
      setTimeout(() => setSplashes(prev => ({ ...prev, [idx]: false })), 300);
    }
  };

  const startActualPlay = useCallback(() => {
    setGameState(GameState.PLAYING);
    let timeLimit = settings[currentStage].timeLimit;
    // 유아/초등 연령대는 3단계(색상)와 5단계(인지 갈등)에서 부모가 옆에서 읽어줄 수 있도록 타임아웃 제한 시간을 7초 이상으로 넉넉하게 확장
    if (
      (currentStage === StageId.COLOR_REFLEX || currentStage === StageId.MIND_CRASH) &&
      (selectedAge === AgeGroup.TODDLER || selectedAge === AgeGroup.CHILD)
    ) {
      timeLimit = Math.max(timeLimit, settings[currentStage].targetCount * 8); // 80초 이상 (문제당 8초 확보)
    }
    setTimeLeft(timeLimit);
    lastProcessedInputs.current = { ...gameRefs.current.inputs };
    if (currentStage !== StageId.MEMORY_SEQUENCE) startTimeRef.current = Date.now();
  }, [currentStage, settings, selectedAge]);

  const playSequenceVisuals = useCallback(async (seq: number[]) => {
    setIsWatchingSequence(true);
    setTargets([]);
    setTargetContent({}); 
    await new Promise(r => setTimeout(r, 800));
    for (let i = 0; i < seq.length; i++) {
      const targetIdx = seq[i];
      const visualContent = (
        <div className="flex flex-col items-center justify-center animate-in zoom-in duration-200">
           <span className="text-8xl font-black orbitron text-white neon-text-blue">{i + 1}</span>
        </div>
      );
      setTargetContent({ [targetIdx]: visualContent });
      setDisplayingSequence(targetIdx);
      audioService.playDing();
      await new Promise(r => setTimeout(r, 600));
      setDisplayingSequence(null);
      setTargetContent({});
      await new Promise(r => setTimeout(r, 200));
    }
    setIsWatchingSequence(false);
    startTimeRef.current = Date.now();
  }, []);

  const getFireContent = (h: number) => (
    <div className="relative flex items-center justify-center pointer-events-none">
      <span className="animate-bounce text-6xl drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">🔥</span>
      <div className="absolute -top-6 -right-6 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full orbitron border-2 border-white/80 shadow-2xl z-50">{h}</div>
    </div>
  );

  const spawnTarget = useCallback(() => {
    const { currentStage: stage, score: s, settings: set, sequence: seq, selectedAge: currentAge } = gameRefs.current;
    const maxTargetCount = stage === StageId.MEMORY_SEQUENCE
      ? get_stage4_target_level(currentAge)
      : set[stage].targetCount;
    if (s >= maxTargetCount) return;
    audioService.playSpawn();

    if (stage === StageId.CAN_CRUSH) {
      const next = ACTIVE_PADS.filter(p => p !== lastTargetRef.current)[Math.floor(Math.random() * (ACTIVE_PADS.length - 1))];
      lastTargetRef.current = next;
      setTargets([next]);
      setTargetHealth({ [next]: 1 });
      setTargetContent({ [next]: <span className="text-6xl">🥫</span> });
    } else if (stage === StageId.EXTINGUISH_FIRE) {
      const next = ACTIVE_PADS.filter(p => p !== lastTargetRef.current)[Math.floor(Math.random() * (ACTIVE_PADS.length - 1))];
      lastTargetRef.current = next;
      const hp = Math.floor(Math.random() * 4) + 2;
      setTargets([next]);
      setTargetHealth({ [next]: hp });
      setTargetContent({ [next]: getFireContent(hp) });
    } else if (stage === StageId.COLOR_REFLEX) {
      const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5);
      const goal = shuffledColors[Math.floor(Math.random() * shuffledColors.length)];
      const isHardMode = s >= set[stage].targetCount * 0.5;
      const newContents: Record<number, React.ReactNode> = {};
      const newPadColors: Record<number, typeof COLORS[0]> = {};
      ACTIVE_PADS.forEach((p, idx) => {
        const c = shuffledColors[idx % shuffledColors.length];
        newPadColors[p] = c;
        if (isHardMode) {
          newContents[p] = <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ backgroundColor: c.hex }} />;
        } else {
          newContents[p] = (
            <div className={`flex flex-col items-center pointer-events-none scale-90`}>
              <span style={{ color: c.hex }} className="text-5xl">{c.symbol}</span>
              <span className="text-[10px] uppercase font-bold orbitron mt-1" style={{ color: c.hex }}>{c.name}</span>
            </div>
          );
        }
      });
      setActiveGoalColor(goal);
      setActiveGoalDisplayHex(goal.hex); // 3단계는 색상 일치
      setPadColors(newPadColors);
      setTargetContent(newContents);
      setTargets(ACTIVE_PADS); 
      setTargetHealth(Object.fromEntries(ACTIVE_PADS.map(p => [p, 1])));
    } else if (stage === StageId.MEMORY_SEQUENCE) {
      const lastInSeq = seq.length > 0 ? seq[seq.length - 1] : -1;
      const next = ACTIVE_PADS.filter(p => p !== lastInSeq)[Math.floor(Math.random() * (ACTIVE_PADS.length - 1))];
      const newSeq = [...seq, next];
      setSequence(newSeq);
      setSequencePlayerIdx(0);
      playSequenceVisuals(newSeq);
      return; 
    } else if (stage === StageId.MIND_CRASH) {
      const shuffledVisualColors = [...COLORS].sort(() => Math.random() - 0.5);
      const goalIndex = Math.floor(Math.random() * ACTIVE_PADS.length);
      const goal = shuffledVisualColors[goalIndex];
      const newContents: Record<number, React.ReactNode> = {};
      const newPadColors: Record<number, typeof COLORS[0]> = {};
      const correctIndices: number[] = [];
      ACTIVE_PADS.forEach((p, i) => {
        const visualColor = shuffledVisualColors[i];
        newPadColors[p] = visualColor;
        let otherColors = COLORS.filter(c => c.name !== visualColor.name);
        const wordColor = otherColors[Math.floor(Math.random() * otherColors.length)];
        if (visualColor.name === goal.name) correctIndices.push(p);
        newContents[p] = (
          <div className="flex flex-col items-center justify-center pointer-events-none w-full h-full p-2">
            <div className="w-full h-full bg-white rounded-xl border-2 border-slate-300 shadow-md flex items-center justify-center px-2 py-1">
              <span 
                style={{ 
                  color: visualColor.hex,
                  textShadow: visualColor.hex === '#111111' 
                    ? '0 0 1px #fff' 
                    : visualColor.hex === '#ffffff' 
                      ? '0 0 2px #000, 0 0 4px #000' 
                      : 'none'
                }} 
                className="text-4xl md:text-5xl font-black italic orbitron"
              >
                {wordColor.name}
              </span>
            </div>
          </div>
        );
      });
      
      // 5단계 스트룹 효과: 목표 단어의 색상을 정답과 다르게 설정
      const diffColors = COLORS.filter(c => c.name !== goal.name);
      const displayColor = diffColors[Math.floor(Math.random() * diffColors.length)];
      setActiveGoalDisplayHex(displayColor.hex);
      setActiveGoalColor(goal);
      
      setPadColors(newPadColors);
      setTargetContent(newContents);
      setStage5CorrectPads(correctIndices);
      setTargets(ACTIVE_PADS);
    }
    startTimeRef.current = Date.now();
  }, [playSequenceVisuals]);

  const startGame = useCallback((stage: StageId) => {
    setCurrentStage(stage);
    setScore(0);
    setStageCompletedCount(0);
    setTargets([]);
    setTargetHealth({});
    setTargetContent({});
    setPadColors({});
    setActiveGoalColor(null);
    setActiveGoalDisplayHex(null);
    setSequence([]);
    setSequencePlayerIdx(0);
    setDisplayingSequence(null);
    setIsWatchingSequence(false);
    setStage5CorrectPads([]);
    setCountdown(3);
    setGameState(GameState.COUNTDOWN); // "START 이후에 바로 3 2 1 시작으로 넘어가고"
  }, []);

  const resetGameToLobby = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    audioService.stopBGM();
    setRecords([]);
    setTargets([]);
    setTargetHealth({});
    setTargetContent({});
    setPadColors({});
    setActiveGoalColor(null);
    setActiveGoalDisplayHex(null);
    setSequence([]);
    setSequencePlayerIdx(0);
    setDisplayingSequence(null);
    setIsWatchingSequence(false);
    setStage5CorrectPads([]);
    setScore(0);
    setStageCompletedCount(0);
    setGameState(GameState.AGE_SELECTION);
  }, []);

  const handleBoardInput = useCallback((idx: number, isPressed: boolean) => {
    if (!isPressed) {
      lastProcessedInputs.current[idx as keyof BoardInput] = false;
      return;
    }
    
    const wasPressed = lastProcessedInputs.current[idx as keyof BoardInput];
    lastProcessedInputs.current[idx as keyof BoardInput] = true;

    if (wasPressed) return; 

    // 가운데 중앙 발판 (5번): 유저가 기본으로 서 있는 대기 공간이므로 모든 진행/스킵/선택/게임플레이에서 완전 무시
    if (idx === 5) return;

    const { 
      gameState: state, targets: activeTargets, 
      targetHealth: health, sequence: seq, sequencePlayerIdx: seqIdx,
      isWatchingSequence: watching, activeGoalColor: goal, padColors: pads,
      settings: stageSet, stage5CorrectPads: s5Correct, currentStage: currentStageId,
      stageCompletedCount: completedCount
    } = gameRefs.current;

    const isConfirmKey = idx === 11; // START 버튼만 확인/진행 키로 사용 (가운데 발판 5 제외)

    // 연령 선택 로직
    if (state === GameState.AGE_SELECTION) {
      const found = Object.entries(AGE_BENCHMARKS).find(([_, data]) => data.pad === idx);
      if (found) {
        audioService.playDing();
        setSelectedAge(found[0] as AgeGroup);
        setGameState(GameState.LOBBY);
      }
      return;
    }

    // 로비(단계 선택) 로직: START 누르면 1단계 시작
    if (state === GameState.LOBBY && isConfirmKey) {
      audioService.playDing();
      startGame(StageId.CAN_CRUSH);
      return;
    }

    // 프리뷰 스킵
    if (state === GameState.PREVIEW && isConfirmKey) {
      audioService.playDing();
      setGameState(GameState.COUNTDOWN);
      return;
    }

    // 결과 창 또는 실패 창에서 다음 단계로
    if ((state === GameState.STAGE_CLEAR || state === GameState.GAMEOVER) && isConfirmKey) {
      audioService.playDing();
      if (currentStageId < StageId.MIND_CRASH) startGame((currentStageId + 1) as StageId);
      else setGameState(GameState.REPORT);
      return;
    }

    // 리포트(최종) 화면에서 재시작
    if (state === GameState.REPORT && isConfirmKey) {
      audioService.playDing();
      resetGameToLobby();
      return;
    }

    // 실제 플레이 로직
    if (state !== GameState.PLAYING || watching) return;
    
    const currentTime = Date.now();
    const reactionTime = currentTime - startTimeRef.current;
    // 1회차는 적응 및 헷갈림 방지 워밍업 회차, 2회차부터 공식 정밀 점수 측정에 반영
    const isWarmup = completedCount === 0;

    if (currentStageId === StageId.MEMORY_SEQUENCE) {
      if (idx === seq[seqIdx]) {
        audioService.playDing();
        const nextIdx = seqIdx + 1;
        if (nextIdx >= seq.length) {
          setRecords(prev => [...prev, { stageId: currentStageId, reactionTime, success: true, timestamp: currentTime, targetPad: idx, isWarmup }]);
          setStageCompletedCount(c => c + 1);
          if (!isWarmup) {
            setScore(s => s + 1);
          }
          setTimeout(spawnTarget, 800);
        } else {
          setSequencePlayerIdx(nextIdx);
        }
      } else {
        audioService.playWarning();
        triggerVisualFeedback();
        // 1회차 연습 중에는 실수하더라도 시간 페널티 면제
        if (!isWarmup) {
          setTimeLeft(prev => Math.max(0, prev - stageSet[currentStageId].penaltyTime));
        }
        setRecords(prev => [...prev, { stageId: currentStageId, reactionTime, success: false, timestamp: currentTime, targetPad: idx, isWarmup }]);
        playSequenceVisuals(seq);
        setSequencePlayerIdx(0);
      }
      return;
    }

    if (currentStageId === StageId.COLOR_REFLEX || currentStageId === StageId.MIND_CRASH) {
      const isCorrect = currentStageId === StageId.MIND_CRASH ? s5Correct.includes(idx) : pads[idx]?.name === goal?.name;
      if (isCorrect) {
        audioService.playDing();
        setRecords(prev => [...prev, { stageId: currentStageId, reactionTime, success: true, timestamp: currentTime, targetPad: idx, isWarmup }]);
        setStageCompletedCount(c => c + 1);
        if (!isWarmup) {
          setScore(s => s + 1);
        }
        setTargets([]);
        spawnTarget();
      } else {
        audioService.playWarning();
        triggerVisualFeedback();
        // 1회차 연습 중에는 실수하더라도 시간 페널티 면제
        if (!isWarmup) {
          setTimeLeft(prev => Math.max(0, prev - stageSet[currentStageId].penaltyTime));
        }
        setRecords(prev => [...prev, { stageId: currentStageId, reactionTime, success: false, timestamp: currentTime, targetPad: idx, isWarmup }]);
      }
      return;
    }

    if (activeTargets.includes(idx)) {
      const currentHp = health[idx] || 1;
      const newHp = currentHp - 1;
      
      if (newHp > 0) {
        audioService.playSplash();
        triggerVisualFeedback(idx);
        setTargetHealth(prev => ({ ...prev, [idx]: newHp }));
        // 2단계일 경우 숫자 UI 실시간 갱신
        if (currentStageId === StageId.EXTINGUISH_FIRE) {
          setTargetContent(prev => ({ ...prev, [idx]: getFireContent(newHp) }));
        }
      } else {
        audioService.playCrush();
        setRecords(prev => [...prev, { stageId: currentStageId, reactionTime, success: true, timestamp: currentTime, targetPad: idx, isWarmup }]);
        setStageCompletedCount(c => c + 1);
        if (!isWarmup) {
          setScore(s => s + 1);
        }
        setTargets([]);
        spawnTarget();
      }
    } else {
      triggerVisualFeedback();
    }
  }, [spawnTarget, playSequenceVisuals, startGame, resetGameToLobby]);

  useEffect(() => {
    serialService.onData((data) => {
      setInputs(data);
      for (let i = 1; i <= 9; i++) handleBoardInput(i, data[i as keyof BoardInput]);
      if (data.START) handleBoardInput(11, true);
      else lastProcessedInputs.current[11] = false;
      if (data.SELECT) handleBoardInput(10, true);
      else lastProcessedInputs.current[10] = false;
    });
    serialService.onStatusChange(setConnected);
    const handleKD = (e: KeyboardEvent) => {
      // 관리자 단축키: Ctrl + Shift + D 또는 F9 누르면 오프라인 참가자 데이터 모달 및 CSV 다운로드 관리창 열림
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) || e.key === 'F9') {
        e.preventDefault();
        setIsAdminRecordsOpen(prev => !prev);
        return;
      }

      const keyMap: any = { '7': 1, '8': 2, '9': 3, '4': 4, '5': 5, '6': 6, '1': 7, '2': 8, '3': 9, 'a': 10, 'b': 11, ' ': 11, 'Enter': 11 };
      if (keyMap[e.key]) handleBoardInput(keyMap[e.key], true);
    };
    const handleKU = (e: KeyboardEvent) => {
      const keyMap: any = { '7': 1, '8': 2, '9': 3, '4': 4, '5': 5, '6': 6, '1': 7, '2': 8, '3': 9, 'a': 10, 'b': 11, ' ': 11, 'Enter': 11 };
      if (keyMap[e.key]) handleBoardInput(keyMap[e.key], false);
    };
    window.addEventListener('keydown', handleKD);
    window.addEventListener('keyup', handleKU);
    return () => {
      window.removeEventListener('keydown', handleKD);
      window.removeEventListener('keyup', handleKU);
    };
  }, [handleBoardInput]);

  // 프리뷰 타이머 효과
  useEffect(() => {
    if (gameState === GameState.PREVIEW) {
      const timer = setInterval(() => {
        setPreviewTimer(t => {
          if (t <= 0.1) {
            clearInterval(timer);
            setGameState(GameState.COUNTDOWN);
            return 0;
          }
          return t - 0.1;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === GameState.COUNTDOWN) {
      audioService.playCountdownTick(); 
      let count = 3;
      setCountdown(3);
      const interval = setInterval(() => {
        count--;
        if (count === 2) { setCountdown(2); audioService.playCountdownTick(); }
        else if (count === 1) { setCountdown(1); audioService.playCountdownTick(); }
        else if (count === 0) { setCountdown('시작!'); audioService.playCountdownGo(); }
        else if (count === -1) { clearInterval(interval); startActualPlay(); }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, startActualPlay]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 0) { audioService.playGameOver(); setGameState(GameState.GAMEOVER); return 0; }
          return t - 0.1;
        });
      }, 100);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  useEffect(() => {
    const maxTargetCount = currentStage === StageId.MEMORY_SEQUENCE 
      ? get_stage4_target_level(selectedAge) 
      : settings[currentStage].targetCount;

    if (score >= maxTargetCount && gameState === GameState.PLAYING) {
      audioService.playClear();
      setGameState(GameState.STAGE_CLEAR);
    }
  }, [score, currentStage, gameState, settings, selectedAge]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && !isWatchingSequence) {
      if (currentStage === StageId.MEMORY_SEQUENCE) {
        if (sequence.length === 0) spawnTarget();
      } else {
        if (targets.length === 0) spawnTarget();
      }
    }
  }, [gameState, targets.length, isWatchingSequence, spawnTarget, currentStage, sequence.length]);

  return (
    <div className={`h-screen w-screen overflow-hidden relative p-2 md:p-3 flex flex-col justify-between transition-transform duration-100 select-none ${shake ? 'shake' : ''}`}>
      {/* 각 차시별 처음으로 돌아가기 버튼 (구석 배치, 마우스 클릭으로만 동작) */}
      {gameState !== GameState.AGE_SELECTION && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            audioService.playClick();
            resetGameToLobby();
          }}
          className="fixed top-3 left-3 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-rose-950/90 text-slate-200 hover:text-white border border-slate-700 hover:border-rose-500 rounded-xl shadow-2xl backdrop-blur-md text-xs font-bold orbitron transition-all cursor-pointer group active:scale-95 select-none"
          title="마우스로 클릭하여 처음 시작 화면(연령 선택)으로 돌아갑니다 (키보드/발판 미동작)"
        >
          <Home size={14} className="text-rose-400 group-hover:scale-110 transition-transform" />
          <span>처음으로</span>
          <span className="text-[9px] text-slate-400 group-hover:text-rose-200 font-normal hidden sm:inline">(마우스 전용)</span>
        </button>
      )}

      {/* 우측 상단 시리얼 연결 상태 */}
      <ConnectionStatus connected={connected} onConnect={() => serialService.connect()} />

      {/* 좌측 하단 관리자 오프라인 데이터/CSV 다운로드 숨김 버튼 */}
      <button
        type="button"
        onClick={() => setIsAdminRecordsOpen(true)}
        className="fixed bottom-2.5 left-2.5 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/40 hover:bg-slate-900/90 text-slate-500 hover:text-slate-200 border border-slate-800/60 hover:border-sky-500/50 text-[10px] font-bold orbitron opacity-25 hover:opacity-100 transition-all cursor-pointer select-none backdrop-blur-sm"
        title="관리자: 누적 참가자 기록 확인 및 엑셀 CSV 다운로드 (단축키: Ctrl+Shift+D)"
      >
        <FileSpreadsheet size={13} className="text-sky-400" />
        <span className="hidden sm:inline">참가자 데이터</span>
        <span className="text-[9px] text-slate-500 font-mono">[Ctrl+Shift+D]</span>
      </button>

      {/* 관리자 오프라인 기록 및 CSV 다운로드 모달 */}
      <AdminRecordsModal
        isOpen={isAdminRecordsOpen}
        onClose={() => setIsAdminRecordsOpen(false)}
      />
      
      {gameState === GameState.AGE_SELECTION && (
        <div className="flex flex-col items-center justify-center h-full max-h-screen overflow-hidden py-1 px-3 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-1 mb-2 shrink-0">
             <h2 className="text-2xl md:text-4xl font-black orbitron italic text-white neon-text-blue uppercase tracking-tight">
               당신의 연령대를 선택하세요
             </h2>
             <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-sky-500/20 border border-sky-400/60 rounded-full shadow-md">
               <Footprints size={16} className="text-sky-300 animate-bounce" />
               <p className="text-sky-200 font-black orbitron tracking-wide text-xs md:text-sm">
                 선택은 매트 발판을 누르세요 (P1~P7 밟기 또는 마우스 클릭)
               </p>
             </div>
          </div>
          
          {/* 3x3 Mat Grid: 물리 팡팡보드 매트와 1:1 동일한 사각 발판 레이아웃 */}
          <div className="grid grid-cols-3 gap-2.5 md:gap-3.5 w-full max-w-md md:max-w-xl max-h-[64vh] aspect-square p-2.5 md:p-3.5 bg-slate-900/70 rounded-3xl border-2 border-slate-700/70 shadow-[0_0_50px_rgba(0,0,0,0.7)] backdrop-blur-md">
            {[
              { pad: 1, age: AgeGroup.TODDLER },
              { pad: 2, age: AgeGroup.CHILD },
              { pad: 3, age: AgeGroup.YOUTH },
              { pad: 4, age: AgeGroup.MIDDLE },
              { pad: 5, center: true },
              { pad: 6, age: AgeGroup.SENIOR },
              { pad: 7, age: AgeGroup.ELDERLY },
              { pad: 8, reserved: true, label: "아래 빈 공간 1" },
              { pad: 9, reserved: true, label: "아래 빈 공간 2" },
            ].map((cell) => {
              const isPressed = inputs[cell.pad as keyof BoardInput];

              // 중앙 홈 발판 (5번): 유저가 서 있는 대기 위치
              if (cell.center) {
                return (
                  <div 
                    key={5}
                    className={`relative flex flex-col items-center justify-center w-full h-full rounded-2xl md:rounded-3xl border-2 md:border-3 p-2 select-none transition-all duration-150 ${
                      isPressed 
                        ? 'bg-slate-800 border-sky-400 shadow-[inset_0_0_20px_rgba(56,189,248,0.3)]' 
                        : 'bg-slate-900/90 border-slate-700/80'
                    }`}
                  >
                    <span className="absolute top-2 left-2 text-[9px] md:text-[10px] font-black orbitron text-slate-500">P5</span>
                    <div className="p-2 rounded-full border border-slate-600 bg-slate-800/80 text-sky-400 mb-0.5">
                      <span className="text-xl md:text-2xl">👣</span>
                    </div>
                    <span className="text-[11px] md:text-xs font-black orbitron text-white">CENTER</span>
                    <span className="text-[8px] md:text-[9px] text-slate-400 font-bold">홈 대기 위치</span>
                  </div>
                );
              }

              // 아래 2곳 빈 공간 (8번, 9번 발판): 매트와 동일한 사각 형태로 참가자에게 매트 일체감 전달
              if (cell.reserved) {
                return (
                  <div 
                    key={cell.pad}
                    onClick={() => audioService.playClick()}
                    className={`relative flex flex-col items-center justify-center w-full h-full rounded-2xl md:rounded-3xl border-2 md:border-3 p-2 select-none cursor-pointer transition-all duration-150 ${
                      isPressed 
                        ? 'bg-sky-400/30 border-sky-400 scale-95 shadow-[0_0_25px_rgba(56,189,248,0.4)]' 
                        : 'bg-slate-800/30 border-slate-700/70 hover:border-slate-500'
                    }`}
                  >
                    <span className="absolute top-2 left-2 text-[9px] md:text-[10px] font-black orbitron text-slate-500">P{cell.pad}</span>
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 mb-0.5">
                      <span className="text-xs font-black orbitron">-</span>
                    </div>
                    <span className="text-[11px] md:text-xs font-black orbitron text-slate-400">빈 발판</span>
                    <span className="text-[8px] md:text-[9px] text-slate-500 font-bold">(선택 없음)</span>
                  </div>
                );
              }

              // 연령 선택 사각 발판 (1, 2, 3, 4, 6, 7번)
              const data = AGE_BENCHMARKS[cell.age!];
              const scaled = get_scaled_benchmark(cell.age!, difficulty);
              return (
                <div 
                  key={cell.pad} 
                  onClick={() => { audioService.playDing(); setSelectedAge(cell.age!); setGameState(GameState.LOBBY); }}
                  className={`relative flex flex-col items-center justify-center rounded-2xl md:rounded-3xl border-2 md:border-3 transition-all duration-150 cursor-pointer overflow-hidden p-2 md:p-3 group shadow-lg ${
                    isPressed 
                      ? 'bg-sky-400/30 border-sky-400 scale-95 shadow-[0_0_30px_rgba(56,189,248,0.6)] ring-4 ring-sky-400/50' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-sky-400 hover:scale-105'
                  }`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: data.color }}></div>
                  <span className="absolute top-2 left-2 text-[9px] md:text-[10px] font-black text-slate-400 orbitron">P{cell.pad}</span>
                  
                  {cell.age === AgeGroup.TODDLER ? <Baby size={28} style={{ color: data.color }} /> : 
                   cell.age === AgeGroup.CHILD ? <User size={28} style={{ color: data.color }} /> : 
                   cell.age === AgeGroup.ELDERLY ? <UserRound size={28} style={{ color: data.color }} /> : 
                   <PersonStanding size={28} style={{ color: data.color }} />}
                  
                  <span className="mt-1 text-xs md:text-sm font-black orbitron text-white text-center leading-tight">
                    {data.label}
                  </span>
                  <span className="text-[8px] md:text-[9px] text-slate-400 font-bold orbitron mt-0.5">
                    S기준 ≤{scaled.S_time.toFixed(2)}s
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-slate-400 text-[11px] md:text-xs font-bold orbitron shrink-0 text-center">
            💡 매트 중앙(5번)에 서서 연령대 사각 발판(1, 2, 3, 4, 6, 7번)을 발로 누르세요
          </p>
        </div>
      )}

      {gameState === GameState.LOBBY && (
        <div className="flex flex-col items-center justify-center h-full max-h-screen py-2 px-4 space-y-2.5 md:space-y-3.5 text-center animate-in fade-in duration-500 overflow-hidden">
          {/* Selected Age Badge + Difficulty Selector in one balanced bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-slate-800/90 px-3.5 py-1 rounded-full border border-slate-700">
               <User size={14} className="text-sky-400" />
               <span className="text-xs font-bold orbitron text-white">{AGE_BENCHMARKS[selectedAge].name} ({AGE_BENCHMARKS[selectedAge].ageSpan})</span>
               <button onClick={() => setGameState(GameState.AGE_SELECTION)} className="ml-1 text-[10px] text-sky-400 underline font-bold orbitron hover:text-white cursor-pointer">연령 변경</button>
            </div>

            {/* Quick Difficulty Pills */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-full border border-slate-700">
              <span className="text-[10px] font-bold orbitron text-slate-400 px-1.5 flex items-center gap-1">
                <Gauge size={12} className="text-sky-400" /> 기준표:
              </span>
              {(Object.keys(DIFFICULTY_CONFIG) as BenchmarkDifficulty[]).map((diffKey) => {
                const diff = DIFFICULTY_CONFIG[diffKey];
                const isSelected = difficulty === diffKey;
                return (
                  <button
                    key={diffKey}
                    onClick={() => { audioService.playDing(); setDifficulty(diffKey); }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold orbitron transition-all cursor-pointer ${
                      isSelected
                        ? `${diff.badgeColor} font-black shadow-md`
                        : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'
                    }`}
                    title={diff.description}
                  >
                    {diff.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-0.5 shrink-0">
            <h1 className="text-3xl md:text-5xl font-black orbitron italic text-white tracking-tight neon-text-blue">
              PANGPANG BOARD PRO
            </h1>
            <p className="text-slate-400 font-bold orbitron text-[11px] md:text-xs tracking-wider">
              스마트 3x3 발판 전신 반응 및 인지 스텝 트레이닝
            </p>
          </div>

          {/* START 누르면 시작: 초대형 강조 시작 버튼 */}
          <div className="w-full max-w-xl shrink-0 my-0.5">
            <button 
              onClick={() => startGame(StageId.CAN_CRUSH)} 
              className="w-full py-4 md:py-6 px-8 bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 hover:from-emerald-300 hover:to-sky-300 text-slate-950 rounded-2xl md:rounded-3xl font-black orbitron text-2xl md:text-3xl shadow-[0_0_50px_rgba(56,189,248,0.55)] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 md:gap-4 animate-pulse group cursor-pointer border-2 border-white/80"
            >
              <Zap size={32} className="fill-slate-950 text-slate-950 shrink-0" />
              <span className="tracking-wide">START 누르면 시작!</span>
            </button>
            <p className="text-sky-300 font-bold orbitron text-xs md:text-sm mt-1.5 tracking-wider">
              보드의 <span className="text-white underline font-black">START</span> 발판(또는 엔터/스페이스)을 누르면 즉시 3-2-1 시작됩니다
            </p>
          </div>

          {/* 종목 고르는 부분: 크기 작게 컴팩트 배치 */}
          <div className="w-full max-w-xl bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800/80 shrink-0">
            <p className="text-[10px] font-bold orbitron text-slate-400 uppercase tracking-widest mb-1 text-center">
              또는 종목 개별 선택 (연습 / 빠른 테스트)
            </p>
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {(Object.keys(STAGE_TITLES) as unknown as string[]).map((idStr) => {
                const id = Number(idStr) as StageId;
                return (
                  <button 
                    key={id} 
                    onClick={() => startGame(id)} 
                    className="group relative bg-slate-800/60 hover:bg-sky-500/20 border border-slate-700/80 hover:border-sky-500 py-1.5 px-2 rounded-xl transition-all duration-200 text-center cursor-pointer"
                  >
                    <p className="text-[9px] font-bold text-sky-400 orbitron">ST 0{id}</p>
                    <h4 className="text-[10px] md:text-[11px] font-bold orbitron text-white group-hover:text-sky-300 truncate">{STAGE_TITLES[id]}</h4>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 pt-0.5">
            <button onClick={() => setGameState(GameState.ADMIN)} className="flex items-center gap-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700 font-bold orbitron text-[11px] transition-all cursor-pointer">
              <Settings size={13} /> SYSTEM CONFIG (난이도 및 설정)
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.PREVIEW && (
        <div className="flex flex-col items-center justify-center h-full max-h-screen p-3 animate-in fade-in duration-500 overflow-hidden">
           <div className="max-w-xl w-full bg-slate-900/90 border border-slate-700 rounded-3xl p-5 md:p-7 shadow-2xl backdrop-blur-xl text-center space-y-4">
              <h2 className="text-3xl md:text-5xl font-black orbitron italic text-white neon-text-blue">{STAGE_TITLES[currentStage]}</h2>
              <p className="text-lg md:text-xl font-bold text-yellow-400 orbitron">"{STAGE_KEY_PHRASES[currentStage]}"</p>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 transition-all duration-100 ease-linear" 
                  style={{ width: `${(previewTimer / settings[currentStage].instructionDuration) * 100}%` }}
                ></div>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <button onClick={() => setGameState(GameState.COUNTDOWN)} className="bg-white text-slate-900 px-7 py-3 rounded-2xl font-black orbitron text-base shadow-xl hover:bg-sky-400 hover:text-white transition-all cursor-pointer">SKIP PREVIEW (START)</button>
                <p className="text-slate-400 text-xs orbitron animate-pulse">PRESS START BUTTON TO BEGIN ({previewTimer.toFixed(0)}s)</p>
              </div>
           </div>
        </div>
      )}

      {gameState === GameState.COUNTDOWN && (
        <div className="flex flex-col items-center justify-center h-full max-h-screen animate-in zoom-in overflow-hidden text-center space-y-3">
          <div className="px-4 py-1.5 bg-sky-500/20 border border-sky-400/50 rounded-full shadow-md">
            <p className="text-sm md:text-base font-black orbitron text-sky-300 tracking-wider">
              {STAGE_TITLES[currentStage]}
            </p>
          </div>
          <span className="text-[140px] md:text-[200px] font-black orbitron italic text-white drop-shadow-[0_0_60px_rgba(56,189,248,0.9)] leading-none">
            {countdown}
          </span>
          <p className="text-slate-300 font-bold orbitron text-sm md:text-base tracking-wide animate-pulse">
            👣 발판 중앙(5번)에 서서 준비하세요!
          </p>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <div className="flex flex-col justify-between h-full max-h-screen overflow-hidden p-1.5 md:p-2.5 space-y-1.5">
          {/* Top Bar */}
          <div className="w-full max-w-6xl mx-auto flex justify-between items-center px-4 py-1.5 border-b border-slate-800 shrink-0 h-11">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-sky-400 orbitron uppercase">
                  STAGE 0{currentStage} | {AGE_BENCHMARKS[selectedAge].name} ({DIFFICULTY_CONFIG[difficulty].label})
                </p>
                {(currentStage === StageId.COLOR_REFLEX || currentStage === StageId.MIND_CRASH) && 
                 (selectedAge === AgeGroup.TODDLER || selectedAge === AgeGroup.CHILD) && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[9px] font-bold orbitron">
                    👨‍👩‍👧 부모 안내 모드 (문제당 8초+ 제공)
                  </span>
                )}
              </div>
              <h2 className="text-lg md:text-xl font-black orbitron italic text-white tracking-widest leading-none">
                {STAGE_TITLES[currentStage]}
              </h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-500 orbitron uppercase">
                  {stageCompletedCount === 0 ? 'STATUS' : 'SCORE'}
                </p>
                <p className="text-xl md:text-2xl font-black orbitron text-white leading-none">
                  {stageCompletedCount === 0 ? (
                    <span className="text-amber-400 text-sm md:text-base font-bold">
                      연습 중 (0/{currentStage === StageId.MEMORY_SEQUENCE ? get_stage4_target_level(selectedAge) : settings[currentStage].targetCount})
                    </span>
                  ) : (
                    <span>
                      {score} / {currentStage === StageId.MEMORY_SEQUENCE ? get_stage4_target_level(selectedAge) : settings[currentStage].targetCount}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-500 orbitron uppercase">TIMER</p>
                <p className={`text-xl md:text-2xl font-black orbitron leading-none ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {timeLeft.toFixed(1)}s
                </p>
              </div>
            </div>
          </div>

          {/* Main Content: Left HUD + Board + Right HUD */}
          <div className="flex-1 min-h-0 flex items-center justify-center gap-3 md:gap-6 w-full max-w-7xl mx-auto px-2">
            {/* Left Panel */}
            <div className="w-52 md:w-60 h-full max-h-[calc(100vh-110px)] flex flex-col justify-between p-3.5 bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl overflow-hidden shrink-0">
              <div className="text-center space-y-2">
                <Target size={36} className="text-sky-500 mx-auto" />
                <p className="text-xs font-black orbitron text-white">MISSION IN PROGRESS</p>
                
                {/* 문제를 내는 곳: 검은색 글자도 아주 잘 보이도록 배경을 밝은 흰색/크림색 사각 카드로 변경 */}
                {activeGoalColor && (
                  <div className="p-3.5 bg-white border-4 border-amber-400 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.7)] mt-1 text-center">
                    <p className="text-[11px] text-slate-800 font-black uppercase tracking-wider mb-1">
                      {currentStage === StageId.MIND_CRASH ? '🎯 문제: 글씨의 실제 [색상]!' : '🎯 제시 목표 색상'}
                    </p>
                    <div className="flex items-center justify-center gap-2.5 py-1 px-3 bg-slate-100 rounded-xl border border-slate-300">
                      <span 
                        className="text-3xl shrink-0" 
                        style={{ 
                          color: activeGoalDisplayHex || activeGoalColor.hex,
                          filter: (activeGoalDisplayHex || activeGoalColor.hex) === '#ffffff' ? 'drop-shadow(0 0 2px #000)' : undefined
                        }}
                      >
                        ●
                      </span>
                      <p 
                        className="text-2xl md:text-3xl font-black orbitron tracking-wide" 
                        style={{ 
                          color: activeGoalDisplayHex || activeGoalColor.hex,
                          textShadow: (activeGoalDisplayHex || activeGoalColor.hex) === '#111111' 
                            ? '0 0 1px #fff' 
                            : (activeGoalDisplayHex || activeGoalColor.hex) === '#ffffff' 
                              ? '0 0 2px #000, 0 0 4px #000' 
                              : 'none'
                        }}
                      >
                        {activeGoalColor.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Warm-up Trial Notice (1회차는 적응 스텝, 2회차부터 공식 반영) */}
              <div className="mt-auto">
                {stageCompletedCount === 0 ? (
                  <div className="p-2.5 bg-amber-500/20 border-2 border-amber-400 rounded-xl text-center shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse">
                    <p className="text-[11px] font-black text-amber-300 orbitron flex items-center justify-center gap-1">
                      <span>🎯</span> 1회차: 적응 연습
                    </p>
                    <p className="text-[9px] text-amber-200 font-bold mt-0.5 leading-tight">
                      헷갈림 방지 워밍업 (점수 미반영)
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/60 rounded-xl text-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <p className="text-[11px] font-black text-emerald-300 orbitron flex items-center justify-center gap-1">
                      <span>⚡</span> 정밀 측정 진행 중
                    </p>
                    <p className="text-[9px] text-emerald-200 font-bold mt-0.5 leading-tight">
                      2회차부터 공식 기록 실시간 반영
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Center Board (Responsive height, aspect-square) */}
            <div className="h-full max-h-[calc(100vh-110px)] flex flex-col items-center justify-center shrink-0">
              {/* 5단계 스트룹 / 3단계 색상: 보드 바로 위에도 크고 밝은 문제 사각 카드 노출 */}
              {activeGoalColor && (
                <div className="mb-2 px-4 py-1.5 bg-white border-4 border-amber-400 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.8)] flex items-center justify-center gap-3.5 shrink-0 animate-in fade-in">
                  <div className="text-left">
                    <span className="text-[11px] font-black text-rose-600 orbitron block leading-tight">
                      {currentStage === StageId.MIND_CRASH ? '🎯 문제: 글씨의 실제 [색상]을 밟으세요!' : '🎯 문제: 제시된 색상 발판을 찾으세요!'}
                    </span>
                    <span className="text-[10px] text-slate-600 font-bold">
                      {currentStage === StageId.MIND_CRASH ? '글자의 뜻이 아닌 글씨 색깔에 집중!' : '8방향 중 동일한 색상 발판 선택'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-0.5 rounded-xl border-2 border-slate-300">
                    <span 
                      className="text-2xl" 
                      style={{ 
                        color: activeGoalDisplayHex || activeGoalColor.hex,
                        filter: (activeGoalDisplayHex || activeGoalColor.hex) === '#ffffff' ? 'drop-shadow(0 0 2px #000)' : undefined
                      }}
                    >
                      ●
                    </span>
                    <span 
                      className="text-xl md:text-2xl font-black orbitron tracking-wider" 
                      style={{ 
                        color: activeGoalDisplayHex || activeGoalColor.hex,
                        textShadow: (activeGoalDisplayHex || activeGoalColor.hex) === '#111111' 
                          ? '0 0 1px #fff' 
                          : (activeGoalDisplayHex || activeGoalColor.hex) === '#ffffff' 
                            ? '0 0 2px #000, 0 0 4px #000' 
                            : 'none'
                      }}
                    >
                      {activeGoalColor.name}
                    </span>
                  </div>
                </div>
              )}

              {stageCompletedCount === 0 && (
                <div className="mb-1.5 py-1 px-3 bg-amber-500/20 border border-amber-400/80 rounded-full text-center text-amber-300 font-bold text-[10px] md:text-xs orbitron animate-pulse shadow-md shrink-0">
                  🎯 1회차는 적응 스텝입니다! 편하게 밟아보세요 (2회차부터 공식 측정)
                </div>
              )}
              <Board inputs={inputs} targets={targets} targetContent={targetContent} splashes={splashes} highlighted={displayingSequence} />
            </div>

            {/* Right Panel */}
            <div className="w-52 md:w-60 h-full max-h-[calc(100vh-110px)] flex flex-col justify-between p-3.5 bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl overflow-hidden shrink-0">
              <div className="space-y-3">
                <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
                  <p className="text-[9px] font-bold text-slate-500 orbitron uppercase">Current TRT</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <p className="text-3xl font-black orbitron text-sky-400">
                      {records.length > 0 ? records[records.length-1].reactionTime : '---'}
                    </p>
                    <span className="text-[9px] font-bold text-slate-500 orbitron">MS</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
                  <p className="text-[9px] font-bold text-slate-500 orbitron uppercase">Age S-Target</p>
                  <p className="text-xl font-black orbitron text-yellow-400 mt-0.5">
                    ≤ {get_scaled_benchmark(selectedAge, difficulty).S_time.toFixed(2)}S
                  </p>
                  <p className="text-[9px] text-slate-500 orbitron mt-0.5">
                    평균(B): {get_scaled_benchmark(selectedAge, difficulty).B_time.toFixed(2)}s
                  </p>
                </div>
              </div>

              <div className="p-2 bg-slate-950/40 rounded-xl border border-slate-800/60 text-center">
                <p className="text-[9px] font-bold text-slate-400 orbitron">
                  중앙(CENTER)에서 발을 떼어<br/>타겟 발판을 신속히 밟으세요!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {gameState === GameState.STAGE_CLEAR && (
        <div className="flex flex-col items-center justify-center h-full max-h-screen p-4 overflow-hidden animate-in zoom-in">
          <div className="bg-slate-900/90 border-2 border-emerald-500/80 p-5 md:p-7 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col items-center text-center max-w-xl w-full">
            <div className="flex items-center gap-2.5 text-emerald-400 mb-1">
              <CheckCircle2 size={36} />
              <span className="text-xl md:text-2xl font-black orbitron italic neon-text-green">
                STAGE 0{currentStage} CLEAR!
              </span>
            </div>

            {currentStage < StageId.MIND_CRASH ? (
              <>
                {/* 1단계 이후 넥스트 미션: 다음 단계에 대한 한국어 상세 설명 */}
                <div className="w-full my-3.5 p-3.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black orbitron text-sky-400 uppercase">
                      다음 미션: STAGE 0{currentStage + 1}
                    </span>
                    <span className="text-xs font-bold orbitron text-yellow-400">
                      {STAGE_TITLES[(currentStage + 1) as StageId]}
                    </span>
                  </div>
                  <h4 className="text-sm md:text-base font-bold text-white leading-snug">
                    "{STAGE_KEY_PHRASES[(currentStage + 1) as StageId]}"
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {STAGE_DESCRIPTIONS[(currentStage + 1) as StageId]}
                  </p>
                </div>

                {/* START를 누르면 진행 대형 버튼 */}
                <div className="w-full space-y-2">
                  <button 
                    onClick={() => startGame((currentStage + 1) as StageId)} 
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 hover:from-emerald-300 hover:to-sky-300 text-slate-950 rounded-2xl font-black text-xl md:text-2xl orbitron shadow-[0_0_40px_rgba(56,189,248,0.4)] active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse cursor-pointer border-2 border-white/70"
                  >
                    <Zap size={26} className="fill-slate-950 text-slate-950" />
                    <span>START를 누르면 진행</span>
                    <ChevronRight size={24} />
                  </button>
                  <p className="text-slate-400 text-xs orbitron">
                    보드의 START 발판 또는 위 버튼을 누르면 <strong className="text-white">3 2 1 카운트다운 후 바로 시작</strong>됩니다
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full space-y-3 my-2">
                <div className="p-4 bg-slate-950/80 border border-slate-700 rounded-2xl">
                  <h4 className="text-lg font-bold text-white mb-1">🎉 모든 트레이닝 스테이지 완료!</h4>
                  <p className="text-xs text-slate-300">스포츠 의학 기준 다면 전신 반응 및 인지 리포트를 산출했습니다.</p>
                </div>
                <button 
                  onClick={() => setGameState(GameState.REPORT)} 
                  className="w-full py-4 px-6 bg-gradient-to-r from-sky-400 via-emerald-400 to-sky-400 text-slate-950 rounded-2xl font-black text-xl orbitron shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  START를 누르면 결과 리포트 확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {gameState === GameState.GAMEOVER && (
        <div className="flex flex-col items-center justify-center h-full max-h-screen space-y-4 md:space-y-6 animate-in zoom-in px-4 overflow-hidden">
          <div className="bg-red-500/20 p-8 rounded-full border-4 border-red-500">
            <AlertTriangle size={64} className="text-red-500" />
          </div>
          <h2 className="text-5xl md:text-6xl font-black orbitron italic text-white neon-text-red">TIME'S UP!</h2>
          <div className="flex flex-col items-center gap-3">
            <button 
              onClick={() => { if(currentStage < StageId.MIND_CRASH) startGame((currentStage + 1) as StageId); else setGameState(GameState.REPORT); }} 
              className="group flex items-center gap-3 bg-sky-600 text-white px-10 py-4 rounded-2xl font-black text-xl orbitron shadow-2xl transition-all active:scale-95 hover:bg-sky-500 cursor-pointer"
            >
              <span>START를 누르면 다음 미션 진행</span> <ArrowRightCircle size={24} />
            </button>
            <button onClick={() => startGame(currentStage)} className="text-slate-400 hover:text-white font-bold orbitron uppercase tracking-widest text-xs cursor-pointer">RETRY MISSION</button>
            <p className="text-slate-500 text-xs orbitron animate-pulse mt-2">PRESS START BUTTON TO PROCEED</p>
          </div>
        </div>
      )}

      {gameState === GameState.REPORT && (
        <div className="fixed inset-0 flex items-center justify-center p-2 md:p-4 bg-black/70 backdrop-blur-md z-[100] overflow-hidden">
          <div className="relative w-full max-w-4xl flex flex-col items-center">
            <Report 
              records={records} 
              onReset={resetGameToLobby} 
              settings={settings} 
              ageGroup={selectedAge} 
              difficulty={difficulty}
              onChangeAge={() => setGameState(GameState.AGE_SELECTION)}
            />
            <div className="mt-2 text-center">
              <p className="text-white/50 orbitron font-bold text-[11px] animate-pulse">PRESS START BUTTON TO RESTART ALL TRAINING</p>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.ADMIN && (
        <div className="max-w-2xl mx-auto p-6 md:p-8 bg-slate-900 border border-slate-700 rounded-3xl mt-4 md:mt-8 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-3">
            <h2 className="text-2xl md:text-3xl font-bold orbitron neon-text-blue">SYSTEM CONFIG</h2>
            <button onClick={() => setGameState(GameState.LOBBY)} className="text-slate-400 hover:text-white orbitron font-bold text-sm cursor-pointer">CLOSE</button>
          </div>

          {/* 기준표 난이도 설정 (쉽게 ~ 어렵게 여러 단계 설정) */}
          <div className="mb-6 p-4 bg-slate-800/90 rounded-2xl border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="text-sky-400" size={18} />
              <h4 className="font-bold orbitron text-white text-sm">기준표 난이도 설정 (쉽게 ~ 어렵게)</h4>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              참가자 대상에 맞춰 연령대별 합격 및 등급 기준 시간을 탄력적으로 조정합니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as BenchmarkDifficulty[]).map((diffKey) => {
                const diff = DIFFICULTY_CONFIG[diffKey];
                const isSelected = difficulty === diffKey;
                return (
                  <button
                    key={diffKey}
                    type="button"
                    onClick={() => setDifficulty(diffKey)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? `${diff.badgeColor} border-current font-black ring-2 ring-sky-400 shadow-md`
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold orbitron">{diff.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{diff.shortLabel}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-sky-300">
              💡 <strong>{DIFFICULTY_CONFIG[difficulty].label}</strong>: {DIFFICULTY_CONFIG[difficulty].description}
            </div>
          </div>

          <div className="space-y-4 pr-1">
            <h4 className="text-xs font-bold orbitron text-slate-400 uppercase tracking-wider">스테이지 파라미터 상세 설정</h4>
            {(Object.keys(settings) as unknown as string[]).map(idStr => {
              const id = Number(idStr) as StageId;
              return (
                <div key={id} className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700">
                  <h4 className="font-bold orbitron text-sky-400 mb-3 text-xs tracking-wider">{STAGE_TITLES[id]}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="text-[10px] text-slate-500 font-bold orbitron block mb-1">Target Count</label><input type="number" value={settings[id].targetCount} onChange={(e) => setSettings(prev => ({ ...prev, [id]: { ...prev[id], targetCount: parseInt(e.target.value) || 1 } }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white orbitron outline-none focus:border-sky-500"/></div>
                    <div><label className="text-[10px] text-slate-500 font-bold orbitron block mb-1">Time Limit (s)</label><input type="number" value={settings[id].timeLimit} onChange={(e) => setSettings(prev => ({ ...prev, [id]: { ...prev[id], timeLimit: parseInt(e.target.value) || 10 } }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white orbitron outline-none focus:border-sky-500"/></div>
                    <div><label className="text-[10px] text-slate-500 font-bold orbitron block mb-1">Preview (s)</label><input type="number" value={settings[id].instructionDuration} onChange={(e) => setSettings(prev => ({ ...prev, [id]: { ...prev[id], instructionDuration: parseInt(e.target.value) || 1 } }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white orbitron outline-none focus:border-sky-500"/></div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* 오프라인 참가자 데이터 관리 */}
          <div className="mt-6 p-4 bg-slate-800/90 rounded-2xl border border-emerald-500/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-400" size={18} />
                <h4 className="font-bold orbitron text-white text-sm">오프라인 참가자 데이터 관리</h4>
              </div>
              <span className="text-xs font-black text-amber-400 orbitron">
                누적 {storageService.getRecordCount()}명
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              인터넷 없이도 브라우저 localStorage에 누적된 모든 참가자 측정 기록을 엑셀 CSV 파일로 다운로드합니다.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => storageService.exportToCSV()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black text-xs orbitron shadow-md transition-all cursor-pointer"
              >
                <FileSpreadsheet size={15} /> 엑셀 CSV 파일 다운로드
              </button>
              <button
                type="button"
                onClick={() => setIsAdminRecordsOpen(true)}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold text-xs orbitron border border-slate-700 transition-all cursor-pointer"
              >
                상세 보기
              </button>
            </div>
          </div>

          <button onClick={() => setGameState(GameState.LOBBY)} className="w-full mt-6 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-2xl orbitron transition-all cursor-pointer">SAVE SETTINGS</button>
        </div>
      )}
    </div>
  );
};

export default App;
