import React from 'react';
import { EnhancedCVParams } from '../../types/algorithm';

interface EnhancedCVControlsProps {
  params: EnhancedCVParams;
  onChange: (params: EnhancedCVParams) => void;
}

export const EnhancedCVControls: React.FC<EnhancedCVControlsProps> = ({
  params,
  onChange,
}) => {
  const updateParam = (key: keyof EnhancedCVParams, value: number) => {
    onChange({
      ...params,
      [key]: value,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs text-gray-400 mb-1">预处理</h4>
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs">
            <span>模糊核大小</span>
            <input
              type="number"
              min={1}
              step={2}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.blurKernelSize}
              onChange={e => updateParam('blurKernelSize', Number(e.target.value) || 1)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>CLAHE 对比度</span>
            <input
              type="number"
              min={0.5}
              step={0.1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.claheClipLimit}
              onChange={e => updateParam('claheClipLimit', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>CLAHE 网格大小</span>
            <input
              type="number"
              min={2}
              step={1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.claheTileGridSize}
              onChange={e => updateParam('claheTileGridSize', Number(e.target.value) || 1)}
            />
          </label>
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-400 mb-1">Frangi 血管滤波</h4>
        <div className="space-y-1">
          <label className="flex items-center justify-between text-xs">
            <span>尺度最小</span>
            <input
              type="number"
              min={0.5}
              step={0.1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.frangiScaleMin}
              onChange={e => updateParam('frangiScaleMin', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>尺度最大</span>
            <input
              type="number"
              min={params.frangiScaleMin}
              step={0.1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.frangiScaleMax}
              onChange={e => updateParam('frangiScaleMax', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>尺度步长</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.frangiScaleStep}
              onChange={e => updateParam('frangiScaleStep', Number(e.target.value) || 0.1)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>Frangi 阈值</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.frangiThreshold}
              onChange={e => updateParam('frangiThreshold', Number(e.target.value) || 0)}
            />
          </label>
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-400 mb-1">几何与位置筛选</h4>
        <div className="space-y-1">
          <label className="flex items-center justify-between text-xs">
            <span>面积最小</span>
            <input
              type="number"
              min={0}
              step={10}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.areaMin}
              onChange={e => updateParam('areaMin', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>面积最大</span>
            <input
              type="number"
              min={params.areaMin}
              step={10}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.areaMax}
              onChange={e => updateParam('areaMax', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>长宽比最小</span>
            <input
              type="number"
              min={0}
              step={0.1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.aspectRatioMin}
              onChange={e => updateParam('aspectRatioMin', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>长宽比最大</span>
            <input
              type="number"
              min={params.aspectRatioMin}
              step={0.1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.aspectRatioMax}
              onChange={e => updateParam('aspectRatioMax', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>中心带顶部(0–1)</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.centerBandTop}
              onChange={e => updateParam('centerBandTop', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>中心带底部(0–1)</span>
            <input
              type="number"
              min={params.centerBandTop}
              max={1}
              step={0.05}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.centerBandBottom}
              onChange={e => updateParam('centerBandBottom', Number(e.target.value) || 0)}
            />
          </label>
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-400 mb-1">形态学</h4>
        <div className="space-y-1">
          <label className="flex items-center justify-between text-xs">
            <span>核大小</span>
            <input
              type="number"
              min={1}
              step={2}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.morphKernelSize}
              onChange={e => updateParam('morphKernelSize', Number(e.target.value) || 1)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>闭运算迭代</span>
            <input
              type="number"
              min={0}
              step={1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.morphCloseIterations}
              onChange={e => updateParam('morphCloseIterations', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>开运算迭代</span>
            <input
              type="number"
              min={0}
              step={1}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.morphOpenIterations}
              onChange={e => updateParam('morphOpenIterations', Number(e.target.value) || 0)}
            />
          </label>
        </div>
      </div>
    </div>
  );
};