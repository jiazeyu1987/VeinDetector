import React from 'react';
import { ROI } from '../../api/types';

interface VideoControlsPanelProps {
  currentROI: ROI | null;
  frameStep: number;
  currentFrame: number;
  displayedTotalFrames: number;
  showROIBorder: boolean;
  showGrayscaleInfo: boolean;
  currentGrayscaleValue: number | null;
  testMode: boolean;
  isROIMode: boolean;
  onFrameStepChange: (step: number) => void;
  onCurrentFrameChange: (frame: number) => void;
  onClearROI: () => void;
  onToggleROIMode: () => void;
  onShrinkROI: () => void;
  onToggleROIBorder: () => void;
}

export const VideoControlsPanel: React.FC<VideoControlsPanelProps> = ({
  currentROI,
  frameStep,
  currentFrame,
  displayedTotalFrames,
  showROIBorder,
  showGrayscaleInfo,
  currentGrayscaleValue,
  testMode,
  isROIMode,
  onFrameStepChange,
  onCurrentFrameChange,
  onClearROI,
  onToggleROIMode,
  onShrinkROI,
  onToggleROIBorder,
}) => {
  return (
    <div className="p-4 border-b border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <span>Frame step:</span>
            <select
              value={frameStep}
              onChange={e => {
                const value = parseInt(e.target.value, 10) || 1;
                onFrameStepChange(value);
                onCurrentFrameChange(0);
              }}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
            >
              <option value={1}>Every frame</option>
              <option value={2}>Every 2 frames</option>
              <option value={5}>Every 5 frames</option>
              <option value={10}>Every 10 frames</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={onClearROI}
              disabled={!currentROI}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
            >
              Delete ROI
            </button>
            <button
              onClick={onToggleROIMode}
              className={`px-3 py-1 rounded text-xs text-white transition-colors ${
                isROIMode ? 'bg-green-500 hover:bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Draw ROI
            </button>
            <button
              onClick={onShrinkROI}
              disabled={!currentROI}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
            >
              Shrink ROI
            </button>
            {currentROI && (
              <span className="text-xs bg-blue-600 px-2 py-1 rounded text-white">
                ROI selected
              </span>
            )}

            {currentROI && (
              <button
                onClick={onToggleROIBorder}
                className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-white border border-gray-500 transition-colors duration-150"
                title={showROIBorder ? "隐藏ROI边框" : "显示ROI边框"}
              >
                {showROIBorder ? "👁️ 边框" : "👁️‍🗨️ 边框"}
              </button>
            )}

            {showGrayscaleInfo && currentGrayscaleValue !== null && (
              <span className="text-xs bg-gray-700 px-2 py-1 rounded text-white border border-gray-600">
                灰度: {currentGrayscaleValue}/255
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-300">
            {currentFrame + 1} / {displayedTotalFrames}
          </div>
        </div>
      </div>
    </div>
  );
};