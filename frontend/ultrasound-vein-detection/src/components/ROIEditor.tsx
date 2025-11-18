import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Square, RotateCcw, Trash2 } from 'lucide-react';
import { ROI } from '../api/types';

interface ROIEditorProps {
  imageWidth: number;
  imageHeight: number;
  currentROI?: ROI;
  onROIChange: (roi: ROI) => void;
  onROIClear: () => void;
  className?: string;
}

interface HandlePosition {
  x: number;
  y: number;
  cursor: string;
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
}

export const ROIEditor: React.FC<ROIEditorProps> = ({
  imageWidth,
  imageHeight,
  currentROI,
  onROIChange,
  onROIClear,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandlePosition['position'] | null>(null);
  const [draggedHandle, setDraggedHandle] = useState<number | null>(null);

  // 获取画布坐标
  const getCanvasCoordinates = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imageWidth / rect.width;
    const scaleY = imageHeight / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [imageWidth, imageHeight]);

  // 获取控制点
  const getHandlePositions = useCallback((roi: ROI): HandlePosition[] => {
    const { x, y, width, height } = roi;
    const cx = x + width / 2;
    const cy = y + height / 2;
    
    return [
      { x: x, y: y, cursor: 'nw-resize', position: 'nw' },
      { x: cx, y: y, cursor: 'n-resize', position: 'n' },
      { x: x + width, y: y, cursor: 'ne-resize', position: 'ne' },
      { x: x + width, y: cy, cursor: 'e-resize', position: 'e' },
      { x: x + width, y: y + height, cursor: 'se-resize', position: 'se' },
      { x: cx, y: y + height, cursor: 's-resize', position: 's' },
      { x: x, y: y + height, cursor: 'sw-resize', position: 'sw' },
      { x: x, y: cy, cursor: 'w-resize', position: 'w' },
    ];
  }, []);

  // 检查点是否在控制点上
  const getHandleAtPoint = useCallback((x: number, y: number, roi: ROI): number | null => {
    const handleSize = 8;
    const handles = getHandlePositions(roi);
    
    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      if (
        Math.abs(x - handle.x) <= handleSize &&
        Math.abs(y - handle.y) <= handleSize
      ) {
        return i;
      }
    }
    return null;
  }, [getHandlePositions]);

  // 检查点是否在ROI内
  const isPointInROI = useCallback((x: number, y: number, roi: ROI): boolean => {
    return (
      x >= roi.x &&
      x <= roi.x + roi.width &&
      y >= roi.y &&
      y <= roi.y + roi.height
    );
  }, []);

  // 开始绘制新的ROI
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = getCanvasCoordinates(e);
    
    if (currentROI) {
      // 检查是否点击了控制点
      const handleIndex = getHandleAtPoint(point.x, point.y, currentROI);
      if (handleIndex !== null) {
        setIsResizing(true);
        setActiveHandle(getHandlePositions(currentROI)[handleIndex].position);
        setDraggedHandle(handleIndex);
        return;
      }
      
      // 检查是否点击了ROI内部（用于拖拽）
      if (isPointInROI(point.x, point.y, currentROI)) {
        setIsDragging(true);
        setStartPoint(point);
        return;
      }
    }
    
    // 开始绘制新的ROI
    setIsDrawing(true);
    setStartPoint(point);
    setCurrentPoint(point);
  }, [getCanvasCoordinates, currentROI, getHandleAtPoint, getHandlePositions, isPointInROI]);

  // 鼠标移动处理
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const point = getCanvasCoordinates(e);
    
    if (isDrawing && startPoint) {
      setCurrentPoint(point);
    } else if (isDragging && startPoint && currentROI) {
      const deltaX = point.x - startPoint.x;
      const deltaY = point.y - startPoint.y;
      
      const newROI: ROI = {
        ...currentROI,
        x: Math.max(0, Math.min(imageWidth - currentROI.width, currentROI.x + deltaX)),
        y: Math.max(0, Math.min(imageHeight - currentROI.height, currentROI.y + deltaY)),
      };
      
      onROIChange(newROI);
      setStartPoint(point);
    } else if (isResizing && draggedHandle !== null && currentROI) {
      const handles = getHandlePositions(currentROI);
      const handle = handles[draggedHandle];
      let newROI = { ...currentROI };
      
      switch (handle.position) {
        case 'nw':
          newROI.width = currentROI.x + currentROI.width - point.x;
          newROI.height = currentROI.y + currentROI.height - point.y;
          newROI.x = Math.max(0, point.x);
          newROI.y = Math.max(0, point.y);
          break;
        case 'n':
          newROI.height = currentROI.y + currentROI.height - point.y;
          newROI.y = Math.max(0, point.y);
          break;
        case 'ne':
          newROI.width = point.x - currentROI.x;
          newROI.height = currentROI.y + currentROI.height - point.y;
          newROI.y = Math.max(0, point.y);
          break;
        case 'e':
          newROI.width = point.x - currentROI.x;
          break;
        case 'se':
          newROI.width = point.x - currentROI.x;
          newROI.height = point.y - currentROI.y;
          break;
        case 's':
          newROI.height = point.y - currentROI.y;
          break;
        case 'sw':
          newROI.width = currentROI.x + currentROI.width - point.x;
          newROI.x = Math.max(0, point.x);
          newROI.height = point.y - currentROI.y;
          break;
        case 'w':
          newROI.width = currentROI.x + currentROI.width - point.x;
          newROI.x = Math.max(0, point.x);
          break;
      }
      
      // 确保ROI尺寸不为负数
      if (newROI.width > 0 && newROI.height > 0) {
        newROI.width = Math.min(newROI.width, imageWidth - newROI.x);
        newROI.height = Math.min(newROI.height, imageHeight - newROI.y);
        onROIChange(newROI);
      }
    }
  }, [isDrawing, isDragging, isResizing, startPoint, currentROI, draggedHandle, getCanvasCoordinates, imageWidth, imageHeight, getHandlePositions, onROIChange]);

  // 鼠标释放处理
  const handleMouseUp = useCallback(() => {
    if (isDrawing && startPoint && currentPoint) {
      const roi: ROI = {
        id: `roi_${Date.now()}`,
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y),
        frameIndex: 0, // 默认当前帧
      };
      
      if (roi.width > 10 && roi.height > 10) { // 最小ROI尺寸
        onROIChange(roi);
      }
    }
    
    setIsDrawing(false);
    setIsDragging(false);
    setIsResizing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setActiveHandle(null);
    setDraggedHandle(null);
  }, [isDrawing, isDragging, isResizing, startPoint, currentPoint, onROIChange]);

  // 绘制ROI
  const drawROI = useCallback((ctx: CanvasRenderingContext2D, roi: ROI) => {
    ctx.strokeStyle = '#3b82f6'; // 蓝色
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    // 绘制矩形
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
    
    // 绘制控制点
    const handles = getHandlePositions(roi);
    ctx.fillStyle = '#3b82f6';
    
    handles.forEach(handle => {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [getHandlePositions]);

  // 绘制正在创建的ROI
  const drawCreatingROI = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!startPoint || !currentPoint) return;
    
    ctx.strokeStyle = '#6b7280'; // 灰色
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    
    ctx.strokeRect(x, y, width, height);
  }, [startPoint, currentPoint]);

  // 绘制所有
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
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
    
    // 绘制已存在的ROI
    if (currentROI) {
      drawROI(ctx, currentROI);
    }
    
    // 绘制正在创建的ROI
    if (isDrawing) {
      drawCreatingROI(ctx);
    }
  }, [currentROI, isDrawing, drawROI, drawCreatingROI]);

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

  // 鼠标样式
  const getMouseCursor = useCallback((e: React.MouseEvent) => {
    if (!currentROI) return 'crosshair';
    
    const point = getCanvasCoordinates(e);
    const handleIndex = getHandleAtPoint(point.x, point.y, currentROI);
    
    if (handleIndex !== null) {
      return getHandlePositions(currentROI)[handleIndex].cursor;
    }
    
    if (isPointInROI(point.x, point.y, currentROI)) {
      return 'move';
    }
    
    return 'crosshair';
  }, [currentROI, getCanvasCoordinates, getHandleAtPoint, getHandlePositions, isPointInROI]);

  return (
    <div className={`relative ${className}`}>
      {/* 工具栏 */}
      <div className="absolute top-4 left-4 z-10 flex space-x-2">
        <button
          onClick={() => {
            if (currentROI) {
              onROIClear();
            }
          }}
          disabled={!currentROI}
          className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm flex items-center space-x-1 transition-colors"
          title="清除ROI"
        >
          <Trash2 size={14} />
          <span>清除ROI</span>
        </button>
        
        <button
          onClick={() => {
            if (currentROI) {
              // 重置ROI尺寸
              const newROI = {
                ...currentROI,
                width: currentROI.width * 0.8,
                height: currentROI.height * 0.8,
              };
              newROI.x = currentROI.x + (currentROI.width - newROI.width) / 2;
              newROI.y = currentROI.y + (currentROI.height - newROI.height) / 2;
              onROIChange(newROI);
            }
          }}
          disabled={!currentROI}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm flex items-center space-x-1 transition-colors"
          title="缩小ROI"
        >
          <Square size={14} />
          <span>缩小</span>
        </button>
      </div>

      {/* ROI信息 */}
      {currentROI && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
          <div>ROI信息:</div>
          <div>位置: ({Math.round(currentROI.x)}, {Math.round(currentROI.y)})</div>
          <div>尺寸: {Math.round(currentROI.width)} × {Math.round(currentROI.height)}</div>
          <div>面积: {Math.round(currentROI.width * currentROI.height)} 像素²</div>
        </div>
      )}

      {/* ROI编辑画布 */}
      <div
        ref={containerRef}
        className="relative w-full h-full border border-gray-600 rounded"
        style={{ cursor: getMouseCursor({} as React.MouseEvent) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />
        
        {/* 操作提示 */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
          {!currentROI && !isDrawing ? (
            <div>点击并拖拽来绘制ROI</div>
          ) : isDrawing ? (
            <div>释放鼠标完成绘制</div>
          ) : (
            <div>
              <div>• 拖拽ROI来移动位置</div>
              <div>• 拖拽控制点来调整大小</div>
              <div>• 点击其他地方重新绘制</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};