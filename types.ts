
export enum GameState {
  AGE_SELECTION = 'AGE_SELECTION',
  LOBBY = 'LOBBY',
  ADMIN = 'ADMIN',
  PREVIEW = 'PREVIEW',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  STAGE_CLEAR = 'STAGE_CLEAR',
  GAMEOVER = 'GAMEOVER',
  REPORT = 'REPORT'
}

export enum AgeGroup {
  TODDLER = 'TODDLER',
  CHILD = 'CHILD',
  YOUTH = 'YOUTH',
  MIDDLE = 'MIDDLE',
  SENIOR = 'SENIOR',
  ELDERLY = 'ELDERLY'
}

export enum BenchmarkDifficulty {
  VERY_EASY = 'VERY_EASY',
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  PRO = 'PRO'
}

export enum StageId {
  CAN_CRUSH = 1,
  EXTINGUISH_FIRE = 2,
  COLOR_REFLEX = 3,
  MEMORY_SEQUENCE = 4,
  MIND_CRASH = 5
}

export interface GameSettings {
  targetCount: number;
  timeLimit: number;
  passScore: number;
  penaltyTime: number;
  instructionDuration: number;
}

export interface StepRecord {
  stageId: StageId;
  reactionTime: number;
  success: boolean;
  timestamp: number;
  targetPad?: number;
  isWarmup?: boolean;
}

export interface BoardInput {
  1: boolean; 2: boolean; 3: boolean;
  4: boolean; 5: boolean; 6: boolean;
  7: boolean; 8: boolean; 9: boolean;
  SELECT: boolean;
  START: boolean;
}
