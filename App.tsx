
import React, { useState, useCallback } from 'react';
import RayTracerCanvas from './components/RayTracerCanvas';
import Controls from './components/Controls';
import { Vector3, GRID_SIZE, Light, ToolType, PALETTE, KeyboardLayout, QualityMode, MIRROR_ID } from './types';
import * as Math3D from './lib/math';

const App: React.FC = () => {
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>('WASD');
  const [qualityMode, setQualityMode] = useState<QualityMode>('LOW');
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [showSphere, setShowSphere] = useState(true);
  const [fps, setFps] = useState(0);

  const [gridData, setGridData] = useState<Uint8Array>(() => {
    const data = new Uint8Array(GRID_SIZE * GRID_SIZE * GRID_SIZE);
    // Fill a floor of 16x16 in the center
    const offset = 8;
    for (let x = offset; x < GRID_SIZE - offset; x++) {
      for (let z = offset; z < GRID_SIZE - offset; z++) {
         // Checkered
         const idx = x + 0 * GRID_SIZE + z * GRID_SIZE * GRID_SIZE;
         data[idx] = ((x+z)%2 === 0) ? 15 : 9; 
      }
    }
    return data;
  });

  const [lights, setLights] = useState<Light[]>([
    { position: [16, 12, 16], color: [1, 1, 1], radius: 2.0, intensity: 3.0 },
    { position: [8, 5, 8], color: [1, 0.2, 0.2], radius: 2.0, intensity: 2.0 },
  ]);

  const [cameraPos, setCameraPos] = useState<Vector3>([16, 8, 4]);
  const [cameraAngle, setCameraAngle] = useState({ yaw: 0, pitch: -0.2 });
  
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [isMirrorSelected, setIsMirrorSelected] = useState(false);
  const [tool, setTool] = useState<ToolType>(ToolType.BLOCK);

  const handleCameraMove = useCallback((pos: Vector3, angle: { yaw: number; pitch: number }) => {
    setCameraPos(pos);
    setCameraAngle(angle);
  }, []);

  const handleBlockAction = useCallback((hitPos: Vector3, normal: Vector3) => {
      setGridData(prev => {
          const newData = new Uint8Array(prev);
          const idx = (p: Vector3) => p[0] + p[1] * GRID_SIZE + p[2] * GRID_SIZE * GRID_SIZE;
          
          if (tool === ToolType.DELETE) {
              const i = idx(hitPos);
              if (i >= 0 && i < newData.length) newData[i] = 0;
          } else if (tool === ToolType.BLOCK) {
              const target = Math3D.add(hitPos, normal);
              const i = idx(target);
              // Boundary check
              if (target[0] >= 0 && target[0] < GRID_SIZE &&
                  target[1] >= 0 && target[1] < GRID_SIZE &&
                  target[2] >= 0 && target[2] < GRID_SIZE) {
                  
                  // Collision check with camera
                  const p = Math3D.add(target, [0.5, 0.5, 0.5]);
                  if (Math3D.len(Math3D.sub(p, cameraPos)) > 1.0) {
                       newData[i] = isMirrorSelected ? MIRROR_ID : (selectedColorIdx + 1);
                  }
              }
          }
          return newData;
      });

      if (tool === ToolType.LIGHT) {
          const target = Math3D.add(hitPos, normal);
          const newLight: Light = {
               position: [target[0] + 0.5, target[1] + 0.5, target[2] + 0.5],
               color: PALETTE[selectedColorIdx],
               radius: 2.0,
               intensity: 2.0
          };
          setLights(prev => prev.length < 10 ? [...prev, newLight] : prev);
      }
  }, [tool, selectedColorIdx, isMirrorSelected, cameraPos]);

  const handleLightClick = useCallback((lightIndex: number) => {
    if (tool === ToolType.DELETE) {
       setLights(prev => prev.filter((_, i) => i !== lightIndex));
    }
  }, [tool]);

  const toggleLayout = useCallback(() => {
    setKeyboardLayout(prev => prev === 'WASD' ? 'ZQSD' : 'WASD');
  }, []);

  const toggleQuality = useCallback(() => {
    setQualityMode(prev => {
        if (prev === 'LOW') return 'MEDIUM';
        if (prev === 'MEDIUM') return 'HIGH';
        if (prev === 'HIGH') return 'ULTRA';
        return 'LOW';
    });
  }, []);

  // Warning Modal
  if (!warningAccepted) {
      return (
          <div className="w-full h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-black z-0" />
              
              <div className="relative z-10 max-w-3xl bg-gray-900/90 backdrop-blur-xl border border-purple-500/30 p-8 rounded-2xl shadow-2xl shadow-purple-900/40 text-center overflow-y-auto max-h-full">
                  <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                      LuminaRay Builder
                  </h1>
                  <div className="text-sm text-gray-500 font-mono mb-6">Made with Gemini</div>
                  
                  <p className="text-gray-300 mb-8 leading-relaxed">
                      Welcome to the Voxel Ray Tracing Sandbox. Build structures, place lights, and explore a fully dynamic environment.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="flex flex-col gap-2 text-left">
                          <h3 className="text-gray-400 font-bold text-sm uppercase tracking-wider">Graphics Quality</h3>
                          
                          <label className={`p-3 rounded-lg border cursor-pointer transition-all ${qualityMode === 'LOW' ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-700'}`} onClick={() => setQualityMode('LOW')}>
                             <div className="font-bold text-white text-sm">Low (Fast)</div>
                             <div className="text-[10px] text-gray-400">Optimized for all devices.</div>
                          </label>

                          <label className={`p-3 rounded-lg border cursor-pointer transition-all ${qualityMode === 'MEDIUM' ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800 border-gray-700'}`} onClick={() => setQualityMode('MEDIUM')}>
                             <div className="font-bold text-white text-sm">Medium (Balanced)</div>
                             <div className="text-[10px] text-gray-400">Good balance of visual and perf.</div>
                          </label>

                          <label className={`p-3 rounded-lg border cursor-pointer transition-all ${qualityMode === 'HIGH' ? 'bg-red-900/30 border-red-500' : 'bg-gray-800 border-gray-700'}`} onClick={() => setQualityMode('HIGH')}>
                             <div className="font-bold text-white text-sm">High (Quality)</div>
                             <div className="text-[10px] text-gray-400">Better shadows and reflections.</div>
                          </label>

                           <label className={`p-3 rounded-lg border cursor-pointer transition-all ${qualityMode === 'ULTRA' ? 'bg-purple-900/30 border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-gray-800 border-gray-700'}`} onClick={() => setQualityMode('ULTRA')}>
                             <div className="font-bold text-purple-300 text-sm">Ultra (Laggy)</div>
                             <div className="text-[10px] text-gray-400">Full path tracing power. Requires High-End GPU.</div>
                          </label>
                      </div>

                      <div className="flex flex-col gap-2 text-left">
                          <h3 className="text-gray-400 font-bold text-sm uppercase tracking-wider">Controls</h3>
                           <div className="flex gap-2">
                                <button 
                                    onClick={() => setKeyboardLayout('WASD')}
                                    className={`flex-1 py-3 rounded-lg font-mono border ${keyboardLayout === 'WASD' ? 'bg-purple-600/30 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    WASD
                                </button>
                                <button 
                                    onClick={() => setKeyboardLayout('ZQSD')}
                                    className={`flex-1 py-3 rounded-lg font-mono border ${keyboardLayout === 'ZQSD' ? 'bg-purple-600/30 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    ZQSD
                                </button>
                           </div>
                           <div className="mt-4 text-xs text-gray-400 bg-gray-800 p-3 rounded border border-gray-700">
                               <p>• Click to Lock Cursor</p>
                               <p>• Left Click: Place/Delete</p>
                               <p>• Shift: Run</p>
                               <p>• Esc: Unlock Cursor</p>
                           </div>
                      </div>
                  </div>
                  
                  <button 
                      onClick={() => setWarningAccepted(true)}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-900/50"
                  >
                      Enter Simulation
                  </button>
              </div>
          </div>
      );
  }

  const handleSelectColor = (idx: number) => {
      setSelectedColorIdx(idx);
      setIsMirrorSelected(false);
      setTool(ToolType.BLOCK);
  }

  const handleSelectMirror = () => {
      setIsMirrorSelected(true);
      setTool(ToolType.BLOCK);
  }

  const handleFpsUpdate = (newFps: number) => {
      setFps(newFps);
  }

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden font-sans selection:bg-purple-500 selection:text-white">
      <RayTracerCanvas
        gridData={gridData}
        lights={lights}
        cameraPos={cameraPos}
        cameraAngle={cameraAngle}
        onCameraMove={handleCameraMove}
        onBlockAction={handleBlockAction}
        onLightClick={handleLightClick}
        keyboardLayout={keyboardLayout}
        qualityMode={qualityMode}
        onPointerLockChange={setIsPointerLocked}
        isPointerLocked={isPointerLocked}
        showSphere={showSphere}
        onFpsUpdate={handleFpsUpdate}
      />
      
      {/* Crosshair - only visible when pointer is locked */}
      {isPointerLocked && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none mix-blend-difference">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 5V15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M5 10H15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        </div>
      )}

      <Controls
        selectedColorIdx={selectedColorIdx}
        onSelectColor={handleSelectColor}
        tool={tool}
        onSelectTool={setTool}
        keyboardLayout={keyboardLayout}
        onToggleLayout={toggleLayout}
        qualityMode={qualityMode}
        onToggleQuality={toggleQuality}
        isMirrorSelected={isMirrorSelected}
        onSelectMirror={handleSelectMirror}
        showSphere={showSphere}
        onToggleSphere={() => setShowSphere(prev => !prev)}
      />
      
      {/* Status Bar */}
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-gray-500 pointer-events-none bg-black/50 px-2 rounded flex gap-2">
          <span className={isPointerLocked ? "text-green-400" : "text-yellow-400"}>{isPointerLocked ? "RENDERING" : "PAUSED"}</span> 
          <span>|</span>
          <span>Mode: {qualityMode}</span>
          <span>|</span>
          <span className="font-bold text-white">FPS: {fps}</span>
      </div>

      <div className="absolute top-4 left-4 pointer-events-none select-none">
         <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 drop-shadow-lg filter">
            LuminaRay
         </h1>
         <p className="text-gray-400 text-sm mt-1">Made with Gemini</p>
      </div>
    </div>
  );
};

export default App;
