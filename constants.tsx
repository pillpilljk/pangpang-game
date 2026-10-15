import React from 'react';
import { StageId, GameSettings, AgeGroup, BenchmarkDifficulty } from './types';

export const BITMAPS = {
  DATA1: {
    LEFT: 0x80,   // Grid 4
    DOWN: 0x40,   // Grid 8
    UP: 0x08,     // Grid 2
    CENTER: 0x01, // Grid 5
  },
  DATA2: {
    RD: 0x80,     // Grid 9
    SELECT: 0x40, // A
    START: 0x20,  // B
    LD: 0x10,     // Grid 7
    RU: 0x08,     // Grid 3
    LU: 0x04,     // Grid 1
    RIGHT: 0x02,  // Grid 6
  }
};

export const GRID_MAP: Record<number, { byte: 1 | 2, mask: number }> = {
  1: { byte: 2, mask: BITMAPS.DATA2.LU },
  2: { byte: 1, mask: BITMAPS.DATA1.UP },
  3: { byte: 2, mask: BITMAPS.DATA2.RU },
  4: { byte: 1, mask: BITMAPS.DATA1.LEFT },
  5: { byte: 1, mask: BITMAPS.DATA1.CENTER },
  6: { byte: 2, mask: BITMAPS.DATA2.RIGHT },
  7: { byte: 2, mask: BITMAPS.DATA2.LD },
  8: { byte: 1, mask: BITMAPS.DATA1.DOWN },
  9: { byte: 2, mask: BITMAPS.DATA2.RD },
};

export interface AgeBenchmark {
  name: string;
  ageSpan: string;
  label: string;
  S_time: number;
  A_time: number;
  B_time: number;
  C_time: number;
  Fail_time: number;
  avg: number;
  best: number;
  pad: number;
  color: string;
}

/**
/**
 * 1. 기본 연령대별 정밀 기준표 (스포츠 의학 선택 반응시간 + 40~50cm 전신 스텝 체중이동 결합)
 * - 유저 피드백 반영: 실제 발판 스텝 동작에 맞춰 기존보다 약간 더 쉽게 완화 조정됨
 */
export const BASE_AGE_BENCHMARKS: Record<string, AgeBenchmark> = {
  [AgeGroup.TODDLER]: {
    name: "유아",
    ageSpan: "4~6세",
    label: "유아 (4~6세)",
    S_time: 1.05,
    A_time: 1.25,
    B_time: 1.50,
    C_time: 1.85,
    Fail_time: 3.80,
    avg: 1.50,
    best: 1.05,
    pad: 1,
    color: '#f87171'
  },
  [AgeGroup.CHILD]: {
    name: "초등",
    ageSpan: "7~12세",
    label: "초등 (7~12세)",
    S_time: 0.75,
    A_time: 0.92,
    B_time: 1.12,
    C_time: 1.40,
    Fail_time: 3.20,
    avg: 1.12,
    best: 0.75,
    pad: 2,
    color: '#fbbf24'
  },
  [AgeGroup.YOUTH]: {
    name: "청년",
    ageSpan: "13~39세",
    label: "청년 (13~39세)",
    S_time: 0.55,
    A_time: 0.70,
    B_time: 0.88,
    C_time: 1.15,
    Fail_time: 2.80,
    avg: 0.88,
    best: 0.55,
    pad: 3,
    color: '#34d399'
  },
  [AgeGroup.MIDDLE]: {
    name: "중년",
    ageSpan: "40~59세",
    label: "중년 (40~59세)",
    S_time: 0.65,
    A_time: 0.80,
    B_time: 1.00,
    C_time: 1.30,
    Fail_time: 3.00,
    avg: 1.00,
    best: 0.65,
    pad: 4,
    color: '#60a5fa'
  },
  [AgeGroup.SENIOR]: {
    name: "준고령",
    ageSpan: "60~69세",
    label: "준고령 (60~69세)",
    S_time: 0.82,
    A_time: 1.02,
    B_time: 1.25,
    C_time: 1.55,
    Fail_time: 3.50,
    avg: 1.25,
    best: 0.82,
    pad: 6,
    color: '#a78bfa'
  },
  [AgeGroup.ELDERLY]: {
    name: "고령",
    ageSpan: "70세 이상",
    label: "고령 (70세 이상)",
    S_time: 1.20,
    A_time: 1.45,
    B_time: 1.80,
    C_time: 2.30,
    Fail_time: 4.50,
    avg: 1.80,
    best: 1.20,
    pad: 7,
    color: '#f472b6'
  }
};

