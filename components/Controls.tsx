
import React from 'react';
import { PALETTE, ToolType, Vector3, KeyboardLayout, QualityMode, MIRROR_ID } from '../types';

interface Props {
  selectedColorIdx: number;
  onSelectColor: (idx: number) => void;
  tool: ToolType;
  onSelectTool: (t: ToolType) => void;
  keyboardLayout: KeyboardLayout;
  onToggleLayout: () => void;
  qualityMode: QualityMode;
  onToggleQuality: () => void;
  isMirrorSelected: boolean;
  onSelectMirror: () => void;
  showSphere: boolean;
  onToggleSphere: () => void;
}

const Controls: React.FC<Props> = ({ 
  selectedColorIdx, onSelectColor, tool, onSelectTool, 
  keyboardLayout, onToggleLayout, qualityMode, onToggleQuality,
  isMirrorSelected, onSelectMirror, showSphere, onToggleSphere
}) => {
  
  const getCssColor = (v: Vector3) => `rgb(${v[0]*255}, ${v[1]*255}, ${v[2]*255})`;
  
  const getQualityLabel = () => {
      if (qualityMode === 'ULTRA') return 'ULTRA';
      if (qualityMode === 'HIGH') return 'HIGH';
      if (qualityMode === 'MEDIUM') return 'MED';
      return 'LOW';
  }

  const getQualityColor = () => {
     if (qualityMode === 'ULTRA') return 'bg-purple-900/80 text-purple-100 border-purple-500 shadow-purple-500/50 shadow-lg animate-pulse';
     if (qualityMode === 'HIGH') return 'bg-red-900/50 text-red-200 border-red-800';
     if (qualityMode === 'MEDIUM') return 'bg-blue-900/50 text-blue-200 border-blue-800';
     return 'bg-green-900/50 text-green-200 border-green-800';
  }

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-gray-800 p-4 rounded-2xl text-white flex flex-col gap-4 shadow-2xl shadow-purple-500/10 transition-all min-w-[400px]">
      
      {/* Top Row: Tools & Settings */}
      <div className="flex justify-between items-center gap-4">
        
        <div className="flex gap-2">
           {/* Layout Toggle */}
            <button 
              onClick={onToggleLayout}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-mono text-gray-300 border border-gray-700"
              title="Toggle Keyboard Layout"
            >
              ⌨️ {keyboardLayout}
            </button>
            {/* Quality Toggle */}
            <button 
              onClick={onToggleQuality}
              className={`px-3 py-2 rounded-lg text-xs font-bold font-mono border border-gray-700 transition-all ${getQualityColor()}`}
              title="Toggle Render Quality"
            >
              QL: {getQualityLabel()}
            </button>
            {/* Sphere Toggle */}
            <button 
              onClick={onToggleSphere}
              className={`px-3 py-2 rounded-lg text-xs font-bold font-mono border border-gray-700 ${showSphere ? 'bg-purple-900/50 text-purple-200 border-purple-800' : 'bg-gray-800 text-gray-500'}`}
              title="Toggle Central Sphere"
            >
              {showSphere ? '⦿ ON' : '⦿ OFF'}
            </button>
        </div>

        {/* Tools */}
        <div className="flex gap-2">
            <button
            onClick={() => onSelectTool(ToolType.BLOCK)}
            className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${tool === ToolType.BLOCK ? 'bg-purple-600 text-white scale-105 shadow-lg shadow-purple-500/50' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}
            >
            Block
            </button>
            <button
            onClick={() => onSelectTool(ToolType.LIGHT)}
            className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${tool === ToolType.LIGHT ? 'bg-yellow-500 text-black scale-105 shadow-lg shadow-yellow-500/50' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}
            >
            Light
            </button>
            <button
            onClick={() => onSelectTool(ToolType.DELETE)}
            className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${tool === ToolType.DELETE ? 'bg-red-600 text-white scale-105 shadow-lg shadow-red-500/50' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}
            >
            Delete
            </button>
        </div>
      </div>

      {/* Palette */}
      <div className="flex flex-wrap gap-1 bg-gray-900 p-2 rounded-lg justify-center items-center">
        {PALETTE.map((col, idx) => (
          <button
            key={idx}
            onClick={() => onSelectColor(idx)}
            style={{ backgroundColor: getCssColor(col) }}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${selectedColorIdx === idx && !isMirrorSelected ? 'border-white scale-110 shadow-md shadow-white/20' : 'border-transparent'}`}
          />
        ))}
        <div className="w-px h-6 bg-gray-700 mx-2"></div>
        {/* Mirror Button */}
        <button
            onClick={onSelectMirror}
            className={`w-6 h-6 rounded-sm border-2 transition-transform hover:scale-110 bg-gradient-to-br from-gray-300 via-white to-gray-400 ${isMirrorSelected ? 'border-blue-400 scale-110 shadow-md shadow-blue-400/50' : 'border-transparent'}`}
            title="Mirror Block"
        />
      </div>

      <div className="text-center text-[10px] text-gray-500 font-mono">
        {keyboardLayout} + Mouse (Click to lock) | Left Click: Action | Shift: Run
      </div>
    </div>
  );
};

export default Controls;
