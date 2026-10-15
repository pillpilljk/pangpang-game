/**
 * 오프라인 참가자 데이터 저장 및 CSV 내보내기 서비스
 * - 행사장 인터넷 두절 상황을 완벽 대비하여 브라우저 localStorage에 기록 누적
 * - 엑셀(Excel)에서 한글 깨짐 없이 열 수 있도록 UTF-8 BOM(\uFEFF) 인코딩 CSV 파일 생성
 */

export interface ParticipantRecord {
  id: number;
  savedAt: string; // "YYYY-MM-DD HH:mm:ss"
  ageGroup: string; // "유아", "초등", "청년" 등
  ageSpan: string; // "7~12세" 등
  difficulty: string; // "보통 (표준)" 등
  totalScore: number; // 최종 종합 점수 (30~100점)
  grade: string; // "S", "A", "B", "C"
  overallTRT: number; // 전신 반응시간 (초)
  bestReactionTime: number; // 최고 반응속도 (초)
  totalAccuracy: number; // 종합 정확도 (%)
  biologicalAge: string; // 신체 반응 나이

  // 단계별 상세 기록
  stage1_name: string;
  stage1_reactionTime: number;
  stage1_score: number;

  stage2_name: string;
  stage2_score: number; // 파워 점수

  stage3_name: string;
  stage3_reactionTime: number;
  stage3_score: number;

  stage4_name: string;
  stage4_reachedLevel: number;
  stage4_targetLevel: number;
  stage4_score: number;

  stage5_name: string;
  stage5_reactionTime: number;
  stage5_score: number;

  // 6각 육각형 역량 지표
  radar_speed: number;
  radar_power: number;
  radar_accuracy: number;
  radar_memory: number;
  radar_brain: number;
  radar_stability: number;
}

const STORAGE_KEY = 'pangpang_board_offline_records_v1';

export const storageService = {
  /**
   * localStorage에 저장된 모든 참가자 기록 조회
   */
  getRecords(): ParticipantRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load participant records from localStorage', e);
      return [];
    }
  },

  /**
   * 새로운 참가자 최종 결과 누적 저장
   */
  saveRecord(recordData: Omit<ParticipantRecord, 'id' | 'savedAt'>): ParticipantRecord {
    const records = this.getRecords();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const savedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    const newRecord: ParticipantRecord = {
      ...recordData,
      id: records.length + 1,
      savedAt,
    };

    records.push(newRecord);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save record to localStorage', e);
    }

    return newRecord;
  },

  /**
   * 누적 참가자 수 반환
   */
  getRecordCount(): number {
    return this.getRecords().length;
  },

  /**
   * 모든 누적 기록 초기화 (관리자 전용)
   */
  clearRecords(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear records', e);
    }
  },

  /**
   * 누적된 모든 참가자 데이터를 엑셀에서 열 수 있는 .csv 파일로 한 번에 다운로드
   * - UTF-8 BOM(\uFEFF)을 선두에 추가하여 한글 깨짐 완전 방지
   */
  exportToCSV(): boolean {
    const records = this.getRecords();
    if (records.length === 0) {
      alert('저장된 참가자 데이터가 없습니다.');
      return false;
    }

    const headers = [
      '참가번호',
      '기록일시',
      '연령대',
      '연령구분',
      '난이도기준',
      '최종총점',
      '최종등급',
      '전신반응시간(초)',
      '최고반응속도(초)',
      '종합정확도(%)',
      '신체반응나이',
      '1단계(캔)_평균반응(초)',
      '1단계_점수',
      '2단계(화재)_파워점수',
      '3단계(색상)_평균반응(초)',
      '3단계_점수',
      '4단계(기억력)_도달레벨',
      '4단계_목표레벨',
      '4단계_점수',
      '5단계(인지갈등)_평균반응(초)',
      '5단계_점수',
      '순발력_지표',
      '파워민첩_지표',
      '정확도_지표',
      '기억력_지표',
      '인지력_지표',
      '안정성_지표',
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map((r) => [
      r.id,
      r.savedAt,
      r.ageGroup,
      r.ageSpan,
      r.difficulty,
      r.totalScore,
      r.grade,
      r.overallTRT,
      r.bestReactionTime,
      r.totalAccuracy,
      r.biologicalAge,
      r.stage1_reactionTime,
      r.stage1_score,
      r.stage2_score,
      r.stage3_reactionTime,
      r.stage3_score,
      r.stage4_reachedLevel,
      r.stage4_targetLevel,
      r.stage4_score,
      r.stage5_reactionTime,
      r.stage5_score,
      r.radar_speed,
      r.radar_power,
      r.radar_accuracy,
      r.radar_memory,
      r.radar_brain,
      r.radar_stability,
    ]);

    const csvContent =
      '\uFEFF' + // UTF-8 BOM for MS Excel
      [headers.map(escapeCSV).join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    link.setAttribute('href', url);
    link.setAttribute('download', `팡팡보드_참가자기록_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  },
};