BASE_AGE_BENCHMARKS['ADULT'] = BASE_AGE_BENCHMARKS[AgeGroup.YOUTH];

// 기본 호환용 참조
export const AGE_BENCHMARKS = BASE_AGE_BENCHMARKS;

/**
 * 2. 난이도별 배율 및 설정 (쉽게 ~ 어렵게 5단계)
 * - multiplier: 기준 시간에 곱해짐 (1.0 초과면 기준 시간이 늘어나 쉬워짐, 1.0 미만이면 짧아져 어려워짐)
 */
export interface DifficultyOption {
  id: BenchmarkDifficulty;
  label: string;
  shortLabel: string;
  multiplier: number;
  description: string;
  badgeColor: string;
  glowColor: string;
}

export const DIFFICULTY_CONFIG: Record<BenchmarkDifficulty, DifficultyOption> = {
  [BenchmarkDifficulty.VERY_EASY]: {
    id: BenchmarkDifficulty.VERY_EASY,
    label: '아주 쉬움',
    shortLabel: '초급/시니어',
    multiplier: 1.35,
    description: '입문자, 어르신 및 재활을 위한 가장 여유로운 기준 (시간 +35%)',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    glowColor: 'rgba(16,185,129,0.3)'
  },
  [BenchmarkDifficulty.EASY]: {
    id: BenchmarkDifficulty.EASY,
    label: '쉬움',
    shortLabel: '초급',
    multiplier: 1.18,
    description: '초보자 및 가벼운 신체 활동을 위한 편안한 기준 (시간 +18%)',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    glowColor: 'rgba(20,184,166,0.3)'
  },
  [BenchmarkDifficulty.NORMAL]: {
    id: BenchmarkDifficulty.NORMAL,
    label: '보통 (표준)',
    shortLabel: '표준',
    multiplier: 1.00,
    description: '표준 전신 반응 측정을 위한 기본 권장 기준 (약간 쉽게 완화됨)',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    glowColor: 'rgba(14,165,233,0.3)'
  },
  [BenchmarkDifficulty.HARD]: {
    id: BenchmarkDifficulty.HARD,
    label: '어려움',
    shortLabel: '숙련',
    multiplier: 0.88,
    description: '스포츠 동호인 및 민첩성 훈련을 위한 도전적 기준 (시간 -12%)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    glowColor: 'rgba(245,158,11,0.3)'
  },
  [BenchmarkDifficulty.PRO]: {
    id: BenchmarkDifficulty.PRO,
    label: '마스터 (프로)',
    shortLabel: '프로',
    multiplier: 0.78,
    description: '엘리트 체육인 및 극강의 순발력을 요구하는 프로 기준 (시간 -22%)',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    glowColor: 'rgba(244,63,94,0.3)'
  }
};

/**
 * 난이도에 따른 동적 기준표 반환 함수
 */
