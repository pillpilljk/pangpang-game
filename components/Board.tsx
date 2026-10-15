
import React from 'react';
import { BoardInput } from '../types';

interface Props {
  inputs: BoardInput;
  targets: number[];
  onManualClick?: (key: number) => void;
  targetContent?: Record<number, React.ReactNode>;
  splashes?: Record<number, boolean>;
  highlighted?: number | null;
}

export const Board: React.FC<Props> = ({ 
  inputs, 
  targets, 
  onManualClick, 
  targetContent, 
  splashes = {},
  highlighted = null
}) => {
  const renderCell = (idx: number) => {
    // 가운데 중앙 발판 (5번): 유저가 기본으로 서 있는 대기 공간
    if (idx === 5) {
      const isStandingOnCenter = inputs[5];
      return (
        <div 
          key={5}
          className={`
            relative flex flex-col items-center justify-center w-full h-full rounded-2xl border-2 overflow-hidden select-none pointer-events-none transition-all duration-200
            ${isStandingOnCenter 
              ? 'bg-slate-800/80 border-sky-500/50 shadow-[inset_0_0_20px_rgba(14,165,233,0.15)]' 
              : 'bg-slate-900/60 border-slate-700/60 opacity-80'}
          `}
        >
          <div className="absolute top-3 left-3 text-[10px] font-bold orbitron text-slate-500">
            CENTER
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5 z-10">
            <div className={`p-2 rounded-full border ${isStandingOnCenter ? 'border-sky-400 bg-sky-500/10 text-sky-400' : 'border-slate-600 bg-slate-800 text-slate-500'}`}>
              <span className="text-2xl">👣</span>
            </div>
            <span className={`text-[11px] font-bold orbitron tracking-wider ${isStandingOnCenter ? 'text-sky-400' : 'text-slate-400'}`}>
              {isStandingOnCenter ? 'STAND (READY)' : 'REST ZONE'}
            </span>
            <span className="text-[9px] text-slate-400 font-bold">홈 대기 위치</span>
          </div>
        </div>
      );
    }

    const isPressed = inputs[idx as keyof BoardInput];
    const isTarget = targets.includes(idx);
    const hasSplash = splashes[idx];
    const isHighlighted = highlighted === idx;
    
    // 타겟 컨텐츠가 존재하는지 확인
    const content = targetContent?.[idx];
    
    return (
      <div 
        key={idx}
        onClick={() => onManualClick?.(idx)}
        className={`
          relative flex items-center justify-center w-full h-full rounded-2xl border-2 cursor-pointer grid-button overflow-hidden
          ${isPressed ? 'bg-sky-400/30 border-sky-400 scale-95 shadow-[0_0_20px_rgba(56,189,248,0.3)]' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}
          ${isTarget ? 'ring-4 ring-yellow-400/50 ring-offset-4 ring-offset-slate-900 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.2)]' : ''}
          ${isPressed && isTarget ? 'bg-green-500/40 border-green-400 ring-green-400' : ''}
          ${isHighlighted ? 'bg-yellow-400/80 border-white scale-105 z-30 ring-4 ring-yellow-500 shadow-[0_0_80px_rgba(234,179,8,1)]' : ''}
          transition-all duration-150
        `}
      >
        {/* 발판 번호 라벨: 타겟 컨텐츠가 발판 전체를덮는 경우 z-index를 낮게 유지 */}
        <div className={`absolute top-3 left-3 text-[10px] font-bold orbitron ${isPressed || isHighlighted ? 'text-white' : 'text-slate-500'} z-0 opacity-50`}>
          P{idx}
        </div>

        {/* 시연 중 강력한 링 애니메이션 */}
        {isHighlighted && (
          <div className="absolute inset-0 border-[6px] border-white/80 animate-ping rounded-2xl pointer-events-none z-50"></div>
        )}
        
        {/* Splash Effect Overlay */}
        {hasSplash && (
          <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center animate-in zoom-in fade-out duration-500">
            <div className="w-full h-full bg-sky-400/40 rounded-full animate-ping opacity-50"></div>
            <div className="absolute text-3xl animate-bounce">💦</div>
          </div>
        )}

        {/* 메인 아이콘/숫자 표시 영역 */}
        <div className="select-none z-10 transition-all duration-200 flex items-center justify-center w-full h-full">
          {(isTarget || isHighlighted) && content ? (
            <div className={`w-full h-full flex items-center justify-center ${isHighlighted ? 'animate-in zoom-in fill-mode-both' : ''}`}>
              {content}
            </div>
          ) : isHighlighted ? (
            <div className="flex flex-col items-center gap-2 animate-bounce">
               <span className="text-5xl drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">✨</span>
               <span className="text-sm font-black text-white orbitron bg-yellow-600 px-3 py-1 rounded shadow-lg">TARGET</span>
            </div>
          ) : null}
        </div>

        {/* 배경 빛 번짐 효과 (입력 시) */}
        {isPressed && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 bg-sky-400/15 animate-pulse"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 h-full max-h-[calc(100vh-130px)] aspect-square w-auto mx-auto p-3 md:p-4 bg-slate-900/50 rounded-3xl backdrop-blur-md border-2 border-slate-700/50 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(renderCell)}
    </div>
  );
};
