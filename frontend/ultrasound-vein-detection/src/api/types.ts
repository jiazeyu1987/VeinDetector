// API 类型定义
import { ConnectedComponentCenter } from '../types/algorithm';
export interface VideoInfo {
  id: string;
  name: string;
  duration: number;
  frameCount: number;
  fps: number;
  width: number;
  height: number;
  videoUrl: string;
}

export interface ROI {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frameIndex: number;
}

export interface VeinDetectionResult {
  frameIndex: number;
  veins: VeinData[];
}

export interface VeinData {
  id: string;
  centerX: number;
  centerY: number;
  radius: number;
  confidence: number;
  contour: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AnalysisRequest {
  videoId: string;
  roi: ROI;
  parameters?: {
    threshold?: number;
    minVeinSize?: number;
    maxVeinSize?: number;
  };
}

export interface AnalysisResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: VeinDetectionResult[];
  progress?: number;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface SamusSegmentationResponse {
  width: number;
  height: number;
  mask: number[][];
  connected_component_center?: ConnectedComponentCenter | null;
}
