
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { vertexShaderSource, getFragmentShaderSource } from '../lib/shader';
import { Vector3, Light, GRID_SIZE, PALETTE, KeyboardLayout, QualityMode } from '../types';
import * as Math3D from '../lib/math';

interface Props {
  gridData: Uint8Array;
  lights: Light[];
  cameraPos: Vector3;
  cameraAngle: { yaw: number; pitch: number };
  onCameraMove: (pos: Vector3, angle: { yaw: number; pitch: number }) => void;
  onBlockAction: (hitPos: Vector3, normal: Vector3) => void;
  onLightClick: (lightIndex: number) => void;
  keyboardLayout: KeyboardLayout;
  qualityMode: QualityMode;
  onPointerLockChange: (isLocked: boolean) => void;
  isPointerLocked: boolean;
  showSphere: boolean;
  onFpsUpdate: (fps: number) => void;
}

const RayTracerCanvas: React.FC<Props> = ({
  gridData,
  lights,
  cameraPos,
  cameraAngle,
  onCameraMove,
  onBlockAction,
  onLightClick,
  keyboardLayout,
  qualityMode,
  onPointerLockChange,
  isPointerLocked,
  showSphere,
  onFpsUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const requestRef = useRef<number>(0);
  
  // Refs for the animation loop to avoid stale closures and dependency restarts
  const cameraPosRef = useRef<Vector3>(cameraPos);
  const cameraAngleRef = useRef<{ yaw: number; pitch: number }>(cameraAngle);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // FPS Counter Refs
  const lastFpsTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  
  // Sync props to refs if they change externally (e.g. initial load or reset)
  useEffect(() => {
    cameraPosRef.current = cameraPos;
    cameraAngleRef.current = cameraAngle;
  }, []); // Only on mount or if we specifically want to force sync. 
  // Note: We don't sync continuously to avoid fighting the loop.

  // Config based on Quality Mode
  const getQualityConfig = () => {
      switch(qualityMode) {
          case 'ULTRA': return { scale: 1.0, maxSteps: 1024, maxBounces: 32, shadowSteps: 128 };
          case 'HIGH': return { scale: 1.0, maxSteps: 384, maxBounces: 8, shadowSteps: 64 };
          case 'MEDIUM': return { scale: 0.75, maxSteps: 128, maxBounces: 3, shadowSteps: 32 };
          case 'LOW': default: return { scale: 0.5, maxSteps: 64, maxBounces: 2, shadowSteps: 16 };
      }
  };
  
  const config = getQualityConfig();

  const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  // Initialize or Re-initialize GL/Program when quality changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let context = gl;
    if (!context) {
      context = canvas.getContext('webgl2', { alpha: false, powerPreference: "high-performance" });
      if (!context) {
        alert("WebGL2 not supported");
        return;
      }
      setGl(context);
    }
    
    if (programRef.current) {
      context.deleteProgram(programRef.current);
    }

    const program = context.createProgram();
    const vs = createShader(context, context.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(context, context.FRAGMENT_SHADER, getFragmentShaderSource({
        maxSteps: config.maxSteps,
        maxBounces: config.maxBounces,
        shadowSteps: config.shadowSteps
    }));
    
    if (program && vs && fs) {
      context.attachShader(program, vs);
      context.attachShader(program, fs);
      context.linkProgram(program);
      programRef.current = program;
      
      const positionBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
      context.bufferData(context.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]), context.STATIC_DRAW);
      
      const positionLoc = context.getAttribLocation(program, 'position');
      context.enableVertexAttribArray(positionLoc);
      context.vertexAttribPointer(positionLoc, 2, context.FLOAT, false, 0, 0);
    }

    return () => {};
  }, [qualityMode]);

  // Texture setup
  useEffect(() => {
    if (!gl) return;
    if (!textureRef.current) {
       const texture = gl.createTexture();
       gl.bindTexture(gl.TEXTURE_3D, texture);
       gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
       gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
       textureRef.current = texture;
    }
    
    if (textureRef.current) {
       gl.bindTexture(gl.TEXTURE_3D, textureRef.current);
       gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, GRID_SIZE, GRID_SIZE, GRID_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, gridData);
    }
  }, [gl, gridData]);

  // Render function
  const render = useCallback((time: number) => {
      if (!gl || !programRef.current || !canvasRef.current) return;

      // Use Refs for current state
      const currentPos = cameraPosRef.current;
      const currentAngle = cameraAngleRef.current;

      const canvas = canvasRef.current;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      
      const targetWidth = Math.floor(displayWidth * config.scale);
      const targetHeight = Math.floor(displayHeight * config.scale);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(programRef.current);
      
      // Uniforms
      gl.uniform1f(gl.getUniformLocation(programRef.current!, 'u_time'), time * 0.001);
      gl.uniform2f(gl.getUniformLocation(programRef.current!, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1i(gl.getUniformLocation(programRef.current!, 'u_showSphere'), showSphere ? 1 : 0);
      
      const yaw = currentAngle.yaw;
      const pitch = currentAngle.pitch;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const camDir: Vector3 = [sy * cp, sp, cy * cp];
      const camRight: Vector3 = [cy, 0, -sy];
      const camUp = Math3D.cross(camDir, camRight); 

      gl.uniform3fv(gl.getUniformLocation(programRef.current!, 'u_cameraPos'), currentPos);
      gl.uniform3fv(gl.getUniformLocation(programRef.current!, 'u_cameraDir'), camDir);
      gl.uniform3fv(gl.getUniformLocation(programRef.current!, 'u_cameraUp'), camUp);
      gl.uniform3fv(gl.getUniformLocation(programRef.current!, 'u_cameraRight'), camRight);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, textureRef.current);
      gl.uniform1i(gl.getUniformLocation(programRef.current!, 'u_grid'), 0);

      for(let i=0; i<16; i++) {
        gl.uniform3fv(gl.getUniformLocation(programRef.current!, `u_palette[${i}]`), PALETTE[i]);
      }
      gl.uniform1i(gl.getUniformLocation(programRef.current!, 'u_lightCount'), lights.length);
      lights.forEach((light, i) => {
        gl.uniform3fv(gl.getUniformLocation(programRef.current!, `u_lights[${i}].position`), light.position);
        gl.uniform3fv(gl.getUniformLocation(programRef.current!, `u_lights[${i}].color`), light.color);
        gl.uniform1f(gl.getUniformLocation(programRef.current!, `u_lights[${i}].radius`), light.intensity);
      });

      gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [gl, lights, config, showSphere]);

  // Animation Loop
  useEffect(() => {
    if (!gl || !programRef.current) return;
    
    const updateCamera = () => {
        let speed = 0.15;
        if (keysPressed.current['shift']) speed *= 2;
        let forward = 0, right = 0, up = 0;
        
        const fwdKey = keyboardLayout === 'WASD' ? 'w' : 'z';
        const backKey = 's';
        const leftKey = keyboardLayout === 'WASD' ? 'a' : 'q';
        const rightKey = 'd';
  
        if (keysPressed.current[fwdKey]) forward += 1;
        if (keysPressed.current[backKey]) forward -= 1;
        if (keysPressed.current[rightKey]) right += 1;
        if (keysPressed.current[leftKey]) right -= 1;
        if (keysPressed.current[' ']) up += 1;
        if (keysPressed.current['control']) up -= 1;
  
        if (forward !== 0 || right !== 0 || up !== 0) {
          const yaw = cameraAngleRef.current.yaw;
          const front: Vector3 = [Math.sin(yaw), 0, Math.cos(yaw)];
          const rVec: Vector3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
          let newPos = [...cameraPosRef.current] as Vector3;
          newPos = Math3D.add(newPos, Math3D.scale(front, forward * speed));
          newPos = Math3D.add(newPos, Math3D.scale(rVec, right * speed));
          newPos[1] += up * speed;
          cameraPosRef.current = newPos;
          
          // Sync to parent state less frequently or on action, but we need to do it here 
          // if we want the parent to know where we are for block placement.
          // WARNING: Calling this on every frame might cause react render overhead. 
          // However, the parent component is optimized enough or we can live with it.
          // BUT, to fix the "cant move mouse while moving" bug, the critical part is 
          // that this effect loop DOES NOT depend on cameraPos/Angle props.
          onCameraMove(newPos, cameraAngleRef.current);
        }
    };

    const loop = (time: number) => {
      if (!isPointerLocked) return;

      // Calculate FPS
      frameCountRef.current++;
      if (time - lastFpsTimeRef.current >= 500) {
          const fps = Math.round((frameCountRef.current * 1000) / (time - lastFpsTimeRef.current));
          onFpsUpdate(fps);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = time;
      }

      updateCamera();
      render(time);
      requestRef.current = requestAnimationFrame(loop);
    };

    if (isPointerLocked) {
        lastFpsTimeRef.current = performance.now();
        frameCountRef.current = 0;
        requestRef.current = requestAnimationFrame(loop);
    } else {
        render(performance.now());
    }

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gl, render, isPointerLocked, keyboardLayout, onCameraMove, onFpsUpdate]); // Removed cameraPos/cameraAngle from deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      onPointerLockChange(locked);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [onPointerLockChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && document.pointerLockElement === canvasRef.current) {
       performRaycastAction();
    } else {
       canvasRef.current?.requestPointerLock();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (document.pointerLockElement === canvasRef.current) {
      const sensitivity = 0.002;
      const currentAngle = cameraAngleRef.current;
      const newYaw = currentAngle.yaw + e.movementX * sensitivity; 
      const newPitch = Math.max(-1.5, Math.min(1.5, currentAngle.pitch - e.movementY * sensitivity));
      
      // Update ref immediately for next frame
      cameraAngleRef.current = { yaw: newYaw, pitch: newPitch };
      
      // Sync to parent (allows block placement to use correct angle)
      onCameraMove(cameraPosRef.current, cameraAngleRef.current);
    }
  };

  const performRaycastAction = () => {
      // Use refs for raycasting to ensure we use the frame-perfect position
      const yaw = cameraAngleRef.current.yaw;
      const pitch = cameraAngleRef.current.pitch;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const camDir: Vector3 = [sy * cp, sp, cy * cp];
      const camPos = cameraPosRef.current;
      
      // 1. Check Lights intersection (CPU side)
      let closestLightIdx = -1;
      let minLightDist = 100.0;
      
      lights.forEach((l, i) => {
          const t = Math3D.intersectSphere(camPos, camDir, l.position, 0.2);
          if (t !== null && t > 0 && t < minLightDist) {
              minLightDist = t;
              closestLightIdx = i;
          }
      });

      // 2. Check Voxels intersection
      const hit = Math3D.intersectVoxels(camPos, camDir, gridData, GRID_SIZE);
      const voxelDist = hit ? hit.t : 1000.0;

      if (closestLightIdx !== -1 && minLightDist < voxelDist) {
          onLightClick(closestLightIdx);
      } else if (hit) {
          onBlockAction(hit.pos, hit.normal);
      }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair block image-pixelated"
      style={{ imageRendering: 'pixelated' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
};

export default RayTracerCanvas;
