import React from 'react';
import { VideoPlayer } from '../VideoPlayer';
import { ROIEditor } from '../ROIEditor';
import { VideoInfo, ROI } from '../../api/types';
import { ConnectedComponentCenter } from '../../types/algorithm';

interface VideoDisplayPanelProps {
  currentVideo: VideoInfo | null;
  currentFrame: number;
  displayedTotalFrames: number;
  frameStep: number;
  zoom: number;
  panX: number;
  panY: number;
  currentROI: ROI | null;
  isROIMode: boolean;
  segmentationMask: number[][] | null;
  showSegmentationOverlay: boolean;
  showROIBorder: boolean;
  showCenterPoints: boolean;
  analysisCenterPoints: Array<{x: number, y: number, label: string, inMask?: boolean}>;
  selectedPoint: {x: number, y: number} | null;
  enablePointSelection: boolean;
  isPointSelectionMode: boolean;
  connectedComponentCenter?: ConnectedComponentCenter | null; // 新增：连通域中心点
  onFrameChange: (frame: number) => void;
  onTimeUpdate: () => void;
  onCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  onMouseMove?: (e: React.MouseEvent, grayscaleValue?: number, x?: number, y?: number) => void;
  onMouseLeave?: () => void;
  showGrayscale?: boolean;
  onROIChange: (roi: ROI | null) => void;
  onROIClear: () => void;
  onPointSelect: (point: {x: number, y: number}) => void;
  onImageWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onPanMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPanMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPanMouseUp: () => void;
  onCurrentFrameChange: (frame: number) => void;
}

export const VideoDisplayPanel: React.FC<VideoDisplayPanelProps> = ({
  currentVideo,
  currentFrame,
  displayedTotalFrames,
  frameStep,
  zoom,
  panX,
  panY,
  currentROI,
  isROIMode,
  segmentationMask,
  showSegmentationOverlay,
  showROIBorder,
  showCenterPoints,
  analysisCenterPoints,
  selectedPoint,
  enablePointSelection,
  isPointSelectionMode,
  connectedComponentCenter, // 新增
  onFrameChange,
  onTimeUpdate,
  onCanvasRef,
  onMouseMove,
  onMouseLeave,
  showGrayscale,
  onROIChange,
  onROIClear,
  onPointSelect,
  onImageWheel,
  onPanMouseDown,
  onPanMouseMove,
  onPanMouseUp,
  onCurrentFrameChange,
}) => {
  return (
    <div className="space-y-4">
      {!currentVideo ? (
        <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-600 rounded">
          <div className="text-center">
            <div className="text-6xl mb-4">📹</div>
            <p className="text-gray-400 mb-2">请上传超声视频文件</p>
            <p className="text-sm text-gray-500">支持 MP4, AVI, MOV 格式</p>
          </div>
        </div>
      ) : (
      <div
        className="relative mx-auto"
        style={{
          width: 800,
          height: 600,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
        onWheel={isROIMode ? undefined : onImageWheel}
        onMouseDown={isROIMode ? undefined : onPanMouseDown}
        onMouseMove={isROIMode ? undefined : onPanMouseMove}
        onMouseUp={isROIMode ? undefined : onPanMouseUp}
        onMouseLeave={isROIMode ? undefined : onPanMouseUp}
      >
        <VideoPlayer
          videoUrl={currentVideo.videoUrl}
          currentFrame={currentFrame}
          totalFrames={displayedTotalFrames}
          onFrameChange={onFrameChange}
          onTimeUpdate={onTimeUpdate}
          frameStep={frameStep}
          width={800}
          height={600}
          className="w-full h-full"
          onCanvasRef={onCanvasRef}
          onMouseMove={showGrayscale ? onMouseMove : undefined}
          onMouseLeave={showGrayscale ? onMouseLeave : undefined}
          showGrayscale={showGrayscale}
          connectedComponentCenter={connectedComponentCenter}
          currentROI={currentROI}
        />

        <div
          className="absolute inset-0"
          style={{ pointerEvents: isROIMode ? 'auto' : 'none' }}
        >
          <ROIEditor
            imageWidth={800}
            imageHeight={600}
            currentROI={currentROI}
            onROIChange={onROIChange}
            onROIClear={onROIClear}
            onPointSelect={onPointSelect}
            className="w-full h-full"
            enabled={isROIMode}
            showROIBorder={showROIBorder}
            showCenterPoints={showCenterPoints}
            centerPoints={analysisCenterPoints}
            selectedPoint={selectedPoint}
            enablePointSelection={enablePointSelection}
            isPointSelectionMode={isPointSelectionMode}
          />
          {segmentationMask && showSegmentationOverlay && (
            <canvas
              className="absolute inset-0 pointer-events-none"
              ref={canvas => {
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const width = 800;
                const height = 600;
                canvas.width = width;
                canvas.height = height;
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                for (let y = 0; y < segmentationMask.length; y += 1) {
                  const row = segmentationMask[y];
                  for (let x = 0; x < row.length; x += 1) {
                    if (row[x]) {
                      ctx.fillRect(x, y, 1, 1);
                    }
                  }
                }
              }}
            />
          )}
        </div>
      </div>
      )}

      </div>
  );
};