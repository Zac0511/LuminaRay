
export type Vector3 = [number, number, number];

export enum ToolType {
  BLOCK = 'BLOCK',
  LIGHT = 'LIGHT',
  DELETE = 'DELETE'
}

export type KeyboardLayout = 'WASD' | 'ZQSD';

export type QualityMode = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export interface Light {
  position: Vector3;
  color: Vector3;
  radius: number;
  intensity: number;
}

export interface AppState {
  selectedColor: Vector3;
  selectedTool: ToolType;
  isMenuOpen: boolean;
}

export const GRID_SIZE = 32;
export const PALETTE_SIZE = 16;
export const MIRROR_ID = 100;

// Predefined nice colors for the palette
export const PALETTE: Vector3[] = [
  [0.9, 0.9, 0.9], // White
  [0.8, 0.2, 0.2], // Red
  [0.2, 0.8, 0.2], // Green
  [0.2, 0.2, 0.8], // Blue
  [0.9, 0.6, 0.1], // Orange
  [0.9, 0.9, 0.2], // Yellow
  [0.6, 0.2, 0.8], // Purple
  [0.2, 0.9, 0.9], // Cyan
  [0.5, 0.5, 0.5], // Gray
  [0.2, 0.2, 0.2], // Dark Gray
  [0.5, 0.0, 0.0], // Dark Red
  [0.0, 0.5, 0.0], // Dark Green
  [0.9, 0.5, 0.5], // Pink
  [0.4, 0.2, 0.0], // Brown
  [0.6, 0.7, 0.8], // Steel
  [0.1, 0.1, 0.1], // Black
];
