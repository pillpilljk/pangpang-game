import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { StepRecord, StageId, GameSettings, AgeGroup, BenchmarkDifficulty } from '../types';
import { 
  AGE_BENCHMARKS, 
  get_scaled_benchmark,
  DIFFICULTY_CONFIG,
  calculate_speed_score, 
  get_grade, 
  GRADE_DETAILS, 
  STAGE_TITLES,
  get_stage4_target_level
} from '../constants';
import { storageService } from '../services/storageService';
import { 
  RotateCcw, 
  Share2, 
  Award, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  Info, 
  Activity, 
  Flame, 
  Eye, 
  Brain, 
  Footprints, 
  Copy, 
  Check, 
  User, 
  BarChart3, 
  TableProperties, 
  Zap, 
  Layers,
  Gauge,
  FileSpreadsheet,
  Download,
  HardDrive
} from 'lucide-react';

interface Props {
  records: StepRecord[];
  onReset: () => void;
  settings: Record<StageId, GameSettings>;
  ageGroup: AgeGroup;
  difficulty?: BenchmarkDifficulty;
  onChangeAge?: () => void;
}

export const Report: React.FC<Props> = ({ 
  records, 
  onReset, 
  settings, 
  ageGroup, 
  difficulty = BenchmarkDifficulty.NORMAL,
  onChangeAge 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'benchmarks' | 'stages'>('overview');
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [savedRecord, setSavedRecord] = useState<any>(null);
  const [cumulativeCount, setCumulativeCount] = useState<number>(() => storageService.getRecordCount());
  const hasSavedRef = React.useRef(false);

  const benchmark = get_scaled_benchmark(ageGroup, difficulty);
  const diffOption = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG[BenchmarkDifficulty.NORMAL];

  const reportData = useMemo(() => {
    const correctRecords = records.filter(r => r.success);
    const stageCorrect = (id: StageId) => correctRecords.filter(r => r.stageId === id);
    const stageAll = (id: StageId) => records.filter(r => r.stageId === id);

    // 각 테스트마다 처음 시작 1회는 적응/연습 회차로 간주하여 2회차부터 점수에 반영
    const getScoredRecords = (stageRecords: StepRecord[]) => {
      // 1. isWarmup === false 인 공식 측정 기록 우선 추출
      const nonWarmup = stageRecords.filter(r => r.isWarmup === false);
      if (nonWarmup.length > 0) return nonWarmup;
      // 2. 만약 플래그 미지정 데이터인 경우 첫 번째 회차 제외
      return stageRecords.length > 1 ? stageRecords.slice(1) : stageRecords;
    };

    // Stage 1 (CAN CRUSH): Choice Reaction Time (CRT) + Weight Transfer Time (WTT) (2회차부터 반영)
    const st1All = stageCorrect(StageId.CAN_CRUSH);
    const st1Records = getScoredRecords(st1All);
    const avg_time_st1 = st1Records.length > 0
      ? (st1Records.reduce((acc, r) => acc + r.reactionTime, 0) / st1Records.length) / 1000
      : benchmark.B_time;

    // Stage 2 (EXTINGUISH_FIRE) (2회차부터 반영)
    const st2Scored = getScoredRecords(stageCorrect(StageId.EXTINGUISH_FIRE));
    const success_count_st2 = st2Scored.length;
    const total_st2 = getScoredRecords(stageAll(StageId.EXTINGUISH_FIRE)).length || 1;

    // Stage 3 (COLOR REFLEX) (2회차부터 반영)
    const st3All = stageCorrect(StageId.COLOR_REFLEX);
    const st3Records = getScoredRecords(st3All);
    const avg_time_st3 = st3Records.length > 0
      ? (st3Records.reduce((acc, r) => acc + r.reactionTime, 0) / st3Records.length) / 1000
      : benchmark.B_time + 0.1;

    // Stage 4 (MEMORY SEQUENCE) (2회차부터 반영)
    const st4Scored = getScoredRecords(stageCorrect(StageId.MEMORY_SEQUENCE));
    const max_level_st4 = st4Scored.length;

    // Stage 5 (MIND CRASH) (2회차부터 반영)
    const st5All = stageCorrect(StageId.MIND_CRASH);
    const st5Records = getScoredRecords(st5All);
    const avg_time_st5 = st5Records.length > 0
      ? (st5Records.reduce((acc, r) => acc + r.reactionTime, 0) / st5Records.length) / 1000
      : benchmark.B_time + 0.2;

    // Overall Measured Time (2회차부터 정밀 측정된 유효 기록들의 평균)
    const allScoredChoiceRecords = [
      ...st1Records,
      ...st3Records,
      ...st5Records
    ];
    const overallReactionTime = st1Records.length > 0 
      ? avg_time_st1 
      : allScoredChoiceRecords.length > 0 
        ? (allScoredChoiceRecords.reduce((acc, r) => acc + r.reactionTime, 0) / allScoredChoiceRecords.length) / 1000
        : benchmark.B_time;

    const allReactionTimes = allScoredChoiceRecords.length > 0 
      ? allScoredChoiceRecords.map(r => r.reactionTime / 1000)
      : correctRecords.map(r => r.reactionTime / 1000);
    const bestReactionTime = allReactionTimes.length > 0 ? Math.min(...allReactionTimes) : avg_time_st1;
    const worstReactionTime = allReactionTimes.length > 0 ? Math.max(...allReactionTimes) : avg_time_st1;
    const time_gap = allReactionTimes.length > 1 ? worstReactionTime - bestReactionTime : 0;
    const totalAccuracy = records.length > 0 ? (correctRecords.length / records.length) * 100 : 100;

    // Multi-dimensional sub-scores (설정된 난이도 기준표 적용 및 30점 하한선 절대 방어)
    const clamp = (val: number) => Math.min(100, Math.max(30, Math.round(val)));
    const speed = Math.max(30, calculate_speed_score(avg_time_st1, ageGroup, StageId.CAN_CRUSH, difficulty));
    const power = clamp((success_count_st2 / Math.max(1, settings[StageId.EXTINGUISH_FIRE].targetCount * 0.8)) * 100);
    const accuracy = clamp(totalAccuracy);

    // 4단계 순서 기억력: 유아/초등 및 60대 이상 고령층은 Lv.3 성공 시 100점 만점 통과, 나머지는 Lv.5
    const targetLevel_st4 = get_stage4_target_level(ageGroup);
    const memory = clamp((Math.min(targetLevel_st4, max_level_st4) / targetLevel_st4) * 100);

    const brain = Math.max(30, calculate_speed_score(avg_time_st5, ageGroup, StageId.MIND_CRASH, difficulty));
    const stability = clamp(100 - (time_gap * 20));

    const chartScores = [
      { subject: '순발력(속도)', value: speed, fullMark: 100 },
      { subject: '민첩성(연타)', value: power, fullMark: 100 },
      { subject: '정확성(판단)', value: accuracy, fullMark: 100 },
      { subject: '기억력(순서)', value: memory, fullMark: 100 },
      { subject: '인지력(스트룹)', value: brain, fullMark: 100 },
      { subject: '안정성(리듬)', value: stability, fullMark: 100 },
    ];

    // 종합 분석 점수: 6개 전신 반응/인지 도메인의 종합 평균 점수 (최소 30점 방어)
    const rawSpeedScore = chartScores.reduce((acc, s) => acc + s.value, 0) / chartScores.length;
    const speedScore = Math.max(30.0, Number(rawSpeedScore.toFixed(1)));
    const grade = get_grade(speedScore);

    // Estimated Biological Reaction Age
    let biologicalAgeGroup = "청년 (13~39세)";
    let ageDiffText = "연령대 평균 수준의 건강한 반응입니다.";

    if (overallReactionTime <= 0.45) {
      biologicalAgeGroup = "청년 최상위 (10~20대)";
      ageDiffText = "신체 반응 나이가 청년 최상위권(20대 초반) 수준입니다!";
    } else if (overallReactionTime <= 0.55) {
      biologicalAgeGroup = "청년 수준 (20~30대)";
      ageDiffText = "실제 나이 대비 신체 반응 신경망이 매우 젊고 민첩합니다!";
    } else if (overallReactionTime <= 0.70) {
      biologicalAgeGroup = "30대 후반~40대 수준";
      ageDiffText = "충분히 빠르고 일상생활에서 활력 넘치는 반응 속도입니다.";
    } else if (overallReactionTime <= 0.85) {
      biologicalAgeGroup = "50대 중년 수준";
      ageDiffText = "표준적인 중년 반응 속도로 꾸준한 스텝 트레이닝 시 상승 가능합니다.";
    } else if (overallReactionTime <= 1.05) {
      biologicalAgeGroup = "60대 준고령 수준";
      ageDiffText = "체중 이동 및 스텝 감각을 위한 가벼운 리듬 운동을 추천합니다.";
    } else {
      biologicalAgeGroup = "70대 이상 고령 수준";
      ageDiffText = "낙상 예방 및 하지 근력 강화를 위해 지속적인 팡팡보드 훈련을 권장합니다.";
    }

    // Prescriptive feedback
    let feedback = "";
    if (grade === 'S') {
      feedback = "환상적입니다! 프로 스포츠 선수급의 전신 반응 시간과 완벽한 체중 이동 협응력을 갖추고 있습니다.";
    } else if (grade === 'A') {
      feedback = "매우 우수합니다! 해당 연령대 상위 수준의 반응 속도로 뇌와 하지 근육 간의 신호 전달이 빠릅니다.";
    } else if (grade === 'B') {
      feedback = "정상/평균 수준의 건강한 신체 반응 속도를 유지하고 계십니다. 주 3회 팡팡보드로 A등급에 도전해보세요!";
    } else {
      feedback = "스텝 반응 시간이 다소 지연되었습니다. 발목 탄력과 체중 중심 이동 감각을 기르면 빠르게 향상됩니다.";
    }

    return {
      scores: chartScores,
      grade,
      speedScore,
      overallReactionTime,
      bestReactionTime,
      totalAccuracy,
      timeGap: time_gap,
      biologicalAgeGroup,
      ageDiffText,
      feedback,
      stages: {
        st1: { 
          name: STAGE_TITLES[StageId.CAN_CRUSH], 
          avg: avg_time_st1, 
          count: st1Records.length, 
          score: calculate_speed_score(avg_time_st1, ageGroup, StageId.CAN_CRUSH, difficulty) 
        },
        st2: { 
          name: STAGE_TITLES[StageId.EXTINGUISH_FIRE], 
          count: success_count_st2, 
          total: total_st2, 
          score: power 
        },
        st3: { 
          name: STAGE_TITLES[StageId.COLOR_REFLEX], 
          avg: avg_time_st3, 
          count: st3Records.length, 
          score: calculate_speed_score(avg_time_st3, ageGroup, StageId.COLOR_REFLEX, difficulty) 
        },
        st4: { 
          name: STAGE_TITLES[StageId.MEMORY_SEQUENCE], 
          maxLevel: max_level_st4, 
          score: memory 
        },
        st5: { 
          name: STAGE_TITLES[StageId.MIND_CRASH], 
          avg: avg_time_st5, 
          count: st5Records.length, 
          score: calculate_speed_score(avg_time_st5, ageGroup, StageId.MIND_CRASH, difficulty) 
        },
      }
    };

  }, [records, benchmark, settings, ageGroup, difficulty]);

  const handleCopyReport = () => {
    if (!reportData) return;
    const text = `[팡팡보드 전신 반응(인지+스텝) 분석 리포트]
• 연령 그룹: ${benchmark.label}
• 종합 판정: ${reportData.grade}등급 (${reportData.speedScore}점)
• 전신 반응 시간(CRT+WTT): ${reportData.overallReactionTime.toFixed(2)}초
  - S등급 기준: ${benchmark.S_time.toFixed(2)}s 이하
  - A등급 기준: ${benchmark.A_time.toFixed(2)}s
  - B등급 기준: ${benchmark.B_time.toFixed(2)}s
  - Fail(0점) 기준: ${benchmark.Fail_time.toFixed(2)}s
• 최고 반응 속도: ${reportData.bestReactionTime.toFixed(2)}초
• 종합 정확도: ${reportData.totalAccuracy.toFixed(1)}%
• 신체 반응 나이: ${reportData.biologicalAgeGroup}
• 처방: ${reportData.feedback}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleExportCSV = () => {
    const success = storageService.exportToCSV();
    if (success) {
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    }
  };

  React.useEffect(() => {
    if (!hasSavedRef.current && reportData) {
      hasSavedRef.current = true;
      const targetLevel_st4 = get_stage4_target_level(ageGroup);

      const saved = storageService.saveRecord({
        ageGroup: benchmark.name,
        ageSpan: benchmark.ageSpan,
        difficulty: diffOption.label,
        totalScore: reportData.speedScore,
        grade: reportData.grade,
        overallTRT: Number(reportData.overallReactionTime.toFixed(2)),
        bestReactionTime: Number(reportData.bestReactionTime.toFixed(2)),
        totalAccuracy: Number(reportData.totalAccuracy.toFixed(1)),
        biologicalAge: reportData.biologicalAgeGroup,
        stage1_name: reportData.stages.st1.name,
        stage1_reactionTime: Number(reportData.stages.st1.avg.toFixed(2)),
        stage1_score: reportData.stages.st1.score,
        stage2_name: reportData.stages.st2.name,
        stage2_score: reportData.stages.st2.score,
        stage3_name: reportData.stages.st3.name,
        stage3_reactionTime: Number(reportData.stages.st3.avg.toFixed(2)),
        stage3_score: reportData.stages.st3.score,
        stage4_name: reportData.stages.st4.name,
        stage4_reachedLevel: reportData.stages.st4.maxLevel,
        stage4_targetLevel: targetLevel_st4,
        stage4_score: reportData.stages.st4.score,
        stage5_name: reportData.stages.st5.name,
        stage5_reactionTime: Number(reportData.stages.st5.avg.toFixed(2)),
        stage5_score: reportData.stages.st5.score,
        radar_speed: reportData.scores.find(s => s.subject.includes('순발력'))?.value || 30,
        radar_power: reportData.scores.find(s => s.subject.includes('민첩성'))?.value || 30,
        radar_accuracy: reportData.scores.find(s => s.subject.includes('정확성'))?.value || 30,
        radar_memory: reportData.scores.find(s => s.subject.includes('기억력'))?.value || 30,
        radar_brain: reportData.scores.find(s => s.subject.includes('인지력'))?.value || 30,
        radar_stability: reportData.scores.find(s => s.subject.includes('안정성'))?.value || 30,
      });

      setSavedRecord(saved);
      setCumulativeCount(storageService.getRecordCount());
    }
  }, [reportData, benchmark, diffOption, ageGroup]);

  const gradeInfo = GRADE_DETAILS[reportData.grade];

  return (
    <div className="w-full max-w-4xl max-h-[94vh] md:max-h-[90vh] bg-slate-950/95 rounded-3xl border-2 border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar backdrop-blur-2xl animate-in zoom-in-95 duration-300">
      
      {/* Top Bar with Navigation Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-800 shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold orbitron bg-sky-500/10 text-sky-400 border border-sky-500/30">
              <Award size={12} /> {benchmark.label} 정밀 기준
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold orbitron border ${diffOption.badgeColor}`}>
              <Gauge size={11} /> {diffOption.label} 기준표
            </span>
            <span className="text-amber-300 font-bold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
              ✓ 2회차부터 정밀 측정 반영
            </span>
            <span className="text-emerald-300 font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              ✓ 점수 하한 30점 방어
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black orbitron italic text-white tracking-wide">
            REACTION PERFORMANCE REPORT
          </h2>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold orbitron transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 size={13} /> 종합 분석
          </button>
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold orbitron transition-all cursor-pointer ${
              activeTab === 'benchmarks'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TableProperties size={13} /> 정밀 기준표
          </button>
          <button
            onClick={() => setActiveTab('stages')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold orbitron transition-all cursor-pointer ${
              activeTab === 'stages'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={13} /> 단계별 상세
          </button>
        </div>
      </div>

      {/* Offline Storage Status Banner */}
      <div className="my-2 px-3.5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-bold orbitron shrink-0 shadow-inner">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
            <HardDrive size={18} />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-emerald-300 font-black">
                💾 오프라인 로컬 저장 완료 {savedRecord ? `(기록 #${savedRecord.id})` : ''}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-black">
                총 {cumulativeCount}명 누적
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              행사장 인터넷 없이도 브라우저에 안전 보관 중 • 언제든 엑셀 .csv로 다운로드 가능 (단축키: Ctrl+Shift+D)
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black rounded-lg text-xs orbitron active:scale-95 transition-all shadow-md cursor-pointer"
          title="지금까지 누적된 모든 참가자 데이터를 엑셀에서 열 수 있는 .csv 파일로 다운로드합니다"
        >
          {downloaded ? (
            <>
              <CheckCircle2 size={14} className="text-slate-950" />
              <span>다운로드 완료!</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>엑셀 CSV 다운로드</span>
            </>
          )}
        </button>
      </div>

      {/* Hero Grade Banner */}
      <div className="my-2.5 p-3 md:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/60 border border-slate-800 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Glowing Grade Badge */}
          <div className={`relative w-20 h-20 md:w-22 md:h-22 rounded-2xl flex flex-col items-center justify-center border-2 ${gradeInfo.border || 'border-sky-500'} ${gradeInfo.bg || 'bg-sky-500/10'} ${gradeInfo.glow || ''} shrink-0`}>
            <span className={`text-4xl md:text-5xl font-black orbitron italic ${gradeInfo.color || 'text-white'}`}>
              {reportData.grade}
            </span>
            <span className="text-[9px] font-black orbitron uppercase tracking-wider text-slate-400 -mt-1">
              {gradeInfo.title}
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 orbitron">전신 반응 점수</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${gradeInfo.badgeColor}`}>
                {gradeInfo.label} ({gradeInfo.range})
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-black orbitron text-white">
                {reportData.speedScore.toFixed(1)}
              </span>
              <span className="text-xs font-bold orbitron text-slate-500">/ 100점</span>
            </div>
            <p className="text-xs text-slate-300 font-medium line-clamp-2 max-w-md">
              {reportData.feedback}
            </p>
          </div>
        </div>

        {/* Quick Reaction Time & Age Target Pill */}
        <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <div className="text-left md:text-right">
            <span className="text-[9px] font-bold text-sky-400 orbitron uppercase block">측정 반응 시간 (CRT+WTT)</span>
            <span className="text-2xl md:text-3xl font-black orbitron text-sky-400">{reportData.overallReactionTime.toFixed(2)}s</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-slate-500 orbitron uppercase block">내 연령 S등급 기준</span>
            <span className="text-base font-bold orbitron text-yellow-400">≤ {benchmark.S_time.toFixed(2)}s</span>
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Reaction Time Spectrum Bar */}
          <div className="bg-slate-900/60 p-4 md:p-5 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold orbitron text-slate-400 flex items-center gap-1.5">
                <Activity size={14} className="text-sky-400" />
                반응 속도 스펙트럼 구간 (100점 만점 역산 선형 보간)
              </span>
              <span className="text-xs font-bold orbitron text-sky-400">
                내 기록: {reportData.overallReactionTime.toFixed(2)}초
              </span>
            </div>

            {/* Spectrum Bar */}
            <div className="relative w-full h-7 bg-slate-950 rounded-xl overflow-hidden p-1 border border-slate-800 flex">
              <div className="h-full bg-emerald-500/30 border-r border-emerald-500/40 relative flex items-center justify-center text-[10px] font-bold text-emerald-300" style={{ width: '30%' }}>
                S등급 (100~90)
              </div>
              <div className="h-full bg-sky-500/30 border-r border-sky-500/40 relative flex items-center justify-center text-[10px] font-bold text-sky-300" style={{ width: '25%' }}>
                A등급 (89~80)
              </div>
              <div className="h-full bg-amber-500/30 border-r border-amber-500/40 relative flex items-center justify-center text-[10px] font-bold text-amber-300" style={{ width: '25%' }}>
                B등급 (79~70)
              </div>
              <div className="h-full bg-rose-500/30 relative flex items-center justify-center text-[10px] font-bold text-rose-300" style={{ width: '20%' }}>
                C등급 (69이하)
              </div>

              {/* Marker pin */}
              <div 
                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_#fff] z-10 transition-all duration-500"
                style={{ 
                  left: `${Math.min(98, Math.max(2, 100 - reportData.speedScore))}%` 
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 shadow-[0_0_8px_#38bdf8]"></div>
              </div>
            </div>

            <div className="flex justify-between text-[10px] orbitron font-bold text-slate-500 mt-2 px-1">
              <span>최고(S): {benchmark.S_time.toFixed(2)}s</span>
              <span>우수(A): {benchmark.A_time.toFixed(2)}s</span>
              <span>평균(B): {benchmark.B_time.toFixed(2)}s</span>
              <span>한계(Fail): {benchmark.Fail_time.toFixed(2)}s</span>
            </div>
          </div>

          {/* Grid Layout: Radar Chart + Biological Age & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Hexagonal Radar Chart */}
            <div className="md:col-span-7 bg-slate-900/40 rounded-2xl border border-slate-800 p-3 min-h-[250px] flex flex-col justify-between relative">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-bold orbitron text-slate-400">6개 신체/인지 영역 다면 평가</span>
                <span className="text-[9px] font-bold orbitron text-sky-400">100점 환산 기준</span>
              </div>
              <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="72%" data={reportData.scores}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'Rajdhani' }} 
                    />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar 
                      name="Score" 
                      dataKey="value" 
                      stroke="#0ea5e9" 
                      strokeWidth={2} 
                      fill="#38bdf8" 
                      fillOpacity={0.5} 
                      isAnimationActive={false} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Column: Biological Age & Detailed Metrics */}
            <div className="md:col-span-5 flex flex-col gap-2.5">
              {/* Biological Reaction Age */}
              <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-yellow-400 mb-0.5">
                  <Sparkles size={14} />
                  <span className="text-[10px] font-bold orbitron uppercase tracking-wider">신체 반응 나이 판정</span>
                </div>
                <p className="text-lg font-black orbitron text-white leading-tight">
                  {reportData.biologicalAgeGroup}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-snug">
                  {reportData.ageDiffText}
                </p>
              </div>

              {/* Quick Metrics 4-grid */}
              <div className="grid grid-cols-2 gap-2 flex-grow">
                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-500 orbitron uppercase">최고 반응 속도</span>
                  <span className="text-lg font-black orbitron text-emerald-400 mt-0.5">
                    {reportData.bestReactionTime.toFixed(2)}s
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">Best Record</span>
                </div>

                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-500 orbitron uppercase">종합 정확도</span>
                  <span className="text-lg font-black orbitron text-sky-400 mt-0.5">
                    {reportData.totalAccuracy.toFixed(0)}%
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">오타 없는 스텝</span>
                </div>

                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-500 orbitron uppercase">반응 시간 편차</span>
                  <span className="text-lg font-black orbitron text-amber-400 mt-0.5">
                    ±{(reportData.timeGap / 2).toFixed(2)}s
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">스텝 리듬 안정도</span>
                </div>

                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-500 orbitron uppercase">기억 도달 레벨</span>
                  <span className="text-lg font-black orbitron text-purple-400 mt-0.5">
                    Lv.{reportData.stages.st4.maxLevel}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold">순차 작업 기억</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRECISION BENCHMARKS TABLE */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Header Description */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-sky-400">
              <Info size={18} />
              <h4 className="text-sm font-black orbitron uppercase">
                전신 반응(인지+스텝) 연령대별 정밀 기준표
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              스포츠 의학의 <strong className="text-white">'선택 반응 시간(Choice Reaction Time)'</strong>과 <strong className="text-white">'체중 이동 속도(Weight Transfer Time)'</strong>를 결합하여 검증한 정밀 기준입니다.
              중앙 발판에서 타겟 발판까지 가볍게 한 발자국(약 40~50cm) 이동하여 체중을 싣는 것을 전제로 설계되었습니다.
            </p>
          </div>

          {/* Full Precision Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold orbitron text-[11px] md:text-xs">
                    <th className="py-3 px-4">연령 그룹</th>
                    <th className="py-3 px-3 text-amber-400">S등급 (100~90점)<br/><span className="text-[10px] font-normal text-slate-400">매우 빠름</span></th>
                    <th className="py-3 px-3 text-emerald-400">A등급 (89~80점)<br/><span className="text-[10px] font-normal text-slate-400">우수</span></th>
                    <th className="py-3 px-3 text-sky-400">B등급 (79~70점)<br/><span className="text-[10px] font-normal text-slate-400">평균 / 정상</span></th>
                    <th className="py-3 px-3 text-rose-400">C등급 (69점 이하)<br/><span className="text-[10px] font-normal text-slate-400">노력 필요</span></th>
                    <th className="py-3 px-4 text-center">판정 가이드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {[
                    AgeGroup.TODDLER,
                    AgeGroup.CHILD,
                    AgeGroup.YOUTH,
                    AgeGroup.MIDDLE,
                    AgeGroup.SENIOR,
                    AgeGroup.ELDERLY
                  ].map((groupKey) => {
                    const row = AGE_BENCHMARKS[groupKey];
                    const isSelected = groupKey === ageGroup;
                    return (
                      <tr 
                        key={groupKey} 
                        className={`transition-colors ${
                          isSelected 
                            ? 'bg-sky-500/15 border-y-2 border-sky-500 shadow-[inset_0_0_15px_rgba(14,165,233,0.15)] font-bold' 
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }}></span>
                          <span>{row.name}</span>
                          <span className="text-[11px] text-slate-400">({row.ageSpan})</span>
                          {isSelected && (
                            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 font-black orbitron uppercase">
                              내 그룹
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-amber-300 font-bold orbitron">
                          {row.S_time.toFixed(2)}초 이하
                        </td>
                        <td className="py-3.5 px-3 text-emerald-300 font-bold orbitron">
                          {row.A_time.toFixed(2)}초
                        </td>
                        <td className="py-3.5 px-3 text-sky-300 font-bold orbitron">
                          {row.B_time.toFixed(2)}초
                        </td>
                        <td className="py-3.5 px-3 text-rose-300 font-bold orbitron">
                          {row.C_time.toFixed(2)}초 이상
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold orbitron text-sky-300 bg-sky-950/80 px-2.5 py-1 rounded-lg border border-sky-500/40">
                              <CheckCircle2 size={12} /> {reportData.overallReactionTime.toFixed(2)}s ({reportData.grade}등급)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 orbitron">
                              C기준 {row.C_time.toFixed(2)}s
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scoring Formula Transparency Box */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-bold orbitron">
              <Zap size={14} className="text-yellow-400" />
              정밀 점수 산출 공식 (100점 만점 역산 선형 보간)
            </div>
            <p className="font-mono text-[11px] text-sky-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 overflow-x-auto">
              ratio = (측정시간 - 100점기준_S) / (0점기준_Fail - 100점기준_S)<br/>
              score = 100 - (ratio * 100)  [clamp 0.0 ~ 100.0]
            </p>
            <p className="text-[11px] text-slate-400">
              * 연령별 S등급 시간보다 빠르면 100점, Fail 시간보다 느리면 0점이 부여되며, 사이 구간은 밀리초 단위로 역산 환산됩니다.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: STAGES BREAKDOWN */}
      {activeTab === 'stages' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stage 1 */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-sky-400 orbitron">STAGE 01</span>
                  <span className="text-xs font-bold orbitron text-white bg-slate-800 px-2 py-0.5 rounded-md">
                    점수: {reportData.stages.st1.score.toFixed(1)}점
                  </span>
                </div>
                <h4 className="text-lg font-bold orbitron text-white flex items-center gap-2">
                  🥫 {reportData.stages.st1.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  단순 스텝 순발력 (중앙에서 타겟까지 한 발자국 이동)
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-bold">평균 반응 시간</span>
                <span className="text-2xl font-black orbitron text-sky-400">
                  {reportData.stages.st1.avg.toFixed(2)}s
                </span>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-sky-400 orbitron">STAGE 02</span>
                  <span className="text-xs font-bold orbitron text-white bg-slate-800 px-2 py-0.5 rounded-md">
                    점수: {reportData.stages.st2.score.toFixed(0)}점
                  </span>
                </div>
                <h4 className="text-lg font-bold orbitron text-white flex items-center gap-2">
                  🔥 {reportData.stages.st2.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  연속 타격 민첩성 및 체중 이동 파워
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-bold">진압 성공 횟수</span>
                <span className="text-2xl font-black orbitron text-emerald-400">
                  {reportData.stages.st2.count}회
                </span>
              </div>
            </div>

            {/* Stage 3 */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-sky-400 orbitron">STAGE 03</span>
                  <span className="text-xs font-bold orbitron text-white bg-slate-800 px-2 py-0.5 rounded-md">
                    점수: {reportData.stages.st3.score.toFixed(1)}점
                  </span>
                </div>
                <h4 className="text-lg font-bold orbitron text-white flex items-center gap-2">
                  🎯 {reportData.stages.st3.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  시각 색상 식별 및 방향 선택 반응 속도
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-bold">평균 반응 시간</span>
                <span className="text-2xl font-black orbitron text-yellow-400">
                  {reportData.stages.st3.avg.toFixed(2)}s
                </span>
              </div>
            </div>

            {/* Stage 4 */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-sky-400 orbitron">STAGE 04</span>
                  <span className="text-xs font-bold orbitron text-white bg-slate-800 px-2 py-0.5 rounded-md">
                    점수: {reportData.stages.st4.score.toFixed(0)}점
                  </span>
                </div>
                <h4 className="text-lg font-bold orbitron text-white flex items-center gap-2">
                  🧠 {reportData.stages.st4.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  순차 공간 기억력 및 경로 연속 이동
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-bold">최대 성공 시퀀스</span>
                <span className="text-2xl font-black orbitron text-purple-400">
                  Lv.{reportData.stages.st4.maxLevel}
                </span>
              </div>
            </div>

            {/* Stage 5 */}
            <div className="md:col-span-2 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-sky-400 orbitron">STAGE 05 (FINAL)</span>
                  <span className="text-xs font-bold orbitron text-white bg-slate-800 px-2 py-0.5 rounded-md">
                    점수: {reportData.stages.st5.score.toFixed(1)}점
                  </span>
                </div>
                <h4 className="text-lg font-bold orbitron text-white flex items-center gap-2">
                  ⚡ {reportData.stages.st5.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  스트룹 효과(Stroop Effect) 억제 제어 인지력 및 뇌-신체 전환 순발력
                </p>
              </div>
              <div className="text-left md:text-right shrink-0">
                <span className="text-xs text-slate-500 font-bold block">간섭 인지 반응 시간</span>
                <span className="text-2xl font-black orbitron text-rose-400">
                  {reportData.stages.st5.avg.toFixed(2)}s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap gap-2.5 shrink-0">
        <button 
          onClick={onReset} 
          className="flex-grow flex items-center justify-center gap-2 bg-white text-slate-950 py-2.5 px-5 rounded-xl font-black text-sm md:text-base orbitron hover:bg-sky-400 hover:text-white transition-all active:scale-95 shadow-lg cursor-pointer"
        >
          <RotateCcw size={18} /> 훈련 다시 시작 (LOBBY)
        </button>

        {onChangeAge && (
          <button 
            onClick={onChangeAge}
            className="flex items-center justify-center gap-1.5 bg-slate-900 text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm orbitron border border-slate-700 hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
          >
            <User size={16} className="text-sky-400" /> 연령 변경
          </button>
        )}

        <button 
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm orbitron border border-emerald-500 hover:border-emerald-400 transition-all active:scale-95 cursor-pointer shadow-md"
          title="모든 참가자 데이터를 엑셀 .csv로 다운로드합니다"
        >
          {downloaded ? (
            <>
              <CheckCircle2 size={16} className="text-white" />
              <span className="font-bold">다운로드 완료!</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>CSV 다운로드 ({cumulativeCount}명)</span>
            </>
          )}
        </button>

        <button 
          onClick={handleCopyReport}
          className="flex items-center justify-center gap-1.5 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm orbitron border border-slate-700 hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={16} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold">복사 완료!</span>
            </>
          ) : (
            <>
              <Share2 size={16} />
              <span>리포트 공유/복사</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
