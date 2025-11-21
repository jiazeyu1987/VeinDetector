import React from 'react';
import { EllipticalMorphParams, Point2D, ConnectedComponentOptions } from '../../types/algorithm';

interface EllipticalMorphControlsProps {
  params: EllipticalMorphParams;
  autoAnalysisEnabled: boolean;
  connectedComponentOptions: ConnectedComponentOptions;
  selectedPoint: Point2D | null;
  isPointSelectionMode: boolean;
  onParamsChange: (params: EllipticalMorphParams) => void;
  onAutoAnalysisChange: (enabled: boolean) => void;
  onConnectedComponentChange: (options: ConnectedComponentOptions) => void;
  onPointSelectModeChange: (enabled: boolean) => void;
  onSelectedPointChange: (point: Point2D | null) => void;
}

export const EllipticalMorphControls: React.FC<EllipticalMorphControlsProps> = ({
  params,
  autoAnalysisEnabled,
  connectedComponentOptions,
  selectedPoint,
  isPointSelectionMode,
  onParamsChange,
  onAutoAnalysisChange,
  onConnectedComponentChange,
  onPointSelectModeChange,
  onSelectedPointChange,
}) => {
  const updateParam = (key: keyof EllipticalMorphParams, value: number) => {
    onParamsChange({
      ...params,
      [key]: value,
    });
  };

  const handleMaxConnectedComponentChange = (enabled: boolean) => {
    onConnectedComponentChange({
      ellipticalConstraintEnabled: connectedComponentOptions.ellipticalConstraintEnabled,
      maxConnectedComponentEnabled: enabled,
      roiCenterConnectedComponentEnabled: false,
      selectedPointConnectedComponentEnabled: false,
    });
  };

  const handleRoiCenterConnectedComponentChange = (enabled: boolean) => {
    onConnectedComponentChange({
      ellipticalConstraintEnabled: connectedComponentOptions.ellipticalConstraintEnabled,
      maxConnectedComponentEnabled: false,
      roiCenterConnectedComponentEnabled: enabled,
      selectedPointConnectedComponentEnabled: false,
    });
  };

  const handleSelectedPointConnectedComponentChange = (enabled: boolean) => {
    onConnectedComponentChange({
      ellipticalConstraintEnabled: connectedComponentOptions.ellipticalConstraintEnabled,
      maxConnectedComponentEnabled: false,
      roiCenterConnectedComponentEnabled: false,
      selectedPointConnectedComponentEnabled: enabled,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium mb-2">阈值分割参数</h3>
        <div className="mb-4 p-3 bg-blue-600 bg-opacity-20 border border-blue-500 rounded">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoAnalysisEnabled}
                onChange={e => onAutoAnalysisChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium">🤖 参数改变时自动分析</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${autoAnalysisEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
              {autoAnalysisEnabled ? '已启用' : '已禁用'}
            </span>
          </label>
          <p className="text-xs text-gray-400 mt-2 ml-6">
            启用后，参数改变会在500ms后自动触发重新分析
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="text-xs text-gray-400 mb-1">阈值区间选择</h4>
            <div className="mb-2">
              <label className="flex items-center justify-between text-xs mb-1">
                <span>阈值下限</span>
                <span className="text-gray-400">{params.thresholdMin}</span>
              </label>
              <input
                type="range"
                min={0}
                max={255}
                step={1}
                value={params.thresholdMin}
                onChange={e => updateParam('thresholdMin', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>255</span>
              </div>
            </div>
            <div className="mb-2">
              <label className="flex items-center justify-between text-xs mb-1">
                <span>阈值上限</span>
                <span className="text-gray-400">{params.thresholdMax}</span>
              </label>
              <input
                type="range"
                min={0}
                max={255}
                step={1}
                value={params.thresholdMax}
                onChange={e => updateParam('thresholdMax', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>255</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-green-600 bg-opacity-20 border border-green-500 rounded">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={connectedComponentOptions.maxConnectedComponentEnabled}
                  onChange={e => handleMaxConnectedComponentChange(e.target.checked)}
                  className="h-4 w-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                />
                <span className="text-sm font-medium">🔗 最大连通区域检测</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${connectedComponentOptions.maxConnectedComponentEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                {connectedComponentOptions.maxConnectedComponentEnabled ? '已启用' : '已禁用'}
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-2 ml-6">
              启用后，只保留mask中最大的连通区域，删除其他区域
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={connectedComponentOptions.roiCenterConnectedComponentEnabled}
                  onChange={e => handleRoiCenterConnectedComponentChange(e.target.checked)}
                  className="h-4 w-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                />
                <span className="text-sm font-medium">🎯 ROI中心点连通域检测</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${connectedComponentOptions.roiCenterConnectedComponentEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                {connectedComponentOptions.roiCenterConnectedComponentEnabled ? '已启用' : '已禁用'}
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-2 ml-6">
              启用后，只保留ROI中心点所在的连通区域，删除其他区域
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={connectedComponentOptions.selectedPointConnectedComponentEnabled}
                  onChange={e => {
                    handleSelectedPointConnectedComponentChange(e.target.checked);
                    if (e.target.checked && !selectedPoint) {
                      // 可以在这里添加进入点选择模式的逻辑
                    }
                  }}
                  className="h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                />
                <span className="text-sm font-medium">📍 选中点连通域检测</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${connectedComponentOptions.selectedPointConnectedComponentEnabled ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                {connectedComponentOptions.selectedPointConnectedComponentEnabled ? '已启用' : '已禁用'}
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-2 ml-6">
              启用后，点击ROI选择点，只保留该点所在的最大连通区域
            </p>

            {connectedComponentOptions.selectedPointConnectedComponentEnabled && (
              <div className="mt-3 ml-6">
                <button
                  onClick={() => {
                    onPointSelectModeChange(!isPointSelectionMode);
                    if (!isPointSelectionMode) {
                      setTimeout(() => {
                        alert('🎯 已进入点选择模式！\n\n请在ROI区域内点击您想要分析的关键点位置。\n\n提示：您也可以按住Shift键点击ROI区域进行选择。');
                      }, 100);
                    }
                  }}
                  className={`px-3 py-2 text-white text-sm rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                    isPointSelectionMode
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <span>{isPointSelectionMode ? '✅ 点选择模式已开启' : '🎯 选择关键点'}</span>
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  {isPointSelectionMode
                    ? '现在点击ROI区域内的任意位置选择关键点'
                    : '点击按钮进入选择模式，或按住Shift键点击ROI区域选择点'
                  }
                </p>
              </div>
            )}

            {connectedComponentOptions.selectedPointConnectedComponentEnabled && (
              <div className="mt-2 ml-6 text-xs text-gray-300">
                当前选中点: {selectedPoint ? `(${selectedPoint.x}, ${selectedPoint.y})` : '请点击ROI选择点'}
                {selectedPoint && (
                  <button
                    onClick={() => onSelectedPointChange(null)}
                    className="ml-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                  >
                    清除选中点
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};