import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Square, Trash2 } from 'lucide-react';
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
  const [canDraw, setCanDraw] = useState(false);

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
      const point = getCanvasCoordinates(e);
      if (currentROI) {
        const handleIndex = getHandleAtPoint(point.x, point.y, currentROI);
        if (handleIndex !== null) {
          setIsResizing(true);
          setActiveHandle(getHandlePositions(currentROI)[handleIndex].position);
          setDraggedHandle(handleIndex);
          return;
        }
        if (isPointInROI(point.x, point.y, currentROI)) {
          setIsDragging(true);
          setStartPoint(point);
          return;
        }
      }
      if (!canDraw) {
        return;
      }
      setIsDrawing(true);
      setStartPoint(point);
      setCurrentPoint(point);
    },
    [getCanvasCoordinates, currentROI, getHandleAtPoint, getHandlePositions, isPointInROI, canDraw],
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
        setCanDraw(false);
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
      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.fillRect(roi.x, roi.y, roi.width, roi.height);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
      const handles = getHandlePositions(roi);
      ctx.fillStyle = '#3b82f6';
      handles.forEach(handle => {
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    },
    [getHandlePositions],
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
    if (currentROI) {
      drawROI(ctx, currentROI);
    }
    if (isDrawing) {
      drawCreatingROI(ctx);
    }
  }, [currentROI, isDrawing, drawROI, drawCreatingROI]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
  }, [imageWidth, imageHeight, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getMouseCursor = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [currentROI, getCanvasCoordinates, getHandleAtPoint, getHandlePositions, isPointInROI],
  );

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-4 left-4 z-10 flex space-x-2">
        <button
          onClick={() => {
            if (currentROI) {
              onROIClear();
              setCanDraw(false);
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
            onROIClear();
            setIsDrawing(false);
            setStartPoint(null);
            setCurrentPoint(null);
            setCanDraw(true);
          }}
          className={`px-3 py-1 ${
            canDraw ? 'bg-green-500 hover:bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
          } text-white rounded text-sm flex items-center space-x-1 transition-colors`}
          title="绘制ROI"
        >
          <Square size={14} />
          <span>绘制ROI</span>
        </button>
        <button
          onClick={() => {
            if (currentROI) {
              const newROI: ROI = {
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
      {currentROI && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
          <div>ROI信息:</div>
          <div>
            位置: ({Math.round(currentROI.x)}, {Math.round(currentROI.y)})
          </div>
          <div>
            尺寸: {Math.round(currentROI.width)} × {Math.round(currentROI.height)}
          </div>
          <div>面积: {Math.round(currentROI.width * currentROI.height)} 像素²</div>
        </div>
      )}
      <div
        ref={containerRef}
        className="relative w-full h-full border border-gray-600 rounded"
        style={{ cursor: getMouseCursor({} as React.MouseEvent) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
          {!currentROI && !isDrawing ? (
            <div>点击“绘制ROI”按钮后，在视频区域点击并拖拽来绘制ROI</div>
          ) : isDrawing ? (
            <div>释放鼠标完成绘制</div>
          ) : (
            <div>
              <div>拖拽ROI来移动位置</div>
              <div>拖拽控制点来调整大小</div>
              <div>点击“绘制ROI”按钮重新绘制</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
