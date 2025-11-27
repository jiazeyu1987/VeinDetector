import React from 'react';
import { Upload, Settings, BarChart3, FileVideo } from 'lucide-react';
import { VideoInfo } from '../../api/types';
import { AutoAnalysisState } from '../../types/algorithm';

interface HeaderPanelProps {
  currentVideo: VideoInfo | null;
  segmentationModel: string;
  isAnalyzing: boolean;
  analysisProgress: number;
  showSegmentationOverlay: boolean;
  showSettingsPanel: boolean;
  error: string | null;
  success: string | null;
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
  autoAnalysisState: AutoAnalysisState;
  autoAnalysisProgress: number;
  autoAnalysisCompletedFrames: number;
  onAutoAnalysisFramesChange: (frames: number) => void;
  onStartAutoAnalysis: () => void;
  onPauseAutoAnalysis: () => void;
  onResumeAutoAnalysis: () => void;
  onStopAutoAnalysis: () => void;
}

export const HeaderPanel: React.FC<HeaderPanelProps> = ({
  currentVideo,
  segmentationModel,
  isAnalyzing,
  analysisProgress,
  showSegmentationOverlay,
  showSettingsPanel,
  error,
  success,
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
  autoAnalysisState,
  autoAnalysisProgress,
  autoAnalysisCompletedFrames,
  onAutoAnalysisFramesChange,
  onStartAutoAnalysis,
  onPauseAutoAnalysis,
  onResumeAutoAnalysis,
  onStopAutoAnalysis,
}) => {
  // 获取按钮状态的辅助函数
  const getAutoAnalysisButtonState = () => {
    switch (autoAnalysisState) {
      case 'running':
        return {
          text: '暂停',
          bgColor: 'bg-orange-600 hover:bg-orange-700',
          title: '暂停自动分析',
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      case 'paused':
        return {
          text: '恢复',
          bgColor: 'bg-green-600 hover:bg-green-700',
          title: '恢复自动分析',
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      default:
        return {
          text: '遵循指令',
          bgColor: 'bg-blue-600 hover:bg-blue-700',
          title: !currentVideo ? "请先上传视频" : currentFrame >= displayedTotalFrames - 1 ? "已到视频末尾" : "开始自动批量分析",
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )
        };
    }
  };

  const buttonState = getAutoAnalysisButtonState();
  const isButtonDisabled = isAutoAnalyzing && autoAnalysisState === 'running' ? false : (isAutoAnalyzing || !currentVideo || currentFrame >= displayedTotalFrames - 1);

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
              onClick={() => {
                if (autoAnalysisState === 'running') {
                  onPauseAutoAnalysis();
                } else if (autoAnalysisState === 'paused') {
                  onResumeAutoAnalysis();
                } else {
                  onStartAutoAnalysis();
                }
              }}
              disabled={isButtonDisabled}
              className={`px-3 py-1 ${buttonState.bgColor} disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors duration-200 flex items-center space-x-1`}
              title={buttonState.title}
            >
              {buttonState.icon}
              <span>{buttonState.text}</span>
            </button>
            {/* 进度显示 */}
            {autoAnalysisState !== 'idle' && (
              <div className="flex items-center space-x-2 ml-3">
                <div className="text-xs text-gray-300">
                  {autoAnalysisCompletedFrames}/{autoAnalysisFrames}帧
                </div>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                    style={{ width: `${autoAnalysisProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  {Math.round(autoAnalysisProgress)}%
                </div>
                {autoAnalysisState === 'paused' && (
                  <button
                    onClick={onStopAutoAnalysis}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                    title="停止分析"
                  >
                    停止
                  </button>
                )}
              </div>
            )}
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
      {success && (
        <div className="mt-3 p-3 bg-green-600 bg-opacity-20 border border-green-600 rounded text-green-200">
          {success}
        </div>
      )}
    </div>
  );
};