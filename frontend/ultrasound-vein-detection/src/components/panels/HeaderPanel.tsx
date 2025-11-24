import React from 'react';
import { Upload, Settings, BarChart3, FileVideo } from 'lucide-react';
import { VideoInfo } from '../../api/types';

interface HeaderPanelProps {
  currentVideo: VideoInfo | null;
  segmentationModel: string;
  isAnalyzing: boolean;
  analysisProgress: number;
  showSegmentationOverlay: boolean;
  showSettingsPanel: boolean;
  error: string | null;
  onFileUpload: (file: File) => void;
  onModelChange: (model: string) => void;
  onStartAnalysis: () => void;
  onToggleSegmentationOverlay: () => void;
  onToggleSettingsPanel: () => void;
  onClearError: () => void;
  testMode: boolean;
  onToggleTestMode: () => void;
  // 自动分析相关
  currentFrame: number;
  displayedTotalFrames: number;
  autoAnalysisFrames: number;
  isAutoAnalyzing: boolean;
  onAutoAnalysisFramesChange: (frames: number) => void;
  onStartAutoAnalysis: () => void;
}

export const HeaderPanel: React.FC<HeaderPanelProps> = ({
  currentVideo,
  segmentationModel,
  isAnalyzing,
  analysisProgress,
  showSegmentationOverlay,
  showSettingsPanel,
  error,
  onFileUpload,
  onModelChange,
  onStartAnalysis,
  onToggleSegmentationOverlay,
  onToggleSettingsPanel,
  onClearError,
  testMode,
  onToggleTestMode,
  // 自动分析相关
  currentFrame,
  displayedTotalFrames,
  autoAnalysisFrames,
  isAutoAnalyzing,
  onAutoAnalysisFramesChange,
  onStartAutoAnalysis,
}) => {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-blue-400">超声静脉检测系统</h1>
          <button
            onClick={onToggleTestMode}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              testMode
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
            title={testMode ? "退出测试模式" : "进入测试模式"}
          >
            {testMode ? "测试模式" : "普通模式"}
          </button>
          {currentVideo && (
            <div className="text-sm text-gray-300">
              <FileVideo size={16} className="inline mr-1" />
              {currentVideo.name}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded cursor-pointer flex items-center space-x-2 transition-colors">
            <Upload size={16} />
            <span>上传视频</span>
            <input
              type="file"
              accept="video/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onFileUpload(file);
              }}
              className="hidden"
            />
          </label>
          <div className="flex items-center space-x-2 text-sm text-gray-200 mr-2">
            <span>分割模型:</span>
            <select
              value={segmentationModel}
              onChange={e => onModelChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
            >
              <option value="smp_unet_resnet34">
                深度模型 · SMP U-Net (ResNet34)
              </option>
              <option value="cv">传统 CV 分割 (OpenCV · 基础版)</option>
              <option value="cv_enhanced">传统 CV 分割 (Frangi 增强版)</option>
              <option value="cv_simple_center">T1 中心黑区 · 简单 CV</option>
              <option value="elliptical_morph">阈值分割</option>
            </select>
          </div>
          <button
            onClick={onStartAnalysis}
            disabled={!currentVideo || isAnalyzing}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
          >
            <BarChart3 size={16} />
            <span>{isAnalyzing ? `分析中... ${analysisProgress}%` : '开始分析'}</span>
          </button>
          <button
            onClick={onToggleSegmentationOverlay}
            disabled={!showSegmentationOverlay}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
          >
            <span>{showSegmentationOverlay ? '隐藏分割结果' : '显示分割结果'}</span>
          </button>
          {/* 自动分析控制 */}
          <div className="flex items-center space-x-2 text-sm text-gray-200">
            <label className="flex items-center justify-between">
              <span>帧数:</span>
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
                className="w-16 h-8 bg-gray-700 border border-gray-600 rounded text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ml-2"
                disabled={isAutoAnalyzing}
                title={`从当前帧开始连续分析帧数 (1-${Math.max(1, displayedTotalFrames - currentFrame - 1)})`}
              />
            </label>
            <button
              onClick={onStartAutoAnalysis}
              disabled={isAutoAnalyzing || !currentVideo || currentFrame >= displayedTotalFrames - 1}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors duration-200 flex items-center space-x-1"
              title={!currentVideo ? "请先上传视频" : currentFrame >= displayedTotalFrames - 1 ? "已到视频末尾" : isAutoAnalyzing ? "分析进行中" : "开始自动批量分析"}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isAutoAnalyzing ? '分析中' : '遵循指令'}</span>
            </button>
          </div>
          <button
            onClick={onToggleSettingsPanel}
            className={`p-2 rounded transition-colors ${
              showSettingsPanel ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title="参数设置"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3 p-3 bg-red-600 bg-opacity-20 border border-red-600 rounded text-red-200">
          {error}
          <button
            onClick={onClearError}
            className="ml-2 text-red-200 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};