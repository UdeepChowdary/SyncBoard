import React from 'react';

const UsersSidebar = ({ connectedUsers, socketId }) => {
  if (!connectedUsers || connectedUsers.length === 0) return null;
  
  return (
    <div className="absolute bottom-4 right-4 bg-slate-900/50 backdrop-blur-2xl p-5 rounded-2xl border border-slate-700/50 z-50 min-w-[220px] shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800/80 pb-3">
        Users ({connectedUsers.length})
      </h3>
      <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-2">
        {connectedUsers.map(user => (
          <div key={user.socketId} className="flex items-center gap-3 text-sm text-slate-300 font-medium py-1.5 px-2 rounded-lg hover:bg-slate-800/50 transition-colors">
            <div 
              className="w-3 h-3 rounded-full ring-2 ring-slate-900" 
              style={{ 
                backgroundColor: user.color,
                boxShadow: `0 0 10px ${user.color}`
              }}
            ></div>
            <span className="truncate flex-1">{user.nickname}</span>
            {user.isHost && (
              <span title="Room Host" className="text-[11px] text-amber-400">👑</span>
            )}
            {user.socketId === socketId && (
              <span className="text-[10px] uppercase font-bold text-cyan-500 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/50">You</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersSidebar;
