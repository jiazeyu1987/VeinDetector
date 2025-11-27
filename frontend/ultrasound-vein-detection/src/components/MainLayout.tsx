import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoInfo, ROI, VeinDetectionResult } from '../api/types';
import { apiClient, mockApi } from '../api/client';
import { ConnectedComponentCenter, ProcessingMode } from '../types/algorithm';

// Import extracted components
import { HeaderPanel } from './panels/HeaderPanel';
import { VideoControlsPanel } from './panels/VideoControlsPanel';
import { VideoDisplayPanel } from './panels/VideoDisplayPanel';
import { ResultsPanel } from './panels/ResultsPanel';
import { SettingsPanel } from './panels/SettingsPanel';

// Import custom hooks
import { useVideoControls } from '../hooks/useVideoControls';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useFileDrop } from '../hooks/useFileDrop';

// Import types
import {
  EnhancedCVParams,
  SimpleCenterParams,
  EllipticalMorphParams,
  DisplayState,
  GrayscaleInfo,
  AnalysisState,
  ROIControlState,
  Point2D,
} from '../types/algorithm';

export const MainLayout: React.FC = () => {
  // Core state
  const [currentVideo, setCurrentVideo] = useState<VideoInfo | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentROI, setCurrentROI] = useState<ROI | null>(null);
  const [autoAnalysisFrames, setAutoAnalysisFrames] = useState(10);  // 默认10帧
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const [detectionResults, setDetectionResults] = useState<VeinDetectionResult[]>([]);
  const [currentDetection, setCurrentDetection] = useState<VeinDetectionResult | undefined>();
  const [segmentationMask, setSegmentationMask] = useState<number[][] | null>(null);
  const [analysisCenterPoints, setAnalysisCenterPoints] = useState<Array<{x: number, y: number, label: string, inMask?: boolean}>>([]);

  // UI state
  const [leftPanelSize, setLeftPanelSize] = useState(70);
  const [rightPanelSize, setRightPanelSize] = useState(30);
  const [isResizing, setIsResizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  // Algorithm and analysis state
  const [segmentationModel, setSegmentationModel] = useState('elliptical_morph');
  const [frameStep, setFrameStep] = useState(1);

  // Display state
  const [displayState, setDisplayState] = useState<DisplayState>({
    showSegmentationOverlay: true,
    showCenterPoints: false,
    showVisualization: true,
    showContours: true,
    showCenters: true,
    showGrayscaleInfo: false,
    showSettingsPanel: true,
    showROIBorder: true,
    confidenceThreshold: 0.5,
  });

  // Timeline state
  const [showTimeline, setShowTimeline] = useState(true);

  // Timeline handlers
  const handleToggleTimeline = () => {
    setShowTimeline(!showTimeline);
  };

  // Analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    analysisProgress: 0,
    autoAnalysisEnabled: false,
    autoThresholdEnabled: false,
  });

  // Grayscale info
  const [grayscaleInfo, setGrayscaleInfo] = useState<GrayscaleInfo>({
    currentValue: null,
    showGrayscaleInfo: false,
    autoThresholdEnabled: false,
    testMode: false,
  });

  // ROI control state
  const [roiControlState, setRoiControlState] = useState<ROIControlState>({
    isROIMode: false,
    isPointSelectionMode: false,
    selectedPoint: null,
  });

  // Connected component center state
  const [connectedComponentCenter, setConnectedComponentCenter] = useState<ConnectedComponentCenter | null>(null);

  // Algorithm parameters
  const [enhancedCVParams, setEnhancedCVParams] = useState<EnhancedCVParams>({
    blurKernelSize: 5,
    claheClipLimit: 2.5,
    claheTileGridSize: 8,
    frangiScaleMin: 1.0,
    frangiScaleMax: 3.0,
    frangiScaleStep: 0.5,
    frangiThreshold: 0.08,
    areaMin: 100,
    areaMax: 4000,
    aspectRatioMin: 0.5,
    aspectRatioMax: 2.0,
    centerBandTop: 0.3,
    centerBandBottom: 0.9,
    morphKernelSize: 5,
    morphCloseIterations: 2,
    morphOpenIterations: 1,
  });

  const [simpleCenterParams, setSimpleCenterParams] = useState<SimpleCenterParams>({
    blurKernelSize: 5,
    claheClipLimit: 2.0,
    claheTileGridSize: 8,
    morphKernelSize: 5,
    morphCloseIterations: 2,
    morphOpenIterations: 1,
    areaMinFactor: 0.01,
    areaMaxFactor: 0.4,
    circularityMin: 0.4,
  });

  const [simplePreStrength, setSimplePreStrength] = useState(0.5);
  const [simpleMorphStrength, setSimpleMorphStrength] = useState(0.5);

  const [ellipticalMorphParams, setEllipticalMorphParams] = useState<EllipticalMorphParams>({
    thresholdMin: 50,
    thresholdMax: 127,
    ellipseMajorAxis: 15,
    ellipseMinorAxis: 10,
    ellipseAngle: 0,
    morphStrength: 0.5,
    blurKernelSize: 5,
    claheClipLimit: 2.0,
    claheTileGridSize: 8,
    processingMode: ProcessingMode.DIRECT_RAW_MASK,  // 默认选择直接显示原始mask
    ellipticalConstraintEnabled: false,
  });

  // Custom hooks
  const videoControls = useVideoControls({ isROIMode: roiControlState.isROIMode });
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const autoAnalysisRef = useRef<NodeJS.Timeout | null>(null);

  // File handling
  const revokeBlobUrl = useCallback((url?: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        setError(null);
        const response = await mockApi.uploadVideo(file);
        if (response.success && response.data) {
          revokeBlobUrl(previewUrlRef.current);
          previewUrlRef.current = response.data.videoUrl;
          setCurrentVideo(response.data);
          setCurrentFrame(0);
          setCurrentROI(null);
          setDetectionResults([]);
          setCurrentDetection(undefined);
        } else {
          setError(response.error || '视频上传失败');
        }
      } catch (err) {
        setError('视频上传失败: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [revokeBlobUrl],
  );

  // File drop handling
  const { fileInputProps } = useFileDrop({
    onFileDrop: (files: File[]) => {
      const videoFile = files.find(file => file.type.startsWith('video/'));
      if (videoFile) {
        handleFileUpload(videoFile);
      }
    },
    accept: ['video/*'],
  });

  // Analysis function - returns ConnectedComponentCenter | null
  const startAnalysis = useCallback(async (roiToUse?: ROI): Promise<ConnectedComponentCenter | null> => {
    const analysisROI = roiToUse || currentROI;
    if (!currentVideo || !analysisROI) {
      setError('请先选择视频和ROI区域');
      return null;
    }
    if (!frameCanvasRef.current) {
      setError('当前帧画布尚未准备好，请稍后重试');
      return;
    }
    try {
      setAnalysisState(prev => ({ ...prev, isAnalyzing: true, analysisProgress: 0 }));
      setError(null);

      // 清除之前的连通域中心点
      console.log('🗑️ 开始新分析，清除之前的连通域中心点');
      setConnectedComponentCenter(null);
      setSegmentationMask(null);
      setCurrentDetection(undefined);
      setDetectionResults([]);

      const canvas = frameCanvasRef.current;
      const imageDataUrl = canvas.toDataURL('image/png');
      let parameters: Record<string, number> | undefined;

      const cvName = segmentationModel.toLowerCase();
      if (['cv_enhanced', 'cv-advanced', 'cv-frangi'].includes(cvName)) {
        parameters = {
          blur_kernel_size: enhancedCVParams.blurKernelSize,
          clahe_clip_limit: enhancedCVParams.claheClipLimit,
          clahe_tile_grid_size: enhancedCVParams.claheTileGridSize,
          frangi_scale_min: enhancedCVParams.frangiScaleMin,
          frangi_scale_max: enhancedCVParams.frangiScaleMax,
          frangi_scale_step: enhancedCVParams.frangiScaleStep,
          frangi_threshold: enhancedCVParams.frangiThreshold,
          area_min: enhancedCVParams.areaMin,
          area_max: enhancedCVParams.areaMax,
          aspect_ratio_min: enhancedCVParams.aspectRatioMin,
          aspect_ratio_max: enhancedCVParams.aspectRatioMax,
          center_band_top: enhancedCVParams.centerBandTop,
          center_band_bottom: enhancedCVParams.centerBandBottom,
          morph_kernel_size: enhancedCVParams.morphKernelSize,
          morph_close_iterations: enhancedCVParams.morphCloseIterations,
          morph_open_iterations: enhancedCVParams.morphOpenIterations,
        };
      } else if (cvName === 'cv_simple_center') {
        const v = displayState.confidenceThreshold;
        const areaMinFactor = 0.01 + 0.05 * v;
        const areaMaxFactor = 0.6 - 0.4 * v;
        const circularityMin = 0.2 + 0.6 * v;

        parameters = {
          blur_kernel_size: simpleCenterParams.blurKernelSize,
          clahe_clip_limit: simpleCenterParams.claheClipLimit,
          clahe_tile_grid_size: simpleCenterParams.claheTileGridSize,
          morph_kernel_size: simpleCenterParams.morphKernelSize,
          morph_close_iterations: simpleCenterParams.morphCloseIterations,
          morph_open_iterations: simpleCenterParams.morphOpenIterations,
          area_min_factor: areaMinFactor,
          area_max_factor: areaMaxFactor,
          circularity_min: circularityMin,
        };
      } else if (cvName === 'elliptical_morph') {
        parameters = {
          threshold_min: ellipticalMorphParams.thresholdMin,
          threshold_max: ellipticalMorphParams.thresholdMax,
          ellipse_major_axis: ellipticalMorphParams.ellipseMajorAxis,
          ellipse_minor_axis: ellipticalMorphParams.ellipseMinorAxis,
          ellipse_angle: ellipticalMorphParams.ellipseAngle,
          morph_strength: ellipticalMorphParams.morphStrength,
          blur_kernel_size: ellipticalMorphParams.blurKernelSize,
          clahe_clip_limit: ellipticalMorphParams.claheClipLimit,
          clahe_tile_grid_size: ellipticalMorphParams.claheTileGridSize,
          // 根据processingMode设置相应的后端参数
          preprocessing_enabled: ellipticalMorphParams.processingMode === ProcessingMode.IMAGE_PREPROCESSING ? 1 : 0,
          direct_raw_mask_display: (ellipticalMorphParams.processingMode === ProcessingMode.DIRECT_RAW_MASK || ellipticalMorphParams.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER || ellipticalMorphParams.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED) ? 1 : 0,
          elliptical_constraint_enabled: ellipticalMorphParams.ellipticalConstraintEnabled ? 1 : 0,
          max_connected_component_enabled: (ellipticalMorphParams.processingMode === ProcessingMode.MAX_CONNECTED_COMPONENT || ellipticalMorphParams.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_MAX_CONNECTED) ? 1 : 0,
          roi_center_connected_component_enabled: (ellipticalMorphParams.processingMode === ProcessingMode.ROI_CENTER_CONNECTED || ellipticalMorphParams.processingMode === ProcessingMode.DIRECT_RAW_MASK_WITH_ROI_CENTER) ? 1 : 0,
          selected_point_connected_component_enabled: ellipticalMorphParams.processingMode === ProcessingMode.SELECTED_POINT_CONNECTED ? 1 : 0,
          selected_point_x: roiControlState.selectedPoint?.x || 0,
          selected_point_y: roiControlState.selectedPoint?.y || 0,
        };
      }

      // Debug: Log the ROI object being sent
      console.log('🔍 Sending ROI:', analysisROI);
      console.log('🔍 ROI type:', typeof analysisROI);
      console.log('🔍 ROI keys:', analysisROI ? Object.keys(analysisROI) : 'null');

      const response = await apiClient.segmentCurrentFrame({
        imageDataUrl,
        roi: analysisROI,  // 使用传入的ROI而不是currentROI
        modelName: segmentationModel,
        parameters,
      });

      if (response.success && response.data) {
        setSegmentationMask(response.data.mask);
        if ((response.data as any).centerPoints) {
          setAnalysisCenterPoints((response.data as any).centerPoints);
          setDisplayState(prev => ({ ...prev, showCenterPoints: true }));
        }

        // 处理连通域中心点，自动移动ROI
        if (response.data.connected_component_center && currentROI) {
          const center = response.data.connected_component_center;
          console.log('🎯 检测到连通域中心点:', center);
          console.log('📍 当前ROI:', currentROI);

          // 保存连通域中心点状态，用于绘制
          console.log('🔄 保存连通域中心点到前端状态:', {
            中心点坐标: `(${center.x}, ${center.y})`,
            面积: center.area,
            标签: center.label,
            置信度: center.confidence
          });
          setConnectedComponentCenter(center);

          // 计算连通域中心的画布绝对坐标（仅用于日志记录和显示）
          const absCenterX = currentROI.x + center.x;
          const absCenterY = currentROI.y + center.y;

          console.log('🔄 连通域分析结果（ROI不移动）:');
          console.log('  连通域中心点 (ROI相对坐标):', `(${center.x}, ${center.y})`);
          console.log('  连通域中心点 (画布绝对坐标):', `(${absCenterX}, ${absCenterY})`);
          console.log('  当前ROI位置:', `(${currentROI.x}, ${currentROI.y})`);
          console.log('  当前ROI大小:', `${currentROI.width} x ${currentROI.height}`);
          console.log('  当前ROI中心点:', `(${currentROI.x + currentROI.width/2}, ${currentROI.y + currentROI.height/2})`);
          console.log('  连通域面积:', `${center.area}px²`);
          console.log('📊 ROI保持不变，仅在界面上显示连通域中心点标记');

          // 不显示提示消息，直接在界面上显示中心点
          console.log(`✓ 检测到连通域中心点 (面积: ${center.area}px²)，已在界面上标记`);
        } else {
          // 如果没有连通域中心点，清除现有状态
          console.log('🗑️ 清除连通域中心点状态');
          setConnectedComponentCenter(null);
        }

        // 返回连通域中心点给调用者
        let centerToReturn: ConnectedComponentCenter | null = null;
        if (response.data.connected_component_center) {
          const center = response.data.connected_component_center;

          // 验证连通域中心点数据的合理性
          if (center.x < 0 || center.y < 0 || !center.area || center.area <= 0) {
            console.warn(`⚠️ 连通域中心点数据异常: 坐标(${center.x}, ${center.y}), 面积${center.area}`);
          } else {
            console.log(`✅ 连通域中心点验证通过: ROI相对坐标(${center.x}, ${center.y}), 面积${center.area}px², 置信度${center.confidence}`);
            centerToReturn = center;
          }
        }

        setAnalysisState(prev => ({ ...prev, isAnalyzing: false, analysisProgress: 100 }));
        return centerToReturn;
      } else {
        setError(response.error || response.message || '分析启动失败');
        setAnalysisState(prev => ({ ...prev, isAnalyzing: false }));
        return null;
      }
    } catch (err) {
      setError('分析失败: ' + (err as Error).message);
      setAnalysisState(prev => ({ ...prev, isAnalyzing: false }));
      return null;
    }
  }, [currentVideo, currentROI, segmentationModel, enhancedCVParams, simpleCenterParams, ellipticalMorphParams, displayState.confidenceThreshold, roiControlState.selectedPoint, apiClient]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'r',
      ctrlKey: true,
      callback: () => {
        if (currentROI) {
          setCurrentROI(null);
        }
      },
    },
    {
      key: 'a',
      ctrlKey: true,
      callback: startAnalysis,
    },
    {
      key: 'v',
      ctrlKey: true,
      callback: () => setDisplayState(prev => ({ ...prev, showVisualization: !prev.showVisualization })),
    },
    {
      key: 'Enter',
      callback: startAnalysis,
    },
  ]);

  // Derived values
  const displayedTotalFrames = currentVideo ? Math.max(1, Math.floor(currentVideo.frameCount / frameStep)) : 0;
  const timeAxisProgress = displayedTotalFrames > 1 ? (currentFrame / (displayedTotalFrames - 1)) * 100 : 0;

  // Event handlers
  const startAutoAnalysis = useCallback(async () => {
    if (isAutoAnalyzing) {
      setError('自动分析进行中，请稍候');
      return;
    }
    if (!currentVideo || !currentROI) {
      setError('请先选择视频和ROI区域');
      return;
    }

    setIsAutoAnalyzing(true);
    setError(`开始自动分析 ${autoAnalysisFrames} 帧...`);

    try {
      let completedFrames = 0;
      // 创建当前ROI的引用副本，避免闭包问题
      let currentROICopy = { ...currentROI };

      for (let i = 0; i < autoAnalysisFrames; i++) {
        const targetFrame = currentFrame + 1 + i;
        if (targetFrame >= displayedTotalFrames) {
          setError(`已到达视频末尾，完成 ${completedFrames} 帧分析`);
          break;
        }

        // 移动到目标帧
        console.log(`🔄 自动分析第 ${i + 1}/${autoAnalysisFrames} 帧: 移动到帧 ${targetFrame}`);
        setCurrentFrame(targetFrame);

        // 等待一帧以确保帧加载完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 执行分析并获取最新的连通域中心点
        console.log(`🔍 执行帧 ${targetFrame} 的分析...`);
        console.log(`📐 使用的ROI: (${currentROICopy.x}, ${currentROICopy.y}), 大小: ${currentROICopy.width}x${currentROICopy.height}`);
        const latestCenterPoint = await startAnalysis(currentROICopy);

        // 使用返回的中心点移动ROI，而不是依赖闭包状态
        if (latestCenterPoint) {
          // latestCenterPoint已经是相对于ROI的坐标，需要转换为图像绝对坐标
          const absCenterX = currentROICopy.x + latestCenterPoint.x;
          const absCenterY = currentROICopy.y + latestCenterPoint.y;

          const canvasWidth = frameCanvasRef.current?.width || 800;
          const canvasHeight = frameCanvasRef.current?.height || 600;

          // 计算新的ROI位置（将ROI中心移动到连通域中心点）
          const newROI: ROI = {
            id: `roi-${Date.now()}`,
            frameIndex: targetFrame,
            x: Math.max(0, Math.min(absCenterX - currentROICopy.width / 2, canvasWidth - currentROICopy.width)),
            y: Math.max(0, Math.min(absCenterY - currentROICopy.height / 2, canvasHeight - currentROICopy.height)),
            width: currentROICopy.width,
            height: currentROICopy.height,
          };

          console.log(`📊 帧 ${targetFrame}: 连通域中心点ROI相对坐标(${latestCenterPoint.x}, ${latestCenterPoint.y})`);
          console.log(`📊 帧 ${targetFrame}: 连通域中心点图像绝对坐标(${absCenterX}, ${absCenterY})`);
          console.log(`📊 帧 ${targetFrame}: ROI从 (${currentROICopy.x}, ${currentROICopy.y}) 移动到 (${newROI.x}, ${newROI.y})`);
          currentROICopy = newROI; // 更新副本
          setCurrentROI(newROI); // 更新状态
        } else {
          console.log(`⚠️ 帧 ${targetFrame}: 未检测到连通域中心点（mask为空），ROI保持不变`);
        }

        completedFrames++;

        // 等待分析完成
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setError(`✅ 自动分析完成！成功处理了 ${completedFrames} 帧，ROI已根据静脉中心点进行跟踪`);
    } catch (error) {
      console.error('自动分析过程中发生错误:', error);
      setError('自动分析过程中发生错误');
    } finally {
      setIsAutoAnalyzing(false);
      // 3秒后清除消息
      setTimeout(() => setError(null), 3000);
    }
  }, [currentVideo, currentROI, currentFrame, displayedTotalFrames, autoAnalysisFrames, isAutoAnalyzing, startAnalysis]);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById('main-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newLeftSize = ((e.clientX - rect.left) / rect.width) * 100;
      if (newLeftSize >= 40 && newLeftSize <= 80) {
        setLeftPanelSize(newLeftSize);
        setRightPanelSize(100 - newLeftSize);
      }
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Effects
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!currentVideo) return;
    const targetFrame = Math.min(9, currentVideo.frameCount - 1);
    setCurrentFrame(targetFrame);
  }, [currentVideo]);

  useEffect(() => {
    setCurrentDetection(undefined);
  }, [currentFrame]);

  useEffect(() => {
    return () => {
        revokeBlobUrl(previewUrlRef.current);
      };
    }, [revokeBlobUrl]);

  // Initialize component
  useEffect(() => {
    console.log('🎯 系统初始化完成 - 默认算法: 阈值分割');
    console.log('💡 提示: 由于浏览器安全限制，请手动上传视频文件开始分析');
  }, []);

  return (
    <div
      id="main-container"
        className="h-screen bg-gray-900 text-white flex flex-col"
        {...fileInputProps}
      >
      <HeaderPanel
          currentVideo={currentVideo}
          segmentationModel={segmentationModel}
          isAnalyzing={analysisState.isAnalyzing}
          analysisProgress={analysisState.analysisProgress}
          showSegmentationOverlay={displayState.showSegmentationOverlay}
          showSettingsPanel={displayState.showSettingsPanel}
          error={error}
          onFileUpload={handleFileUpload}
          onModelChange={setSegmentationModel}
          // 注意：这里包一层，避免 React 把点击事件作为参数传给 startAnalysis
          onStartAnalysis={() => { void startAnalysis(); }}
        onToggleSegmentationOverlay={() => setDisplayState(prev => ({ ...prev, showSegmentationOverlay: !prev.showSegmentationOverlay }))}
        onToggleSettingsPanel={() => setDisplayState(prev => ({ ...prev, showSettingsPanel: !prev.showSettingsPanel }))}
        onClearError={() => setError(null)}
        testMode={testMode}
        onToggleTestMode={() => setTestMode(!testMode)}
        // 自动分析相关
        currentFrame={currentFrame}
        displayedTotalFrames={displayedTotalFrames}
        autoAnalysisFrames={autoAnalysisFrames}
        isAutoAnalyzing={isAutoAnalyzing}
        onAutoAnalysisFramesChange={setAutoAnalysisFrames}
        onStartAutoAnalysis={() => { void startAutoAnalysis(); }}
      />

      <div className="flex-1 flex overflow-hidden">
        <div
          className="bg-gray-800 border-r border-gray-700 flex flex-col"
          style={{ width: `${leftPanelSize}%` }}
        >
          <VideoControlsPanel
            currentROI={currentROI}
            frameStep={frameStep}
            currentFrame={currentFrame}
            displayedTotalFrames={displayedTotalFrames}
            showROIBorder={displayState.showROIBorder}
            showGrayscaleInfo={grayscaleInfo.showGrayscaleInfo}
            currentGrayscaleValue={grayscaleInfo.currentValue}
            testMode={grayscaleInfo.testMode}
            isROIMode={roiControlState.isROIMode}
            onFrameStepChange={setFrameStep}
            onCurrentFrameChange={setCurrentFrame}
            onClearROI={() => setCurrentROI(null)}
            onToggleROIMode={() => setRoiControlState(prev => ({ ...prev, isROIMode: !prev.isROIMode }))}
            onShrinkROI={() => {
              setCurrentROI(prev => {
                if (!prev) return prev;
                const newWidth = prev.width * 0.8;
                const newHeight = prev.height * 0.8;
                const newX = prev.x + (prev.width - newWidth) / 2;
                const newY = prev.y + (prev.height - newHeight) / 2;
                return { ...prev, x: newX, y: newY, width: newWidth, height: newHeight };
              });
            }}
            onToggleROIBorder={() => setDisplayState(prev => ({ ...prev, showROIBorder: !prev.showROIBorder }))}
            showTimeline={showTimeline}
            onToggleTimeline={handleToggleTimeline}
          />

          <div className="flex-1 p-4 overflow-auto">
            <VideoDisplayPanel
              currentVideo={currentVideo}
              currentFrame={currentFrame}
              displayedTotalFrames={displayedTotalFrames}
              frameStep={frameStep}
              zoom={videoControls.zoom}
              panX={videoControls.panX}
              panY={videoControls.panY}
              currentROI={currentROI}
              isROIMode={roiControlState.isROIMode}
              segmentationMask={segmentationMask}
              showSegmentationOverlay={displayState.showSegmentationOverlay}
              showROIBorder={displayState.showROIBorder}
              showCenterPoints={displayState.showCenterPoints}
              analysisCenterPoints={analysisCenterPoints}
              selectedPoint={roiControlState.selectedPoint}
              enablePointSelection={ellipticalMorphParams.processingMode === 'selected_point_connected' || roiControlState.isPointSelectionMode}
              isPointSelectionMode={roiControlState.isPointSelectionMode}
              connectedComponentCenter={connectedComponentCenter}
              onFrameChange={setCurrentFrame}
              onTimeUpdate={() => {}}
              onCanvasRef={canvas => { frameCanvasRef.current = canvas; }}
              onMouseMove={(e, grayscaleValue, x, y) => {
                if (grayscaleValue !== undefined && x !== undefined && y !== undefined) {
                  setGrayscaleInfo(prev => ({ ...prev, currentValue: grayscaleValue }));
                }
              }}
              onMouseLeave={() => setGrayscaleInfo(prev => ({ ...prev, currentValue: null }))}
              showGrayscale={grayscaleInfo.showGrayscaleInfo}
              onROIChange={setCurrentROI}
              onROIClear={() => setCurrentROI(null)}
              onPointSelect={(point) => {
                setRoiControlState(prev => ({ ...prev, selectedPoint: point, isPointSelectionMode: false }));
              }}
              onImageWheel={videoControls.handleImageWheel}
              onPanMouseDown={videoControls.handlePanMouseDown}
              onPanMouseMove={videoControls.handlePanMouseMove}
              onPanMouseUp={videoControls.handlePanMouseUp}
              onCurrentFrameChange={setCurrentFrame}
            />
          </div>
        </div>

        <div
          className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
        />

        <div
          className="bg-gray-800 flex flex-col overflow-y-auto"
          style={{ width: `${rightPanelSize}%` }}
        >
          <ResultsPanel
            currentVideo={currentVideo}
            showVisualization={displayState.showVisualization}
            showSettingsPanel={displayState.showSettingsPanel}
            currentDetection={currentDetection}
            detectionResults={detectionResults}
            showContours={displayState.showContours}
            showCenters={displayState.showCenters}
            confidenceThreshold={displayState.confidenceThreshold}
            onToggleVisualization={() => setDisplayState(prev => ({ ...prev, showVisualization: !prev.showVisualization }))}
            onToggleContours={() => setDisplayState(prev => ({ ...prev, showContours: !prev.showContours }))}
            onToggleCenters={() => setDisplayState(prev => ({ ...prev, showCenters: !prev.showCenters }))}
            onConfidenceThresholdChange={(threshold) => setDisplayState(prev => ({ ...prev, confidenceThreshold: threshold }))}
          />

          {displayState.showSettingsPanel && (
            <SettingsPanel
              segmentationModel={segmentationModel}
              displayState={displayState}
              grayscaleInfo={grayscaleInfo}
              frameStep={frameStep}
              enhancedCVParams={enhancedCVParams}
              simpleCenterParams={simpleCenterParams}
              simplePreStrength={simplePreStrength}
              simpleMorphStrength={simpleMorphStrength}
              ellipticalMorphParams={ellipticalMorphParams}
              autoAnalysisEnabled={analysisState.autoAnalysisEnabled}
              selectedPoint={roiControlState.selectedPoint}
              isPointSelectionMode={roiControlState.isPointSelectionMode}
              onSegmentationModelChange={setSegmentationModel}
              onDisplayStateChange={(state) => setDisplayState(prev => ({ ...prev, ...state }))}
              onGrayscaleInfoChange={(info) => setGrayscaleInfo(prev => ({ ...prev, ...info }))}
              onFrameStepChange={setFrameStep}
              onEnhancedCVParamsChange={setEnhancedCVParams}
              onSimpleCenterParamsChange={setSimpleCenterParams}
              onSimplePreStrengthChange={setSimplePreStrength}
              onSimpleMorphStrengthChange={setSimpleMorphStrength}
              onEllipticalMorphParamsChange={setEllipticalMorphParams}
              onAutoAnalysisChange={(enabled) => setAnalysisState(prev => ({ ...prev, autoAnalysisEnabled: enabled }))}
              onPointSelectModeChange={(enabled) => setRoiControlState(prev => ({ ...prev, isPointSelectionMode: enabled }))}
              onSelectedPointChange={(point) => setRoiControlState(prev => ({ ...prev, selectedPoint: point }))}
            />
          )}

          {analysisState.isAnalyzing && (
            <div className="p-4 border-t border-gray-700">
              <div className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>分析进度</span>
                  <span>{analysisState.analysisProgress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${analysisState.analysisProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center space-x-4">
            <span>快捷键: Ctrl+R 清除ROI | Ctrl+A 开始分析 | Ctrl+V 显示/隐藏结果</span>
          </div>
          <div>{loading ? '加载中...' : '就绪'}</div>
        </div>
      </div>
    </div>
  );
};
