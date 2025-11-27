import React from 'react';
import { EllipticalMorphParams, Point2D, ProcessingMode } from '../../types/algorithm';

interface EllipticalMorphControlsProps {
  params: EllipticalMorphParams;
  autoAnalysisEnabled: boolean;
  selectedPoint: Point2D | null;
  isPointSelectionMode: boolean;
  onParamsChange: (params: EllipticalMorphParams) => void;
  onAutoAnalysisChange: (enabled: boolean) => void;
  onPointSelectModeChange: (enabled: boolean) => void;
  onSelectedPointChange: (point: Point2D | null) => void;
}

export const EllipticalMorphControls: React.FC<EllipticalMorphControlsProps> = ({
  params,
  autoAnalysisEnabled,
  selectedPoint,
  isPointSelectionMode,
  onParamsChange,
  onAutoAnalysisChange,
  onPointSelectModeChange,
  onSelectedPointChange,
}) => {
  const updateParam = (key: keyof EllipticalMorphParams, value: number | boolean | ProcessingMode) => {
    onParamsChange({
      ...params,
      [key]: value,
    });
  };

  // 处理模式切换函数
  const handleProcessingModeChange = (mode: ProcessingMode) => {
    onParamsChange({
      ...params,
      processingMode: mode,
    });

    // 如果选择了"选中点连通域检测"且没有选中点，自动进入点选择模式
    if (mode === ProcessingMode.SELECTED_POINT_CONNECTED && !selectedPoint) {
      onPointSelectModeChange(true);
    } else if (mode !== ProcessingMode.SELECTED_POINT_CONNECTED && isPointSelectionMode) {
      // 如果不是选中点模式且当前在点选择模式，退出点选择模式
      onPointSelectModeChange(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium mb-2">阈值分割参数</h3>

        {/* 自动分析控制 */}
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

        {/* 阈值范围控制 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">阈值范围: [{params.thresholdMin}, {params.thresholdMax}]</label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>最小值</span>
                <span>{params.thresholdMin}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={params.thresholdMin}
                onChange={e => updateParam('thresholdMin', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>最大值</span>
                <span>{params.thresholdMax}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
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
        </div>

        {/* 处理模式选择 - 单选按钮组 */}
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-3 text-gray-300">🎛️ 处理模式（单选）</h4>
          <div className="space-y-2">
            {/* 直接显示原始mask */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.DIRECT_RAW_MASK
                ? 'bg-purple-800 bg-opacity-40 border-purple-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.DIRECT_RAW_MASK}
                    onChange={() => handleProcessingModeChange(ProcessingMode.DIRECT_RAW_MASK)}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">🎬 直接显示原始mask</span>
                    <div className="text-xs text-gray-400">阈值分析后直接显示，不做后处理</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.DIRECT_RAW_MASK
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.DIRECT_RAW_MASK ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.DIRECT_RAW_MASK && (
                <div className="text-xs text-purple-300 mt-2 ml-7">
                  • 阈值分割后的mask直接显示<br/>
                  • 跳过所有连通域分析和筛选<br/>
                  • 适用于验证阈值设置和调试分析
                </div>
              )}
            </div>

            {/* 图像预处理 */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.IMAGE_PREPROCESSING
                ? 'bg-blue-800 bg-opacity-40 border-blue-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.IMAGE_PREPROCESSING}
                    onChange={() => handleProcessingModeChange(ProcessingMode.IMAGE_PREPROCESSING)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">🔧 图像预处理</span>
                    <div className="text-xs text-gray-400">高斯模糊 + CLAHE增强</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.IMAGE_PREPROCESSING
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.IMAGE_PREPROCESSING ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.IMAGE_PREPROCESSING && (
                <div className="text-xs text-blue-300 mt-2 ml-7">
                  • 对图像进行高斯模糊和CLAHE增强<br/>
                  • 然后进行阈值分割（传统模式）<br/>
                  • 适用于一般图像增强和噪声抑制
                </div>
              )}
            </div>

            {/* 最大连通区域检测 */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.MAX_CONNECTED_COMPONENT
                ? 'bg-green-800 bg-opacity-40 border-green-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.MAX_CONNECTED_COMPONENT}
                    onChange={() => handleProcessingModeChange(ProcessingMode.MAX_CONNECTED_COMPONENT)}
                    className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 focus:ring-green-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">🔗 最大连通区域检测</span>
                    <div className="text-xs text-gray-400">只保留最大的连通区域</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.MAX_CONNECTED_COMPONENT
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.MAX_CONNECTED_COMPONENT ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.MAX_CONNECTED_COMPONENT && (
                <div className="text-xs text-green-300 mt-2 ml-7">
                  • 只保留mask中最大的连通区域<br/>
                  • 删除其他小的连通区域<br/>
                  • 适用于去除噪声和保留主要目标
                </div>
              )}
            </div>

            {/* ROI中心点连通域检测 */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.ROI_CENTER_CONNECTED
                ? 'bg-orange-800 bg-opacity-40 border-orange-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.ROI_CENTER_CONNECTED}
                    onChange={() => handleProcessingModeChange(ProcessingMode.ROI_CENTER_CONNECTED)}
                    className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">🎯 ROI中心点连通域检测</span>
                    <div className="text-xs text-gray-400">保留ROI中心点所在区域</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.ROI_CENTER_CONNECTED
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.ROI_CENTER_CONNECTED ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.ROI_CENTER_CONNECTED && (
                <div className="text-xs text-orange-300 mt-2 ml-7">
                  • 只保留ROI中心点所在的连通区域<br/>
                  • 删除其他区域<br/>
                  • 适用于ROI中心目标明确的情况
                </div>
              )}
            </div>

            {/* 直接显示原始mask + ROI中心点连通域检测 */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER
                ? 'bg-yellow-800 bg-opacity-40 border-yellow-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER}
                    onChange={() => handleProcessingModeChange(ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER)}
                    className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 focus:ring-yellow-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">🎯 直接显示原始mask + ROI中心点筛选</span>
                    <div className="text-xs text-gray-400">在原始mask基础上筛选ROI中心区域</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER && (
                <div className="text-xs text-yellow-300 mt-2 ml-7">
                  • 先进行阈值分割得到原始mask<br/>
                  • 然后筛选出ROI中心点所在的连通域<br/>
                  • 以原始mask格式显示最终结果<br/>
                  • 无形态学处理，保持原始特征
                </div>
              )}
            </div>

            {/* 直接显示原始mask + 最大连通区域检测 */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED
                ? 'bg-teal-800 bg-opacity-40 border-teal-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED}
                    onChange={() => handleProcessingModeChange(ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED)}
                    className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 focus:ring-teal-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">🔗 直接显示原始mask + 最大连通区域检测</span>
                    <div className="text-xs text-gray-400">在原始mask基础上筛选最大区域</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED && (
                <div className="text-xs text-teal-300 mt-2 ml-7">
                  • 先进行阈值分割得到原始mask<br/>
                  • 然后筛选出mask中最大的连通区域<br/>
                  • 以原始mask格式显示最终结果<br/>
                  • 无形态学处理，保持原始特征
                </div>
              )}
            </div>

            {/* 选中点连通域检测 */}
            <div className={`p-3 rounded-lg border transition-all duration-200 ${
              params.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED
                ? 'bg-pink-800 bg-opacity-40 border-pink-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="processingMode"
                    checked={params.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED}
                    onChange={() => handleProcessingModeChange(ProcessingMode.SELECTED_POINT_CONNECTED)}
                    className="w-4 h-4 text-pink-600 bg-gray-700 border-gray-600 focus:ring-pink-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium">📍 选中点连通域检测</span>
                    <div className="text-xs text-gray-400">保留选中点所在区域</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  params.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {params.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED ? '已选择' : '可选'}
                </span>
              </label>
              {params.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED && (
                <div className="text-xs text-pink-300 mt-2 ml-7">
                  • 只保留选中点所在的最大连通区域<br/>
                  • 需要在ROI内选择关键点
                </div>
              )}

              {/* 选中点连通域检测的附加控制 */}
              {params.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED && (
                <div className="mt-3 ml-7 space-y-2">
                  <button
                    onClick={() => {
                      onPointSelectModeChange(!isPointSelectionMode);
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
                  <div className="text-xs text-gray-300">
                    <p>{isPointSelectionMode
                      ? '现在点击ROI区域内的任意位置选择关键点'
                      : '点击按钮进入选择模式，或按住Shift键点击ROI区域选择点'
                    }</p>
                    <p className="mt-1">
                      当前选中点: {selectedPoint ? `(${selectedPoint.x}, ${selectedPoint.y})` : '请点击ROI选择点'}
                      {selectedPoint && (
                        <button
                          onClick={() => onSelectedPointChange(null)}
                          className="ml-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                        >
                          清除选中点
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};