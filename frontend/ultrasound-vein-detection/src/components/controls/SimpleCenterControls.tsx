import React from 'react';
import { SimpleCenterParams } from '../../types/algorithm';

interface SimpleCenterControlsProps {
  params: SimpleCenterParams;
  simplePreStrength: number;
  simpleMorphStrength: number;
  onParamsChange: (params: SimpleCenterParams) => void;
  onPreStrengthChange: (strength: number) => void;
  onMorphStrengthChange: (strength: number) => void;
}

export const SimpleCenterControls: React.FC<SimpleCenterControlsProps> = ({
  params,
  simplePreStrength,
  simpleMorphStrength,
  onParamsChange,
  onPreStrengthChange,
  onMorphStrengthChange,
}) => {
  const updateParam = (key: keyof SimpleCenterParams, value: number) => {
    onParamsChange({
      ...params,
      [key]: value,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs text-gray-400 mb-1">预处理</h4>
        <div className="mb-2">
          <label className="flex items-center justify-between text-xs mb-1">
            <span>预处理严格程度</span>
            <span className="text-gray-400">{simplePreStrength.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={simplePreStrength}
            onChange={e => onPreStrengthChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>宽松</span>
            <span>严格</span>
          </div>
        </div>
        <div className="space-y-1">
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
        <h4 className="text-xs text-gray-400 mb-1">形态学</h4>
        <div className="mb-2">
          <label className="flex items-center justify-between text-xs mb-1">
            <span>形态学严格程度</span>
            <span className="text-gray-400">{simpleMorphStrength.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={simpleMorphStrength}
            onChange={e => onMorphStrengthChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>宽松</span>
            <span>严格</span>
          </div>
        </div>
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
            <span>闭运算次数</span>
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
            <span>开运算次数</span>
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

      <div>
        <h4 className="text-xs text-gray-400 mb-1">候选区域筛选</h4>
        <div className="space-y-1">
          <label className="flex items-center justify-between text-xs">
            <span>面积下限因子</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.areaMinFactor}
              onChange={e => updateParam('areaMinFactor', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>面积上限因子</span>
            <input
              type="number"
              min={params.areaMinFactor}
              max={1}
              step={0.01}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.areaMaxFactor}
              onChange={e => updateParam('areaMaxFactor', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>圆度下限</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
              value={params.circularityMin}
              onChange={e => updateParam('circularityMin', Number(e.target.value) || 0)}
            />
          </label>
        </div>
      </div>
    </div>
  );
};