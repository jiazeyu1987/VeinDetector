import React from 'react';
import { Upload, Settings, BarChart3, FileVideo } from 'lucide-react';
import { VideoInfo } from '../../api/types';

interface HeaderPanelProps {
  currentVideo: VideoInfo | null;
  segmentationModel: string;
  isAnalyzing: boolean;
  analysisProgress: number;
  showSegmentationOverlay: boolean;
  showCenterPoints: boolean;
  showSettingsPanel: boolean;
  error: string | null;
  onFileUpload: (file: File) => void;
  onModelChange: (model: string) => void;
  onStartAnalysis: () => void;
  onToggleSegmentationOverlay: () => void;
  onToggleCenterPoints: () => void;
  onToggleSettingsPanel: () => void;
  onClearError: () => void;
  testMode: boolean;
  onToggleTestMode: () => void;
}

export const HeaderPanel: React.FC<HeaderPanelProps> = ({
  currentVideo,
  segmentationModel,
  isAnalyzing,
  analysisProgress,
  showSegmentationOverlay,
  showCenterPoints,
  showSettingsPanel,
  error,
  onFileUpload,
  onModelChange,
  onStartAnalysis,
  onToggleSegmentationOverlay,
  onToggleCenterPoints,
  onToggleSettingsPanel,
  onClearError,
  testMode,
  onToggleTestMode,
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
          <button
            onClick={onToggleCenterPoints}
            disabled={!showCenterPoints}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
          >
            <span>{showCenterPoints ? '隐藏中心点' : '显示中心点'}</span>
          </button>
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