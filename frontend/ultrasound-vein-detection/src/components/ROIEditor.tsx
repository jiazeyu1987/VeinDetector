import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ROI } from '../api/types';

interface ROIEditorProps {
  imageWidth: number;
  imageHeight: number;
  currentROI?: ROI;
  onROIChange: (roi: ROI) => void;
  onROIClear: () => void;
  onPointSelect?: (point: {x: number, y: number}) => void; // 点击ROI选择点的回调
  className?: string;
  enabled?: boolean;
  showROIBorder?: boolean; // 是否只显示边框（不显示填充和控制点）
  showCenterPoints?: boolean; // 是否显示ROI中心采样点
  centerPoints?: Array<{x: number, y: number, label: string, inMask?: boolean}>; // 中心点信息
  selectedPoint?: {x: number, y: number} | null; // 用户选中的点坐标
  enablePointSelection?: boolean; // 是否启用点选择功能
  isPointSelectionMode?: boolean; // 是否处于点选择模式（直接点击选择点）
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
  onPointSelect,
  className = '',
  enabled = true,
  showROIBorder = true,
  showCenterPoints = false,
  centerPoints = [],
  selectedPoint = null,
  enablePointSelection = false,
  isPointSelectionMode = false,
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
  const [isROIHidden, setIsROIHidden] = useState(false);

