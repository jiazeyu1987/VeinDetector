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
  // 自动分析相关
  autoAnalysisFrames: number;
  isAutoAnalyzing: boolean;
  onAutoAnalysisFramesChange: (frames: number) => void;
  onStartAutoAnalysis: () => void;
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
  // 自动分析相关
  autoAnalysisFrames,
  isAutoAnalyzing,
  onAutoAnalysisFramesChange,
  onStartAutoAnalysis,
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

      <div className="mx-auto w-full max-w-[800px] px-2 space-y-3">
        <div className="flex items-center justify-between mb-2 text-xs text-gray-200">
          <span>时间轴</span>
          <span>
            帧 {currentFrame + 1} / {displayedTotalFrames}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() =>
              onCurrentFrameChange(Math.max(0, currentFrame - 1))
            }
            disabled={currentFrame === 0}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            上一帧
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, displayedTotalFrames - 1)}
            value={currentFrame}
            onChange={e => {
              const value = parseInt(e.target.value, 10);
              if (!Number.isNaN(value)) {
                onCurrentFrameChange(value);
              }
            }}
            className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
          <button
            onClick={() =>
              onCurrentFrameChange(
                Math.min(displayedTotalFrames - 1, currentFrame + 1),
              )
            }
            disabled={currentFrame >= displayedTotalFrames - 1}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            下一帧
          </button>
        </div>

        {/* 自动分析控制 */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">🎯 自动批量分析</span>
            <span className={`text-xs px-2 py-1 rounded ${isAutoAnalyzing ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
              {isAutoAnalyzing ? '分析中...' : '就绪'}
            </span>
          </div>

          <div className="flex items-center space-x-3 mb-2">
            <div className="flex-1">
              <label className="flex items-center justify-between text-xs mb-1">
                <span>分析帧数</span>
                <span className="text-gray-400">{autoAnalysisFrames}</span>
              </label>
              <input
                type="number"
                min="1"
                max={Math.max(1, displayedTotalFrames - currentFrame - 1)}
                value={autoAnalysisFrames}
                onChange={e => {
                  const value = parseInt(e.target.value, 10);
                  const maxValue = Math.max(1, displayedTotalFrames - currentFrame - 1);
                  if (!Number.isNaN(value) && value > 0 && value <= maxValue) {
                    onAutoAnalysisFramesChange(value);
                  }
                }}
                className="w-full h-8 bg-gray-700 border border-gray-600 rounded text-xs px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAutoAnalyzing}
              />
              <div className="text-xs text-gray-500 mt-1">
                从当前帧开始连续分析帧数 (1-{Math.max(1, displayedTotalFrames - currentFrame - 1)})
              </div>
            </div>

            <button
              onClick={onStartAutoAnalysis}
              disabled={isAutoAnalyzing || !currentVideo || currentFrame >= displayedTotalFrames - 1}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors duration-200 flex items-center space-x-2 h-8"
              title={!currentVideo ? "请先上传视频" : currentFrame >= displayedTotalFrames - 1 ? "已到视频末尾" : isAutoAnalyzing ? "分析进行中" : "开始自动批量分析"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isAutoAnalyzing ? '分析中...' : '遵循指令'}</span>
            </button>
          </div>

          <div className="text-xs text-gray-400">
            <p>🔄 自动执行流程：ROI移至中心点 → 下一帧 → 开始分析 → ROI移至中心点 → 循环</p>
            <p>🚫 空mask处理：如果某帧没有检测到连通域，ROI保持不变，继续下一帧</p>
            <p>⚡ 提示：确保已设置好算法参数并启用自动分析功能</p>
          </div>
        </div>
      </div>
    </div>
  );
};