export function get_scaled_benchmark(
  age_group: string, 
  difficulty: BenchmarkDifficulty = BenchmarkDifficulty.NORMAL
): AgeBenchmark {
  const base = BASE_AGE_BENCHMARKS[age_group] || BASE_AGE_BENCHMARKS[AgeGroup.YOUTH];
  const mult = DIFFICULTY_CONFIG[difficulty]?.multiplier || 1.0;

  return {
    ...base,
    S_time: Number((base.S_time * mult).toFixed(2)),
    A_time: Number((base.A_time * mult).toFixed(2)),
    B_time: Number((base.B_time * mult).toFixed(2)),
    C_time: Number((base.C_time * mult).toFixed(2)),
    Fail_time: Number((base.Fail_time * mult).toFixed(2)),
    avg: Number((base.avg * mult).toFixed(2)),
    best: Number((base.best * mult).toFixed(2)),
  };
}

/**
 * 3. 점수 환산 함수 (100점 만점)
 * - 설정된 난이도(쉽게 ~ 어렵게) 및 각 연령대별 기준표에 따라 정밀 역산
 * - 3단계(시각 색상 탐색) 및 5단계(스트룹 인지 갈등)의 인지 지연 오프셋 반영
 */
export function calculate_speed_score(
  measured_time: number, 
  age_group: string,
  stageId?: StageId,
  difficulty: BenchmarkDifficulty = BenchmarkDifficulty.NORMAL
): number {
  // 난이도에 따른 동적 기준값 가져오기
  const benchmark = get_scaled_benchmark(age_group, difficulty);

  // 3단계(8방향 색상 시각 탐색) 및 5단계(스트룹 간섭 제어)에 대한 인지 과제 복잡도 보정
  let cognitiveOffset = 0;
  if (stageId === StageId.COLOR_REFLEX) cognitiveOffset = 0.25;
  if (stageId === StageId.MIND_CRASH) cognitiveOffset = 0.45;

  const adjTime = Math.max(0.15, measured_time - cognitiveOffset);
  const s_time = benchmark.S_time;
  const a_time = benchmark.A_time;
  const b_time = benchmark.B_time;
  const c_time = benchmark.C_time;
  const max_fail = benchmark.Fail_time;

  let score: number;

  if (adjTime <= s_time) {
    // S등급 (100~90점)
    const ratio = Math.max(0, (s_time - adjTime) / s_time);
    score = Math.min(100.0, 90.0 + ratio * 10.0);
  } else if (adjTime <= a_time) {
    // A등급 (89.9~80.0점)
    const ratio = (adjTime - s_time) / (a_time - s_time);
    score = 90.0 - ratio * 10.0;
  } else if (adjTime <= b_time) {
    // B등급 (79.9~70.0점)
    const ratio = (adjTime - a_time) / (b_time - a_time);
    score = 80.0 - ratio * 10.0;
  } else if (adjTime <= c_time) {
    // C등급 진입 (69.9~60.0점)
    const ratio = (adjTime - b_time) / (c_time - b_time);
    score = 70.0 - ratio * 10.0;
  } else {
    // C등급 노력 필요 (59.9~30.0점): 미션을 성공한 유저에게 정상 점진적 감점 부여
    const ratio = Math.min(1.0, (adjTime - c_time) / Math.max(0.1, max_fail - c_time));
    score = Math.max(30.0, 60.0 - ratio * 30.0);
  }

  return Number(score.toFixed(1));
}

export function get_grade(score: number): "S" | "A" | "B" | "C" {
  if (score >= 90) return "S";
  else if (score >= 80) return "A";
  else if (score >= 70) return "B";
  else return "C";
}

