import { useState, useCallback, useRef, useEffect } from 'react';
import { ZoomPanState } from '../types/algorithm';

interface UseVideoControlsProps {
  isROIMode: boolean;
}

export const useVideoControls = ({ isROIMode }: UseVideoControlsProps = { isROIMode: false }) => {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleImageWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const delta = e.deltaY;
    const zoomStep = 0.1;
    setZoom(prevZoom => {
      let nextZoom = prevZoom;
      if (delta < 0) {
        nextZoom = prevZoom * (1 + zoomStep);
      } else if (delta > 0) {
        nextZoom = prevZoom * (1 - zoomStep);
      }
      const minZoom = 0.1;
      const maxZoom = 10;
      if (nextZoom < minZoom) nextZoom = minZoom;
      if (nextZoom > maxZoom) nextZoom = maxZoom;
      return nextZoom;
    });
  }, []);

  const handlePanMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || isROIMode) return;
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { x: panX, y: panY };
    },
    [panX, panY, isROIMode],
  );

  const handlePanMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanningRef.current || !panStartRef.current || isROIMode) return;
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanX(panOriginRef.current.x + dx);
      setPanY(panOriginRef.current.y + dy);
    },
    [isROIMode],
  );

  const handlePanMouseUp = useCallback(() => {
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  return {
    zoom,
    panX,
    panY,
    handleImageWheel,
    handlePanMouseDown,
    handlePanMouseMove,
    handlePanMouseUp,
    resetView,
  };
};