  const getCanvasCoordinates = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = imageWidth / rect.width;
      const scaleY = imageHeight / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [imageWidth, imageHeight],
  );

  const getHandlePositions = useCallback((roi: ROI): HandlePosition[] => {
    const { x, y, width, height } = roi;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return [
      { x, y, cursor: 'nw-resize', position: 'nw' },
      { x: cx, y, cursor: 'n-resize', position: 'n' },
      { x: x + width, y, cursor: 'ne-resize', position: 'ne' },
      { x: x + width, y: cy, cursor: 'e-resize', position: 'e' },
      { x: x + width, y: y + height, cursor: 'se-resize', position: 'se' },
      { x: cx, y: y + height, cursor: 's-resize', position: 's' },
      { x, y: y + height, cursor: 'sw-resize', position: 'sw' },
      { x, y: cy, cursor: 'w-resize', position: 'w' },
    ];
  }, []);

  const getHandleAtPoint = useCallback(
    (x: number, y: number, roi: ROI): number | null => {
      const handleSize = 8;
      const handles = getHandlePositions(roi);
      for (let i = 0; i < handles.length; i += 1) {
        const handle = handles[i];
        if (Math.abs(x - handle.x) <= handleSize && Math.abs(y - handle.y) <= handleSize) {
          return i;
        }
      }
      return null;
    },
    [getHandlePositions],
  );

  const isPointInROI = useCallback((x: number, y: number, roi: ROI): boolean => {
    return x >= roi.x && x <= roi.x + roi.width && y >= roi.y && y <= roi.y + roi.height;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) {
        return;
      }

      const point = getCanvasCoordinates(e);
      if (currentROI) {
        // 总是允许调整ROI大小和拖拽，即使边框不显示
        const handleIndex = getHandleAtPoint(point.x, point.y, currentROI);
        if (handleIndex !== null) {
          setIsResizing(true);
          setActiveHandle(getHandlePositions(currentROI)[handleIndex].position);
          setDraggedHandle(handleIndex);
          return;
        }
        if (isPointInROI(point.x, point.y, currentROI)) {
          // 如果启用了点选择功能且按住Shift键，或者处于点选择模式，则选择点而不是拖拽ROI
          if (enablePointSelection && (e.shiftKey || isPointSelectionMode) && onPointSelect) {
            const relativeX = Math.round(point.x - currentROI.x);
            const relativeY = Math.round(point.y - currentROI.y);
            onPointSelect({ x: relativeX, y: relativeY });
            return;
          }
          setIsDragging(true);
          setStartPoint(point);
          return;
        }
      }
      setIsDrawing(true);
      setStartPoint(point);
      setCurrentPoint(point);
    },
    [getCanvasCoordinates, currentROI, getHandleAtPoint, getHandlePositions, isPointInROI, enabled],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
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
        let newROI: ROI = { ...currentROI };
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
          default:
            break;
        }
        if (newROI.width > 0 && newROI.height > 0) {
          newROI.width = Math.min(newROI.width, imageWidth - newROI.x);
          newROI.height = Math.min(newROI.height, imageHeight - newROI.y);
          onROIChange(newROI);
        }
      }
    },
    [
      isDrawing,
      isDragging,
      isResizing,
      startPoint,
      currentROI,
      draggedHandle,
      getCanvasCoordinates,
      imageWidth,
      imageHeight,
      getHandlePositions,
      onROIChange,
    ],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent default context menu
      if (!enabled || !currentROI) return;

      const point = getCanvasCoordinates(e);
      if (isPointInROI(point.x, point.y, currentROI)) {
        // Toggle ROI visibility when right-clicking inside ROI
        setIsROIHidden(prev => !prev);
      }
    },
    [enabled, currentROI, getCanvasCoordinates, isPointInROI],
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing && startPoint && currentPoint) {
      const roi: ROI = {
        id: `roi_${Date.now()}`,
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y),
        frameIndex: 0,
      };
      if (roi.width > 10 && roi.height > 10) {
        onROIChange(roi);
        // Show ROI when creating new one
        setIsROIHidden(false);
      }
    }
    setIsDrawing(false);
    setIsDragging(false);
    setIsResizing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setActiveHandle(null);
    setDraggedHandle(null);
  }, [isDrawing, startPoint, currentPoint, onROIChange]);

  const drawROI = useCallback(
    (ctx: CanvasRenderingContext2D, roi: ROI) => {
      // 绘制ROI边框
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

      // 只有在调整大小时显示控制点
      if (isResizing || isDragging) {
        const handles = getHandlePositions(roi);
        ctx.fillStyle = '#3b82f6';
        handles.forEach(handle => {
          ctx.beginPath();
          ctx.arc(handle.x, handle.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    },
    [getHandlePositions, isResizing, isDragging, showROIBorder],
  );

  const drawCenterPoints = useCallback(
    (ctx: CanvasRenderingContext2D, roi: ROI) => {
      if (!showCenterPoints || centerPoints.length === 0) return;

      // 绘制ROI中心采样点
      centerPoints.forEach((point, index) => {
        const x = roi.x + point.x;
        const y = roi.y + point.y;

        // 设置颜色：在mask内的点为绿色，不在的为红色
        if (point.inMask) {
          ctx.fillStyle = '#10b981'; // green-500
          ctx.strokeStyle = '#065f46'; // green-800
        } else {
          ctx.fillStyle = '#ef4444'; // red-500
          ctx.strokeStyle = '#991b1b'; // red-800
        }

        // 绘制圆点
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制标签背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const text = point.label;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 16;
        const padding = 4;

        ctx.fillRect(x + 10, y - textHeight/2, textWidth + padding * 2, textHeight);

        // 绘制标签文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.fillText(text, x + 10 + padding, y + textHeight/4);
      });

      // 绘制十字线到中心点
      if (centerPoints.length > 0) {
        const centerPoint = centerPoints.find(p => p.label === '中心');
        if (centerPoint) {
          const cx = roi.x + centerPoint.x;
          const cy = roi.y + centerPoint.y;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);

          // 水平线
          ctx.beginPath();
          ctx.moveTo(roi.x, cy);
          ctx.lineTo(roi.x + roi.width, cy);
          ctx.stroke();

          // 垂直线
          ctx.beginPath();
          ctx.moveTo(cx, roi.y);
          ctx.lineTo(cx, roi.y + roi.height);
          ctx.stroke();

          ctx.setLineDash([]);
        }
      }
    },
    [showCenterPoints, centerPoints],
  );

  const drawSelectedPoint = useCallback(
    (ctx: CanvasRenderingContext2D, roi: ROI) => {
      if (!selectedPoint || !enablePointSelection) return;

      const x = roi.x + selectedPoint.x;
      const y = roi.y + selectedPoint.y;

      // 绘制选中点（紫色，比其他点更大）
      ctx.fillStyle = '#a855f7'; // purple-500
      ctx.strokeStyle = '#6b21a8'; // purple-800
      ctx.lineWidth = 3;

      // 绘制圆点
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 绘制脉冲效果（虚线圆）
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // 绘制坐标标签
      const text = `(${selectedPoint.x}, ${selectedPoint.y})`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.font = '12px sans-serif';
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = 16;
      const padding = 6;

      ctx.fillRect(x + 15, y - textHeight/2, textWidth + padding * 2, textHeight);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, x + 15 + padding, y + textHeight/4);
    },
    [selectedPoint, enablePointSelection],
  );

  const drawCreatingROI = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!startPoint || !currentPoint) return;
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.y - startPoint.y);
      ctx.strokeRect(x, y, width, height);
    },
    [startPoint, currentPoint],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
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

    // Draw ROI if it exists and showROIBorder is true
    if (currentROI && showROIBorder) {
      drawROI(ctx, currentROI);
      drawCenterPoints(ctx, currentROI);
      drawSelectedPoint(ctx, currentROI);
    }

    if (isDrawing) {
      drawCreatingROI(ctx);
    }
  }, [currentROI, isDrawing, isROIHidden, drawROI, drawCreatingROI, drawCenterPoints, drawSelectedPoint, showROIBorder, selectedPoint, enablePointSelection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    draw();
  }, [imageWidth, imageHeight, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getMouseCursor = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return 'default';
      if (!currentROI) return 'crosshair';
      const point = getCanvasCoordinates(e);
      const handleIndex = getHandleAtPoint(point.x, point.y, currentROI);
      if (handleIndex !== null) {
        return getHandlePositions(currentROI)[handleIndex].cursor;
      }
      if (isPointInROI(point.x, point.y, currentROI)) {
        // 如果处于点选择模式或启用了点选择功能，显示指针光标
        if (enablePointSelection && isPointSelectionMode) {
          return 'pointer';
        }
        // 如果启用了点选择功能但未处于点选择模式，在按Shift键时显示指针光标
        if (enablePointSelection && e.shiftKey) {
          return 'pointer';
        }
        return 'move';
      }
      return 'crosshair';
    },
    [currentROI, getCanvasCoordinates, getHandleAtPoint, getHandlePositions, isPointInROI, enabled, enablePointSelection, isPointSelectionMode],
  );

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="relative w-full h-full border border-gray-600 rounded"
        style={{ cursor: getMouseCursor({} as React.MouseEvent) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
