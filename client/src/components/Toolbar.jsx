import React from 'react';
import { MousePointer2, Type, Pen, Square, Circle, ArrowUpRight, Image as ImageIcon, Eraser, Trash2, Download, Undo, Redo, Lock, Hand, Flame, Save, FolderOpen, StickyNote, FileText } from 'lucide-react';

const toolIcons = {
  select: MousePointer2,
  hand: Hand,
  laser: Flame,
  text: Type,
  pen: Pen,
  rect: Square,
  circle: Circle,
  arrow: ArrowUpRight,
  image: ImageIcon,
  eraser: Eraser,
  sticky: StickyNote,
};

const toolTitles = {
  select: 'Select (V)',
  hand: 'Pan (H)',
  laser: 'Laser',
  text: 'Text (T)',
  pen: 'Pen (P)',
  rect: 'Rectangle',
  circle: 'Circle',
  arrow: 'Arrow',
  image: 'Image',
  eraser: 'Eraser (E)',
  sticky: 'Sticky Note',
};

const Toolbar = ({
  tool,
  setTool,
  setSelectedId,
  isFilled,
  setIsFilled,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  handleClear,
  handleExport,
  handleExportPDF,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  fileInputRef,
  handleImageUpload,
  onLockClick,
  handleExportProject,
  handleImportProject,
  projectInputRef,
  isHost,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 mb-3 p-2 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] mx-auto max-w-fit z-40 transition-all hover:shadow-[0_8px_40px_rgb(6,182,212,0.15)]">
      <div className="flex items-center gap-4">
        <div className="flex gap-2 bg-slate-950/50 p-1.5 rounded-xl border border-slate-800/80 shadow-inner">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          {['select', 'hand', 'laser', 'text', 'pen', 'rect', 'circle', 'arrow', 'sticky', 'image', 'eraser'].map((t) => {
            const Icon = toolIcons[t];
            return (
              <button
                key={t}
                type="button"
                title={toolTitles[t] || t}
                onClick={() => {
                  setTool(t);
                  setSelectedId(null);
                  if (t === 'image' && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                className={`p-2 rounded-lg transition-all duration-300 active:scale-95 ${
                  tool === t
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_-3px_rgba(34,211,238,0.5)] scale-105'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 hover:scale-110'
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-slate-700/50"></div>

        {['rect', 'circle', 'sticky'].includes(tool) && (
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-cyan-400 transition-colors">
            <input
              type="checkbox"
              checked={isFilled}
              onChange={(e) => setIsFilled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 transition-colors cursor-pointer"
            />
            Fill
          </label>
        )}

        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-cyan-400 transition-colors">
          Color
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-600 ring-2 ring-slate-800 transition-transform duration-300 hover:scale-110 shadow-sm cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer"
            />
          </div>
        </label>

        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-cyan-400 transition-colors group">
          Width
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-24 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 group-hover:accent-cyan-400 transition-colors"
          />
          <span className="w-6 text-center text-slate-300 font-mono text-xs bg-slate-800/50 px-1 py-0.5 rounded border border-slate-700/50 shadow-inner">{strokeWidth}</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        {/* Host-only controls */}
        {isHost && (
          <button
            type="button"
            onClick={onLockClick}
            title="Lock Room (Host only)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-900/50 bg-amber-900/20 text-amber-400 text-xs font-bold uppercase tracking-wider hover:bg-amber-900/40 hover:scale-105 active:scale-95 transition-all"
          >
            <Lock size={14} /> Lock
          </button>
        )}

        {isHost && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear Board (Host only)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-900/50 bg-rose-900/20 text-rose-400 text-xs font-bold uppercase tracking-wider hover:bg-rose-900/40 hover:scale-105 active:scale-95 transition-all"
          >
            <Trash2 size={14} /> Clear
          </button>
        )}

        <button
          type="button"
          onClick={handleExport}
          title="Export as PNG"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600/50 bg-slate-800/80 text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-slate-700 hover:text-white hover:scale-105 active:scale-95 transition-all"
        >
          <Download size={14} /> PNG
        </button>

        <button
          type="button"
          onClick={handleExportPDF}
          title="Export as PDF"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-900/50 bg-violet-900/20 text-violet-400 text-xs font-bold uppercase tracking-wider hover:bg-violet-900/40 hover:scale-105 active:scale-95 transition-all"
        >
          <FileText size={14} /> PDF
        </button>

        <button
          type="button"
          onClick={handleExportProject}
          title="Save Project"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fuchsia-900/50 bg-fuchsia-900/20 text-fuchsia-400 text-xs font-bold uppercase tracking-wider hover:bg-fuchsia-900/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Save size={14} /> Save
        </button>

        <button
          type="button"
          onClick={() => projectInputRef.current?.click()}
          title="Open Project"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fuchsia-900/50 bg-fuchsia-900/20 text-fuchsia-400 text-xs font-bold uppercase tracking-wider hover:bg-fuchsia-900/40 hover:scale-105 active:scale-95 transition-all"
        >
          <FolderOpen size={14} /> Open
        </button>

        <input
          type="file"
          accept=".syncboard,.json"
          ref={projectInputRef}
          style={{ display: 'none' }}
          onChange={handleImportProject}
        />

        <div className="flex gap-2 pl-3 border-l border-slate-700/50">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded-lg border transition-all duration-300 ${
              canUndo
                ? 'border-slate-600/50 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white hover:scale-110 active:scale-95'
                : 'border-slate-800/50 bg-slate-900 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Undo size={16} />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded-lg border transition-all duration-300 ${
              canRedo
                ? 'border-slate-600/50 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white hover:scale-110 active:scale-95'
                : 'border-slate-800/50 bg-slate-900 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Redo size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
