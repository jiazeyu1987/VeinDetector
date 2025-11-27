import React from 'react';
import { DisplayState, GrayscaleInfo } from '../../types/algorithm';
import { EnhancedCVControls } from '../controls/EnhancedCVControls';
import { SimpleCenterControls } from '../controls/SimpleCenterControls';
import { EllipticalMorphControls } from '../controls/EllipticalMorphControls';
import { EnhancedCVParams, SimpleCenterParams, EllipticalMorphParams, Point2D } from '../../types/algorithm';

interface SettingsPanelProps {
  segmentationModel: string;
  displayState: DisplayState;
  grayscaleInfo: GrayscaleInfo;
  frameStep: number;
  enhancedCVParams: EnhancedCVParams;
  simpleCenterParams: SimpleCenterParams;
  simplePreStrength: number;
  simpleMorphStrength: number;
  ellipticalMorphParams: EllipticalMorphParams;
  autoAnalysisEnabled: boolean;
  selectedPoint: Point2D | null;
  isPointSelectionMode: boolean;
  onSegmentationModelChange: (model: string) => void;
  onDisplayStateChange: (state: Partial<DisplayState>) => void;
  onGrayscaleInfoChange: (info: Partial<GrayscaleInfo>) => void;
  onFrameStepChange: (step: number) => void;
  onEnhancedCVParamsChange: (params: EnhancedCVParams) => void;
  onSimpleCenterParamsChange: (params: SimpleCenterParams) => void;
  onSimplePreStrengthChange: (strength: number) => void;
  onSimpleMorphStrengthChange: (strength: number) => void;
  onEllipticalMorphParamsChange: (params: EllipticalMorphParams) => void;
  onAutoAnalysisChange: (enabled: boolean) => void;
  onPointSelectModeChange: (enabled: boolean) => void;
  onSelectedPointChange: (point: Point2D | null) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  segmentationModel,
  displayState,
  grayscaleInfo,
  frameStep,
  enhancedCVParams,
  simpleCenterParams,
  simplePreStrength,
  simpleMorphStrength,
  ellipticalMorphParams,
  autoAnalysisEnabled,
  selectedPoint,
  isPointSelectionMode,
  onSegmentationModelChange,
  onDisplayStateChange,
  onGrayscaleInfoChange,
  onFrameStepChange,
  onEnhancedCVParamsChange,
  onSimpleCenterParamsChange,
  onSimplePreStrengthChange,
  onSimpleMorphStrengthChange,
  onEllipticalMorphParamsChange,
  onAutoAnalysisChange,
  onPointSelectModeChange,
  onSelectedPointChange,
}) => {
  const isEnhancedCV = ['cv_enhanced', 'cv-advanced', 'cv-frangi'].includes(segmentationModel.toLowerCase());

  return (
    <div className="flex-1 p-4 text-sm text-gray-200 space-y-6">
      <div>
        <h3 className="font-medium mb-2">分割参数</h3>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="mr-2">分割模型</span>
            <select
              value={segmentationModel}
              onChange={e => onSegmentationModelChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
            >
              <option value="smp_unet_resnet34">
                深度模型 · SMP U-Net (ResNet34)
              </option>
              <option value="cv">传统 CV 分割 (OpenCV · 基础版)</option>
              <option value="cv_enhanced">
                传统 CV 分割 (Frangi 增强版)
              </option>
              <option value="cv_simple_center">T1 中心黑区 · 简单 CV</option>
              <option value="elliptical_morph">阈值分割</option>
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span className="mr-2">显示分割叠加</span>
            <input
              type="checkbox"
              checked={displayState.showSegmentationOverlay}
              onChange={e => onDisplayStateChange({ showSegmentationOverlay: e.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <div className="border-t border-gray-600 pt-2 mt-2">
            <h4 className="font-medium mb-2 text-xs text-gray-300">灰度值分析</h4>
            <div className="space-y-2">
              <label className="flex items-center justify-between">
                <span className="mr-2 text-xs">显示灰度信息</span>
                <input
                  type="checkbox"
                  checked={grayscaleInfo.showGrayscaleInfo}
                  onChange={e => onGrayscaleInfoChange({ showGrayscaleInfo: e.target.checked })}
                  className="h-3 w-3"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="mr-2 text-xs">自动阈值调整</span>
                <input
                  type="checkbox"
                  checked={grayscaleInfo.autoThresholdEnabled}
                  onChange={e => onGrayscaleInfoChange({ autoThresholdEnabled: e.target.checked })}
                  disabled={!grayscaleInfo.showGrayscaleInfo}
                  className="h-3 w-3"
                />
              </label>
              {grayscaleInfo.currentValue !== null && grayscaleInfo.showGrayscaleInfo && (
                <div className="bg-gray-800 rounded px-2 py-1 text-xs">
                  <div>当前灰度值: {grayscaleInfo.currentValue}/255</div>
                  <div className="text-gray-400">
                    建议阈值: {Math.round(grayscaleInfo.currentValue * 0.8)}
                  </div>
                  {grayscaleInfo.testMode && (
                    <div className="text-orange-400 mt-1">
                      测试模式: 移动鼠标查看不同区域的灰度值
                    </div>
                  )}
                </div>
              )}
              {grayscaleInfo.testMode && (
                <div className="bg-orange-900 bg-opacity-30 border border-orange-600 rounded px-2 py-1 text-xs">
                  <div className="text-orange-300 font-medium mb-1">测试模式说明:</div>
                  <div className="text-orange-200 space-y-1">
                    <div>• 鼠标悬停查看当前像素灰度值</div>
                    <div>• 启用自动阈值会根据灰度值调整参数</div>
                    <div>• 切换到普通模式处理实际视频</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">检测结果可视化</h3>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="mr-2">显示检测结果层</span>
            <input
              type="checkbox"
              checked={displayState.showVisualization}
              onChange={e => onDisplayStateChange({ showVisualization: e.target.checked })}
              className="h-4 w-4"
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span>置信度阈值</span>
              <span>{displayState.confidenceThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={displayState.confidenceThreshold}
              onChange={e => onDisplayStateChange({ confidenceThreshold: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">播放 / 抽帧</h3>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="mr-2">抽帧步长</span>
            <select
              value={frameStep}
              onChange={e => {
                const value = parseInt(e.target.value, 10) || 1;
                onFrameStepChange(value);
              }}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
            >
              <option value={1}>每帧</option>
              <option value={2}>每 2 帧</option>
              <option value={5}>每 5 帧</option>
              <option value={10}>每 10 帧</option>
            </select>
          </label>
        </div>
      </div>

      {isEnhancedCV && (
        <div className="flex-1 p-4 text-sm text-gray-200 space-y-3">
          <div>
            <h3 className="font-medium mb-2">增强 OpenCV 参数</h3>
            <EnhancedCVControls
              params={enhancedCVParams}
              onChange={onEnhancedCVParamsChange}
            />
          </div>
        </div>
      )}

      {segmentationModel.toLowerCase() === 'cv_simple_center' && (
        <div className="flex-1 p-4 text-sm text-gray-200 space-y-3">
          <div>
            <h3 className="font-medium mb-2">T1 中心黑区参数（简单 CV）</h3>
            <SimpleCenterControls
              params={simpleCenterParams}
              simplePreStrength={simplePreStrength}
              simpleMorphStrength={simpleMorphStrength}
              onParamsChange={onSimpleCenterParamsChange}
              onPreStrengthChange={onSimplePreStrengthChange}
              onMorphStrengthChange={onSimpleMorphStrengthChange}
            />
          </div>
        </div>
      )}

      {segmentationModel.toLowerCase() === 'elliptical_morph' && (
        <div className="flex-1 p-4 text-sm text-gray-200 space-y-3">
          <EllipticalMorphControls
            params={ellipticalMorphParams}
            autoAnalysisEnabled={autoAnalysisEnabled}
            selectedPoint={selectedPoint}
            isPointSelectionMode={isPointSelectionMode}
            onParamsChange={onEllipticalMorphParamsChange}
            onAutoAnalysisChange={onAutoAnalysisChange}
            onPointSelectModeChange={onPointSelectModeChange}
            onSelectedPointChange={onSelectedPointChange}
          />
        </div>
      )}
    </div>
  );
};