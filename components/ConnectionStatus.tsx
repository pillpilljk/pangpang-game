
import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface Props {
  connected: boolean;
  onConnect: () => void;
}

export const ConnectionStatus: React.FC<Props> = ({ connected, onConnect }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${connected ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500 text-red-400'} transition-all duration-300`}>
        {connected ? <Wifi size={18} className="animate-pulse" /> : <WifiOff size={18} />}
        <span className="text-xs font-bold tracking-widest orbitron">
          {connected ? 'BOARD CONNECTED' : 'BOARD DISCONNECTED'}
        </span>
      </div>
      {!connected && (
        <button 
          onClick={onConnect}
          className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all orbitron shadow-lg shadow-sky-600/20"
        >
          CONNECT SERIAL
        </button>
      )}
    </div>
  );
};
