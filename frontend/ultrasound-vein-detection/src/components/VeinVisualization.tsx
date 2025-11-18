import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Filter, Settings, Download, TrendingUp } from 'lucide-react';
import { VeinData, VeinDetectionResult } from '../api/types';

interface VeinVisualizationProps {
  imageWidth: number;
  imageHeight: number;
  detectionResult?: VeinDetectionResult;
  visible: boolean;
  onToggleVisibility: () => void;
  showContours: boolean;
  showCenters: boolean;
  onToggleContours: () => void;
  onToggleCenters: () => void;
  confidenceThreshold: number;
  onConfidenceThresholdChange: (threshold: number) => void;
  className?: string;
}

export const VeinVisualization: React.FC<VeinVisualizationProps> = ({
  imageWidth,
  imageHeight,
  detectionResult,
  visible,
  onToggleVisibility,
  showContours,
  showCenters,
  onToggleContours,
  onToggleCenters,
  confidenceThreshold,
  onConfidenceThresholdChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedVein, setSelectedVein] = useState<string | null>(null);
  const [hoveredVein, setHoveredVein] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // 过滤静脉数据
  const filteredVeins = useCallback(() => {
    if (!detectionResult?.veins) return [];
    return detectionResult.veins.filter(vein => vein.confidence >= confidenceThreshold);
  }, [detectionResult, confidenceThreshold]);

  // 绘制静脉轮廓
  const drawVeinContour = useCallback((
    ctx: CanvasRenderingContext2D, 
    vein: VeinData, 
    isSelected: boolean = false,
    isHovered: boolean = false
  ) => {
    if (vein.contour.length === 0) return;

    const isActive = (selectedVein === vein.id) || (hoveredVein === vein.id);

    ctx.strokeStyle = isActive ? '#fbbf24' : '#3b82f6'; // 选中或悬停时显示黄色，否则显示蓝色
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.setLineDash(isActive ? [] : [5, 5]);

    ctx.beginPath();
    const firstPoint = vein.contour[0];
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < vein.contour.length; i++) {
      const point = vein.contour[i];
      ctx.lineTo(point.x, point.y);
    }

    ctx.closePath();
    ctx.stroke();

    // 绘制置信度标签
    if (isActive) {
      ctx.fillStyle = '#000000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${(vein.confidence * 100).toFixed(1)}%`,
        vein.centerX,
        vein.centerY - vein.radius - 10
      );
    }
  }, [selectedVein, hoveredVein]);

  // 绘制静脉中心点
  const drawVeinCenter = useCallback((
    ctx: CanvasRenderingContext2D,
    vein: VeinData,
    isSelected: boolean = false,
    isHovered: boolean = false
  ) => {
    const isActive = (selectedVein === vein.id) || (hoveredVein === vein.id);
    const radius = isActive ? 8 : 6;

    // 外圈
    ctx.fillStyle = isActive ? '#fbbf24' : '#1d4ed8';
    ctx.beginPath();
    ctx.arc(vein.centerX, vein.centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // 内圈
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(vein.centerX, vein.centerY, radius * 0.4, 0, 2 * Math.PI);
    ctx.fill();

    // 绘制半径线
    if (isActive) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(vein.centerX - vein.radius, vein.centerY);
      ctx.lineTo(vein.centerX + vein.radius, vein.centerY);
      ctx.moveTo(vein.centerX, vein.centerY - vein.radius);
      ctx.lineTo(vein.centerX, vein.centerY + vein.radius);
      ctx.stroke();
    }
  }, [selectedVein, hoveredVein]);

  // 绘制静脉信息面板
  const drawVeinInfo = useCallback((
    ctx: CanvasRenderingContext2D,
    vein: VeinData,
    x: number,
    y: number
  ) => {
    const padding = 8;
    const lineHeight = 16;
    const info = [
      `ID: ${vein.id}`,
      `中心: (${Math.round(vein.centerX)}, ${Math.round(vein.centerY)})`,
      `半径: ${Math.round(vein.radius)}px`,
      `置信度: ${(vein.confidence * 100).toFixed(1)}%`
    ];

    // 计算信息面板尺寸
    ctx.font = '11px sans-serif';
    const maxWidth = Math.max(...info.map(text => ctx.measureText(text).width));
    const panelWidth = maxWidth + padding * 2;
    const panelHeight = info.length * lineHeight + padding * 2;

    // 绘制背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, panelWidth, panelHeight);

    // 绘制边框
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, panelWidth, panelHeight);

    // 绘制文本
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    info.forEach((text, index) => {
      ctx.fillText(text, x + padding, y + padding + (index + 1) * lineHeight - 4);
    });
  }, []);

  // 检测鼠标悬停
  const detectHover = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !detectionResult) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imageWidth / rect.width;
    const scaleY = imageHeight / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let foundVein: string | null = null;

    for (const vein of filteredVeins()) {
      // 检查是否在静脉中心点附近
      const centerDistance = Math.sqrt(
        Math.pow(mouseX - vein.centerX, 2) + Math.pow(mouseY - vein.centerY, 2)
      );

      if (centerDistance <= 15) {
        foundVein = vein.id;
        break;
      }

      // 检查是否在静脉轮廓附近
      const contourDistance = vein.contour.reduce((minDist, point) => {
        const distance = Math.sqrt(
          Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2)
        );
        return Math.min(minDist, distance);
      }, Infinity);

      if (contourDistance <= 10) {
        foundVein = vein.id;
        break;
      }
    }

    setHoveredVein(foundVein);
  }, [detectionResult, imageWidth, imageHeight, filteredVeins]);

  // 处理点击事件
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (hoveredVein) {
      setSelectedVein(selectedVein === hoveredVein ? null : hoveredVein);
    } else {
      setSelectedVein(null);
    }
  }, [hoveredVein, selectedVein]);

  // 绘制所有内容
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !visible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制网格
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);

    const gridSize = 50;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 绘制静脉
    const veins = filteredVeins();
    veins.forEach(vein => {
      const isSelected = selectedVein === vein.id;
      const isHovered = hoveredVein === vein.id;

      if (showContours) {
        drawVeinContour(ctx, vein, isSelected, isHovered);
      }

      if (showCenters) {
        drawVeinCenter(ctx, vein, isSelected, isHovered);
      }
    });

    // 绘制选中静脉的信息面板
    if (selectedVein) {
      const selectedVeinData = veins.find(v => v.id === selectedVein);
      if (selectedVeinData) {
        // 在右上角绘制信息面板
        drawVeinInfo(ctx, selectedVeinData, canvas.width - 200, 10);
      }
    }
  }, [
    visible, 
    filteredVeins, 
    showContours, 
    showCenters, 
    selectedVein, 
    hoveredVein, 
    drawVeinContour, 
    drawVeinCenter, 
    drawVeinInfo
  ]);

  // 更新画布大小
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    draw();
  }, [imageWidth, imageHeight, draw]);

  // 重新绘制
  useEffect(() => {
    draw();
  }, [draw]);

  const veins = filteredVeins();
  const totalVeins = detectionResult?.veins.length || 0;
  const avgConfidence = veins.length > 0 
    ? veins.reduce((sum, vein) => sum + vein.confidence, 0) / veins.length 
    : 0;

  return (
    <div className={`relative ${className}`}>
      {/* 工具栏 */}
      <div className="absolute top-4 left-4 z-10 flex space-x-2">
        <button
          onClick={onToggleVisibility}
          className={`px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors ${
            visible 
              ? 'bg-blue-600 hover:bg-blue-500 text-white' 
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title={visible ? '隐藏检测结果' : '显示检测结果'}
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{visible ? '隐藏' : '显示'}</span>
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm flex items-center space-x-1 transition-colors"
          title="设置"
        >
          <Settings size={14} />
          <span>设置</span>
        </button>
      </div>

      {/* 统计信息 */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <TrendingUp size={14} />
            <span>检测统计</span>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div>检测到静脉: {veins.length} / {totalVeins}</div>
          <div>平均置信度: {(avgConfidence * 100).toFixed(1)}%</div>
          <div>当前帧: {detectionResult?.frameIndex || 0}</div>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="absolute top-16 left-4 z-20 bg-gray-800 border border-gray-600 rounded-lg p-4 w-64">
          <h3 className="text-white font-medium mb-3">可视化设置</h3>
          
          <div className="space-y-3">
            {/* 显示轮廓 */}
            <div className="flex items-center justify-between">
              <label className="text-white text-sm">显示轮廓</label>
              <button
                onClick={onToggleContours}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showContours ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showContours ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 显示中心点 */}
            <div className="flex items-center justify-between">
              <label className="text-white text-sm">显示中心点</label>
              <button
                onClick={onToggleCenters}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showCenters ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showCenters ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 置信度阈值 */}
            <div>
              <label className="text-white text-sm block mb-1">
                置信度阈值: {(confidenceThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => onConfidenceThresholdChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* 可视化画布 */}
      <div
        ref={containerRef}
        className="relative w-full h-full border border-gray-600 rounded"
        onMouseMove={detectHover}
        onMouseLeave={() => setHoveredVein(null)}
        onClick={handleClick}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />

        {/* 操作提示 */}
        {visible && (
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
            <div>• 悬停查看静脉信息</div>
            <div>• 点击选中静脉查看详情</div>
            <div>• 使用设置面板调整显示选项</div>
          </div>
        )}

        {!visible && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
            <div className="text-white text-lg">检测结果已隐藏</div>
          </div>
        )}
      </div>
    </div>
  );
};