export const GRADE_DETAILS = {
  S: { label: "S등급", title: "매우 빠름", range: "100~90점", badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  A: { label: "A등급", title: "우수", range: "89~80점", badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  B: { label: "B등급", title: "평균/정상", range: "79~70점", badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40" },
  C: { label: "C등급", title: "노력 필요", range: "69점 이하", badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
};

export const DEFAULT_SETTINGS: Record<StageId, GameSettings> = {
  [StageId.CAN_CRUSH]: { targetCount: 10, timeLimit: 60, passScore: 8, penaltyTime: 1, instructionDuration: 5 },
  [StageId.EXTINGUISH_FIRE]: { targetCount: 10, timeLimit: 60, passScore: 8, penaltyTime: 2, instructionDuration: 5 },
  [StageId.COLOR_REFLEX]: { targetCount: 10, timeLimit: 60, passScore: 8, penaltyTime: 1.5, instructionDuration: 5 },
  [StageId.MEMORY_SEQUENCE]: { targetCount: 5, timeLimit: 90, passScore: 5, penaltyTime: 2, instructionDuration: 5 },
  [StageId.MIND_CRASH]: { targetCount: 12, timeLimit: 60, passScore: 10, penaltyTime: 3, instructionDuration: 5 },
};

export const STAGE_TITLES: Record<StageId, string> = {
  [StageId.CAN_CRUSH]: '1단계: 캔 밟기 (CAN CRUSH)',
  [StageId.EXTINGUISH_FIRE]: '2단계: 화재 진압 (FIRE FIGHTER)',
  [StageId.COLOR_REFLEX]: '3단계: 색상 반응 (COLOR REFLEX)',
  [StageId.MEMORY_SEQUENCE]: '4단계: 순서 기억 (SEQUENCE MEMORY)',
  [StageId.MIND_CRASH]: '5단계: 인지 갈등 (MIND CRASH)',
};

export const STAGE_KEY_PHRASES: Record<StageId, string> = {
  [StageId.CAN_CRUSH]: "발밑에 캔이 나타나면 번개처럼 신속하게 밟으세요!",
  [StageId.EXTINGUISH_FIRE]: "불꽃이 난 발판을 빠르게 2회 연속 밟아 진화하세요!",
  [StageId.COLOR_REFLEX]: "제시된 목표 색상과 똑같은 색의 발판을 찾아 밟으세요!",
  [StageId.MEMORY_SEQUENCE]: "노란색으로 반짝이는 순서를 외우고 차례대로 밟으세요!",
  [StageId.MIND_CRASH]: "글자 뜻에 속지 말고, 글씨에 칠해진 '실제 색상'을 밟으세요!",
};

export const STAGE_DESCRIPTIONS: Record<StageId, string> = {
  [StageId.CAN_CRUSH]: "8개 발판 중 무작위로 나타나는 빈 캔을 가장 빠른 반응속도로 찌그러트리는 기본 순발력 및 체중이동 테스트입니다.",
  [StageId.EXTINGUISH_FIRE]: "불꽃이 발생한 발판을 연속으로 2회 힘차게 밟아야 불이 꺼집니다. 민첩성과 파워 스텝 순발력을 측정합니다.",
  [StageId.COLOR_REFLEX]: "화면 상단과 좌측에 제시되는 목표 색상을 확인하고, 8방향 발판 중 동일한 색상의 발판을 시각적으로 변별하여 밟는 테스트입니다.",
  [StageId.MEMORY_SEQUENCE]: "발판에 점등되는 시각 패턴 순서(2~4단계)를 작업기억에 저장한 후, 신호음에 맞춰 정확한 순서대로 연속 이동하는 인지 기억 테스트입니다.",
  [StageId.MIND_CRASH]: "두뇌 스트룹(Stroop) 인지 억제 테스트입니다. '빨강'이라는 단어가 파란색 글씨로 적혀있다면 글자 뜻이 아닌 [파란색] 발판을 밟아야 합니다!",
};

export const COLORS = [
  { name: '빨강', hex: '#ef4444', symbol: '▲' },
  { clientName: 'White', name: '흰색', hex: '#ffffff', symbol: '■' },
  { name: '주황', hex: '#f97316', symbol: '★' },
  { name: '노랑', hex: '#eab308', symbol: '●' },
  { name: '초록', hex: '#22c55e', symbol: '◆' },
  { name: '파랑', hex: '#3b82f6', symbol: '▼' },
  { name: '보라', hex: '#a855f7', symbol: '✚' },
  { name: '검정', hex: '#111111', symbol: '✖', contrast: '#ffffff' },
];
