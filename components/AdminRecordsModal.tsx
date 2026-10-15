import React, { useState, useEffect } from 'react';
import { Download, Trash2, X, Users, CheckCircle2, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { storageService, ParticipantRecord } from '../services/storageService';

interface AdminRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminRecordsModal: React.FC<AdminRecordsModalProps> = ({ isOpen, onClose }) => {
  const [records, setRecords] = useState<ParticipantRecord[]>([]);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRecords(storageService.getRecords());
      setDownloadSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const success = storageService.exportToCSV();
    if (success) {
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    }
  };

  const handleClear = () => {
    if (records.length === 0) return;
    const ok = window.confirm(
      `⚠️ 경고: 현재 저장된 ${records.length}명의 모든 참가자 기록이 영구 삭제됩니다.\n정말 초기화하시겠습니까? (먼저 CSV 다운로드를 권장합니다)`
    );
    if (ok) {
      storageService.clearRecords();
      setRecords([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border-2 border-sky-500/50 rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black orbitron text-white">행사 오프라인 참가자 데이터 관리자</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold orbitron">
                  단축키: Ctrl+Shift+D
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold orbitron mt-0.5">
                인터넷이 없어도 브라우저 localStorage에 안전하게 자동 누적됩니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-800/40 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-300">
              <Users size={16} className="text-sky-400" />
              <span>현재 누적 참가자:</span>
              <span className="text-lg font-black text-amber-400 orbitron">{records.length}명</span>
            </div>
            {downloadSuccess && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 animate-in fade-in">
                <CheckCircle2 size={14} /> 엑셀 CSV 파일 다운로드 완료!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Trash2 size={13} /> 기록 초기화
            </button>
            <button
              onClick={handleDownload}
              disabled={records.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs md:text-sm font-black orbitron rounded-xl text-slate-950 bg-gradient-to-r from-emerald-400 to-sky-400 hover:from-emerald-300 hover:to-sky-300 shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Download size={15} /> 엑셀 CSV 다운로드 (.csv)
            </button>
          </div>
        </div>

        {/* Content: Preview Table */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-4 rounded-full bg-slate-800 text-slate-500">
                <Users size={36} />
              </div>
              <p className="text-base font-bold text-slate-400 orbitron">아직 누적된 참가자 기록이 없습니다</p>
              <p className="text-xs text-slate-500 max-w-sm">
                게임이 5단계까지 완료되어 최종 리포트 화면에 도달할 때마다 자동으로 참가자의 모든 데이터가 이곳에 누적 저장됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>최근 기록 (최대 최신순 정렬)</span>
                <span>총 {records.length}건 저장됨</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/70 border-b border-slate-700 text-slate-400 font-bold orbitron">
                      <th className="p-2.5 text-center">번호</th>
                      <th className="p-2.5">저장 일시</th>
                      <th className="p-2.5">연령대</th>
                      <th className="p-2.5">난이도</th>
                      <th className="p-2.5 text-center">총점</th>
                      <th className="p-2.5 text-center">등급</th>
                      <th className="p-2.5 text-center">전신반응(초)</th>
                      <th className="p-2.5 text-center">정확도</th>
                      <th className="p-2.5 text-center">1단계</th>
                      <th className="p-2.5 text-center">2단계</th>
                      <th className="p-2.5 text-center">3단계</th>
                      <th className="p-2.5 text-center">4단계</th>
                      <th className="p-2.5 text-center">5단계</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {[...records].reverse().map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 text-center font-bold text-slate-400 orbitron">#{r.id}</td>
                        <td className="p-2.5 text-slate-300 whitespace-nowrap">{r.savedAt}</td>
                        <td className="p-2.5 font-bold text-sky-400 whitespace-nowrap">{r.ageGroup}</td>
                        <td className="p-2.5 text-slate-400 whitespace-nowrap">{r.difficulty}</td>
                        <td className="p-2.5 text-center font-black text-amber-400 orbitron">{r.totalScore}점</td>
                        <td className="p-2.5 text-center font-black text-white orbitron">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.grade === 'S'
                                ? 'bg-amber-500/20 text-amber-300'
                                : r.grade === 'A'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : r.grade === 'B'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {r.grade}
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-slate-300 orbitron">{r.overallTRT}s</td>
                        <td className="p-2.5 text-center text-slate-300 orbitron">{r.totalAccuracy}%</td>
                        <td className="p-2.5 text-center text-slate-400 orbitron">{r.stage1_score}점</td>
                        <td className="p-2.5 text-center text-slate-400 orbitron">{r.stage2_score}점</td>
                        <td className="p-2.5 text-center text-slate-400 orbitron">{r.stage3_score}점</td>
                        <td className="p-2.5 text-center text-slate-400 orbitron">
                          Lv.{r.stage4_reachedLevel} ({r.stage4_score}점)
                        </td>
                        <td className="p-2.5 text-center text-slate-400 orbitron">{r.stage5_score}점</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-400" />
            <span>엑셀(Excel)에서 한글 깨짐 없이 바로 열립니다 (UTF-8 BOM 탑재)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
