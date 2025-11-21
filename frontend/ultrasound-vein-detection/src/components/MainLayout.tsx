import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Play, Pause, Square, Settings, BarChart3, Camera, FileVideo } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ROIEditor } from './ROIEditor';
import { VeinVisualization } from './VeinVisualization';
import { apiClient, mockApi } from '../api/client';
import { VideoInfo, ROI, VeinDetectionResult } from '../api/types';


type EnhancedCVParams = {
  blurKernelSize: number;
  claheClipLimit: number;
  claheTileGridSize: number;
  frangiScaleMin: number;
  frangiScaleMax: number;
  frangiScaleStep: number;
  frangiThreshold: number;
  areaMin: number;
  areaMax: number;
  aspectRatioMin: number;
  aspectRatioMax: number;
  centerBandTop: number;
  centerBandBottom: number;
  morphKernelSize: number;
  morphCloseIterations: number;
  morphOpenIterations: number;
};

type SimpleCenterParams = {
  blurKernelSize: number;
  claheClipLimit: number;
  claheTileGridSize: number;
  morphKernelSize: number;
  morphCloseIterations: number;
  morphOpenIterations: number;
  areaMinFactor: number;
  areaMaxFactor: number;
  circularityMin: number;
};

type EllipticalMorphParams = {
  thresholdMin: number;
  thresholdMax: number;
  ellipseMajorAxis: number;
  ellipseMinorAxis: number;
  ellipseAngle: number;
  morphStrength: number;
  blurKernelSize: number;
  claheClipLimit: number;
  claheTileGridSize: number;
};

export const MainLayout: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState<VideoInfo | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentROI, setCurrentROI] = useState<ROI | null>(null);
  const [detectionResults, setDetectionResults] = useState<VeinDetectionResult[]>([]);
  const [currentDetection, setCurrentDetection] = useState<VeinDetectionResult | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [segmentationMask, setSegmentationMask] = useState<number[][] | null>(null);
  const [showSegmentationOverlay, setShowSegmentationOverlay] = useState(true);
  const [showCenterPoints, setShowCenterPoints] = useState(false);
  const [analysisCenterPoints, setAnalysisCenterPoints] = useState<Array<{x: number, y: number, label: string, inMask?: boolean}>>([]);
  // 当前实际使用的是 segmentation_models_pytorch 提供的 U-Net (ResNet34, ImageNet encoder)
  const [segmentationModel, setSegmentationModel] = useState('elliptical_morph');
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isROIMode, setIsROIMode] = useState(false);
  const [enhancedCVParams, setEnhancedCVParams] = useState<EnhancedCVParams>({
    // 预处理
    blurKernelSize: 5,
    claheClipLimit: 2.5,
    claheTileGridSize: 8,
    // Frangi 血管滤波
    frangiScaleMin: 1.0,
    frangiScaleMax: 3.0,
    frangiScaleStep: 0.5,
    frangiThreshold: 0.08,
    // 几何与位置筛选（相对更宽松，保证至少能出一个 mask）
    areaMin: 100,
    areaMax: 4000,
    aspectRatioMin: 0.5,
    aspectRatioMax: 2.0,
    centerBandTop: 0.3,
    centerBandBottom: 0.9,
    // 形态学
    morphKernelSize: 5,
    morphCloseIterations: 2,
    morphOpenIterations: 1,
  });
  const previewUrlRef = useRef<string | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const revokeBlobUrl = useCallback((url?: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const [showVisualization, setShowVisualization] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  const [leftPanelSize, setLeftPanelSize] = useState(70);
  const [rightPanelSize, setRightPanelSize] = useState(30);
  const [isResizing, setIsResizing] = useState(false);
  const [frameStep, setFrameStep] = useState(1);
  const [showROIOverlay, setShowROIOverlay] = useState(true);
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

  // 阈值分割参数 (统一使用0-255尺度)
  const [ellipticalMorphParams, setEllipticalMorphParams] = useState<EllipticalMorphParams>({
    thresholdMin: 20,  // 更合理的起始阈值，根据采样点灰度值调整
    thresholdMax: 130, // 更合理的结束阈值，确保包含采样点中的有效值
    ellipseMajorAxis: 15,
    ellipseMinorAxis: 10,
    ellipseAngle: 0,
    morphStrength: 0.5,
    blurKernelSize: 5,
    claheClipLimit: 2.0,
    claheTileGridSize: 8,
  });
  const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState(false); // 椭圆形态学自动分析开关
  const [ellipticalConstraintEnabled, setEllipticalConstraintEnabled] = useState(false); // 椭圆形态学限制开关
  const [maxConnectedComponentEnabled, setMaxConnectedComponentEnabled] = useState(false); // 最大连通区域检测开关
  const [roiCenterConnectedComponentEnabled, setRoiCenterConnectedComponentEnabled] = useState(true); // ROI中心点连通域检测开关
  const [selectedPointConnectedComponentEnabled, setSelectedPointConnectedComponentEnabled] = useState(false); // 选中点连通域检测开关
  const [selectedPoint, setSelectedPoint] = useState<{x: number, y: number} | null>(null); // 用户选中的点坐标
  const [isPointSelectionMode, setIsPointSelectionMode] = useState(false); // 点选择模式状态

  // 灰度值相关状态
  const [showGrayscaleInfo, setShowGrayscaleInfo] = useState(false); // 显示灰度值信息
  const [currentGrayscaleValue, setCurrentGrayscaleValue] = useState<number | null>(null); // 当前鼠标位置的灰度值
  const [autoThresholdEnabled, setAutoThresholdEnabled] = useState(false); // 启用自动阈值功能
  const [testMode, setTestMode] = useState(false); // 测试模式

  // ROI显示控制状态
  const [showROIBorder, setShowROIBorder] = useState(true); // 控制ROI边框的显示/隐藏
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayedTotalFrames = currentVideo ? Math.max(1, Math.floor(currentVideo.frameCount / frameStep)) : 0;
  const timeAxisProgress =
    displayedTotalFrames > 1 ? (currentFrame / (displayedTotalFrames - 1)) * 100 : 0;
  const isEnhancedCV =
    ['cv_enhanced', 'cv-advanced', 'cv-frangi'].includes(segmentationModel.toLowerCase());

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      const videoFile = files.find(file => file.type.startsWith('video/'));
      if (videoFile) {
        handleFileUpload(videoFile);
      }
    },
    [handleFileUpload],
  );

  useEffect(() => {
    return () => {
      revokeBlobUrl(previewUrlRef.current);
    };
  }, [revokeBlobUrl]);

  // 当使用 T1 简单 CV 时，用全局“置信度阈值”自动收紧 / 放宽 T1 区域筛选参数
  useEffect(() => {
    if (segmentationModel.toLowerCase() !== 'cv_simple_center') {
      return;
    }
    const v = confidenceThreshold; // 0~1
    setSimpleCenterParams(prev => ({
      ...prev,
      areaMinFactor: 0.01 + 0.05 * v,
      areaMaxFactor: 0.6 - 0.4 * v,
      circularityMin: 0.2 + 0.6 * v,
    }));
  }, [confidenceThreshold, segmentationModel]);

  // T1 预处理强度：从宽松到严格调整模糊核与 CLAHE
  useEffect(() => {
    if (segmentationModel.toLowerCase() !== 'cv_simple_center') {
      return;
    }
    const p = simplePreStrength; // 0~1
    const blurKernel = 3 + 2 * Math.round(p * 3); // 3,5,7,9
    const claheClip = 1.0 + 3.0 * p; // 1.0 ~ 4.0
    const claheTile = 4 + Math.round(p * 4); // 4 ~ 8
    setSimpleCenterParams(prev => ({
      ...prev,
      blurKernelSize: blurKernel,
      claheClipLimit: claheClip,
      claheTileGridSize: claheTile,
    }));
  }, [simplePreStrength, segmentationModel]);

  // T1 形态学强度：从宽松到严格调整核大小与开闭运算次数
  useEffect(() => {
    if (segmentationModel.toLowerCase() !== 'cv_simple_center') {
      return;
    }
    const m = simpleMorphStrength; // 0~1
    const morphKernel = 3 + 2 * Math.round(m * 2); // 3,5,7
    const closeIter = 1 + Math.round(m * 3); // 1~4
    const openIter = Math.round(m * 2); // 0~2
    setSimpleCenterParams(prev => ({
      ...prev,
      morphKernelSize: morphKernel,
      morphCloseIterations: closeIter,
      morphOpenIterations: openIter,
    }));
  }, [simpleMorphStrength, segmentationModel]);

  // 当使用 T1 简单 CV 时，用全局“置信度阈值”自动收紧 / 放宽 T1 参数
  useEffect(() => {
    if (segmentationModel.toLowerCase() !== 'cv_simple_center') {
      return;
    }
    const v = confidenceThreshold; // 0~1
    setSimpleCenterParams(prev => ({
      ...prev,
      areaMinFactor: 0.01 + 0.05 * v,
      areaMaxFactor: 0.6 - 0.4 * v,
      circularityMin: 0.2 + 0.6 * v,
    }));
  }, [confidenceThreshold, segmentationModel]);

  // 当前简单分割逻辑不依赖历史检测结果
  useEffect(() => {
    setCurrentDetection(undefined);
  }, [currentFrame]);

  const startAnalysis = useCallback(async () => {
    if (!currentVideo || !currentROI) {
      setError('请先选择视频和ROI区域');
      return;
    }
    if (!frameCanvasRef.current) {
      setError('当前帧画布尚未准备好，请稍后重试');
      return;
    }
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setError(null);

      // 清除当前的mask和检测结果
      setSegmentationMask(null);
      setCurrentDetection(undefined);
      setDetectionResults([]);

      const canvas = frameCanvasRef.current;
      const imageDataUrl = canvas.toDataURL('image/png');
      let parameters: Record<string, number> | undefined;

      // 实时获取最新参数，确保使用当前重新设置的参数
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
        // 使用全局置信度滑动条自动控制 T1 参数（越大越严格）
        const v = confidenceThreshold; // 0~1
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
        // 椭圆形形态学参数 - 直接发送0-255值
        parameters = {
          threshold_min: ellipticalMorphParams.thresholdMin,  // 直接使用0-255
          threshold_max: ellipticalMorphParams.thresholdMax,  // 直接使用0-255
          ellipse_major_axis: ellipticalMorphParams.ellipseMajorAxis,
          ellipse_minor_axis: ellipticalMorphParams.ellipseMinorAxis,
          ellipse_angle: ellipticalMorphParams.ellipseAngle,
          morph_strength: ellipticalMorphParams.morphStrength,
          blur_kernel_size: ellipticalMorphParams.blurKernelSize,
          clahe_clip_limit: ellipticalMorphParams.claheClipLimit,
          clahe_tile_grid_size: ellipticalMorphParams.claheTileGridSize,
          elliptical_constraint_enabled: ellipticalConstraintEnabled ? 1 : 0,
          max_connected_component_enabled: maxConnectedComponentEnabled ? 1 : 0,
          roi_center_connected_component_enabled: roiCenterConnectedComponentEnabled ? 1 : 0,
          selected_point_connected_component_enabled: selectedPointConnectedComponentEnabled ? 1 : 0,
          selected_point_x: selectedPoint?.x || 0,
          selected_point_y: selectedPoint?.y || 0,
        };
      }
      // 调试日志：查看前端实际发送的模型和最新参数
      // eslint-disable-next-line no-console
      console.log('🔄 开始分析 - 使用最新参数', {
        timestamp: new Date().toLocaleTimeString(),
        modelName: segmentationModel,
        cvName,
        hasParameters: Boolean(parameters),
        parameterCount: parameters ? Object.keys(parameters).length : 0,
        parameters,
        // 显示选中点连通域相关信息
        selectedPointInfo: {
          enabled: selectedPointConnectedComponentEnabled,
          selectedPoint: selectedPoint,
          roiInfo: currentROI ? {
            x: currentROI.x,
            y: currentROI.y,
            width: currentROI.width,
            height: currentROI.height
          } : null,
          absolutePointCoords: selectedPoint && currentROI ? {
            x: currentROI.x + selectedPoint.x,
            y: currentROI.y + selectedPoint.y
          } : null
        },
        // 显示关键参数的当前值
        keyParams: {
          enhanced: cvName.includes('enhanced') ? {
            frangiThreshold: enhancedCVParams.frangiThreshold,
            areaMin: enhancedCVParams.areaMin,
            areaMax: enhancedCVParams.areaMax,
          } : null,
          simple: cvName === 'cv_simple_center' ? {
            confidenceThreshold,
            areaMinFactor: simpleCenterParams.areaMinFactor,
            circularityMin: simpleCenterParams.circularityMin,
          } : null,
          elliptical: cvName === 'elliptical_morph' ? {
            thresholdMin: ellipticalMorphParams.thresholdMin,
            thresholdMax: ellipticalMorphParams.thresholdMax,
            morphStrength: ellipticalMorphParams.morphStrength,
            maxConnectedComponent: maxConnectedComponentEnabled,
            roiCenterConnectedComponent: roiCenterConnectedComponentEnabled,
          } : null,
        }
      });
      const response = await apiClient.segmentCurrentFrame({
        imageDataUrl,
        roi: currentROI,
        modelName: segmentationModel,
        parameters,
      });
      if (response.success && response.data) {
        setSegmentationMask(response.data.mask);
        // 获取中心点信息（如果后端返回了）
        if (response.data.centerPoints) {
          setAnalysisCenterPoints(response.data.centerPoints);
          setShowCenterPoints(true); // 自动显示中心点
        }
        setIsAnalyzing(false);
        setAnalysisProgress(100);
      } else {
        setError(response.error || response.message || '分析启动失败');
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError('分析失败: ' + (err as Error).message);
      setIsAnalyzing(false);
    }
  }, [currentVideo, currentROI, segmentationModel, enhancedCVParams, simpleCenterParams, ellipticalMorphParams, simplePreStrength, simpleMorphStrength, confidenceThreshold]);

  // 基于灰度值的自动阈值设定
  const handleGrayscaleBasedThreshold = useCallback((grayscaleValue: number, x: number, y: number) => {
    setCurrentGrayscaleValue(grayscaleValue);

    if (!autoThresholdEnabled) {
      return;
    }

    // 根据当前模型类型自动调整阈值参数
    const cvName = segmentationModel.toLowerCase();

    if (cvName === 'elliptical_morph') {
      // 椭圆形态学：以当前灰度值为中心，设置合理的阈值范围
      const centerThreshold = grayscaleValue;
      const thresholdRange = 20; // 阈值范围

      // 使用0-255范围
      setEllipticalMorphParams(prev => ({
        ...prev,
        thresholdMin: Math.max(0, centerThreshold - thresholdRange),
        thresholdMax: Math.min(255, centerThreshold + thresholdRange), // 0-255范围
      }));
    } else if (cvName === 'cv_simple_center') {
      // 简单中心检测：基于灰度值调整预处理强度
      const normalizedValue = grayscaleValue / 255; // 0-1
      const newStrength = Math.max(0, Math.min(1, 1 - normalizedValue)); // 灰度值越高，强度越低

      setSimplePreStrength(newStrength);
      setSimpleMorphStrength(newStrength * 0.8);
    } else if (['cv_enhanced', 'cv-advanced', 'cv-frangi'].includes(cvName)) {
      // 增强CV：基于灰度值调整Frangi滤波阈值
      const normalizedValue = grayscaleValue / 255; // 0-1
      const frangiThreshold = Math.max(0.01, Math.min(0.5, normalizedValue * 0.3));

      setEnhancedCVParams(prev => ({
        ...prev,
        frangiThreshold: frangiThreshold,
        // 同时调整面积范围
        areaMin: Math.max(50, 500 - grayscaleValue),
        areaMax: Math.max(1000, 2000 + grayscaleValue * 2),
      }));
    }

    // 如果启用自动分析，则触发重新分析
    if (autoAnalysisEnabled && segmentationModel.toLowerCase() === 'elliptical_morph') {
      triggerAutoAnalysis();
    }
  }, [autoThresholdEnabled, segmentationModel, setEllipticalMorphParams, setSimplePreStrength, setSimpleMorphStrength, setEnhancedCVParams, autoAnalysisEnabled]);

  // 处理鼠标移动事件（从VideoPlayer传递）
  const handleVideoMouseMove = useCallback((e: React.MouseEvent, grayscaleValue?: number, x?: number, y?: number) => {
    if (!showGrayscaleInfo) return;

    // 如果从VideoPlayer传递了灰度值和坐标，使用它们
    if (grayscaleValue !== undefined && x !== undefined && y !== undefined) {
      setCurrentGrayscaleValue(grayscaleValue); // 设置当前灰度值用于显示

      // 🔍 关键调试：验证Canvas数据是否与鼠标看到的灰度值一致
      if (frameCanvasRef.current) {
        try {
          const canvas = frameCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // 获取鼠标位置的实际Canvas像素值
            const imageData = ctx.getImageData(x, y, 1, 1);
            const data = imageData.data;
            const canvasGrayscale = Math.round(0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2]);

            console.log(`${grayscaleValue}/${canvasGrayscale}`); // A/B格式：鼠标值/Canvas实际值
          }
        } catch (error) {
          // 静默处理错误
        }
      }

      handleGrayscaleBasedThreshold(grayscaleValue, x, y);
      return;
    }
  }, [showGrayscaleInfo, handleGrayscaleBasedThreshold]);

  // 处理鼠标离开事件
  const handleVideoMouseLeave = useCallback(() => {
    setCurrentGrayscaleValue(null);
  }, []);

  // 自动分析功能（椭圆形态学参数变化时触发）
  const autoAnalysisRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoAnalysis = useCallback(() => {
    // 只有在椭圆形态学模式下且启用自动分析时才触发
    if (segmentationModel.toLowerCase() !== 'elliptical_morph' || !autoAnalysisEnabled) {
      return;
    }

    // 清除之前的定时器
    if (autoAnalysisRef.current) {
      clearTimeout(autoAnalysisRef.current);
    }

    // 防抖：500ms后直接执行分析逻辑
    autoAnalysisRef.current = setTimeout(async () => {
      if (!currentVideo || !currentROI || !frameCanvasRef.current) {
        return;
      }

      if (isAnalyzing) {
        return; // 如果正在分析，则跳过
      }

      try {
        console.log('🤖 自动分析触发 - 参数已改变');
        setIsAnalyzing(true);
        setAnalysisProgress(0);
        setError(null);

        // 清除当前的mask和检测结果
        setSegmentationMask(null);
        setCurrentDetection(undefined);
        setDetectionResults([]);

        const canvas = frameCanvasRef.current;
        const imageDataUrl = canvas.toDataURL('image/png');

        // 获取椭圆形态学参数
        const parameters = {
          threshold_min: ellipticalMorphParams.thresholdMin,
          threshold_max: ellipticalMorphParams.thresholdMax,
          ellipse_major_axis: ellipticalMorphParams.ellipseMajorAxis,
          ellipse_minor_axis: ellipticalMorphParams.ellipseMinorAxis,
          ellipse_angle: ellipticalMorphParams.ellipseAngle,
          morph_strength: ellipticalMorphParams.morphStrength,
          blur_kernel_size: ellipticalMorphParams.blurKernelSize,
          clahe_clip_limit: ellipticalMorphParams.claheClipLimit,
          clahe_tile_grid_size: ellipticalMorphParams.claheTileGridSize,
          elliptical_constraint_enabled: ellipticalConstraintEnabled ? 1 : 0,
        };

        console.log('🤖 自动分析 - 使用最新参数', {
          timestamp: new Date().toLocaleTimeString(),
          modelName: segmentationModel,
          parameters,
          ellipticalConstraintEnabled,
        });

        const response = await apiClient.segmentCurrentFrame({
          imageDataUrl,
          roi: currentROI,
          modelName: segmentationModel,
          parameters,
        });

        if (response.success && response.data) {
          setSegmentationMask(response.data.mask);
          setAnalysisProgress(100);
        } else {
          setError(response.error || response.message || '自动分析失败');
        }
      } catch (err) {
        setError('自动分析失败: ' + (err as Error).message);
      } finally {
        setIsAnalyzing(false);
      }
    }, 500);
  }, [segmentationModel, autoAnalysisEnabled, currentVideo, currentROI, isAnalyzing, ellipticalMorphParams, ellipticalConstraintEnabled]);

  // 椭圆形态学参数变化时触发自动分析
  useEffect(() => {
    triggerAutoAnalysis();
  }, [
    ellipticalMorphParams.thresholdMin,
    ellipticalMorphParams.thresholdMax,
    ellipticalMorphParams.ellipseMajorAxis,
    ellipticalMorphParams.ellipseMinorAxis,
    ellipticalMorphParams.ellipseAngle,
    ellipticalMorphParams.morphStrength,
    ellipticalMorphParams.blurKernelSize,
    ellipticalMorphParams.claheClipLimit,
    ellipticalMorphParams.claheTileGridSize,
    ellipticalConstraintEnabled, // 添加椭圆限制状态监听
    maxConnectedComponentEnabled, // 添加最大连通区域状态监听
    roiCenterConnectedComponentEnabled, // 添加ROI中心点连通域状态监听
    triggerAutoAnalysis
  ]);

  // 清理定时器，防止内存泄漏
  useEffect(() => {
    return () => {
      if (autoAnalysisRef.current) {
        clearTimeout(autoAnalysisRef.current);
      }
    };
  }, []);

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
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.code) {
        case 'KeyR':
          if (e.ctrlKey) {
            e.preventDefault();
            if (currentROI) {
              setCurrentROI(null);
            }
          }
          break;
        case 'KeyA':
          if (e.ctrlKey) {
            e.preventDefault();
            startAnalysis();
          }
          break;
        case 'KeyV':
          if (e.ctrlKey) {
            e.preventDefault();
            setShowVisualization(!showVisualization);
          }
          break;
        case 'Enter':
          if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            startAnalysis();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [startAnalysis, showVisualization, currentROI]);

  useEffect(() => {
    if (!currentVideo) {
      return;
    }
    const targetFrame = Math.min(9, currentVideo.frameCount - 1);
    setCurrentFrame(targetFrame);
  }, [currentVideo]);

  // 组件挂载时的初始化
  useEffect(() => {
    console.log('🎯 系统初始化完成 - 默认算法: 阈值分割');
    console.log('💡 提示: 由于浏览器安全限制，请手动上传视频文件开始分析');
  }, []);

  const handleImageWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 某些环境下 wheel 监听会是 passive，直接 preventDefault 会报错
    if (e.cancelable) {
      e.preventDefault();
    }
    const delta = e.deltaY;
    const zoomStep = 0.1;
    setZoom(prevZoom => {
      let nextZoom = prevZoom;
      if (delta < 0) {
        // scroll up: zoom in
        nextZoom = prevZoom * (1 + zoomStep);
      } else if (delta > 0) {
        // scroll down: zoom out
        nextZoom = prevZoom * (1 - zoomStep);
      }
      const minZoom = 0.1; // 最小缩放：10%
      const maxZoom = 10; // 最大缩放：1000%，支持高倍放大
      if (nextZoom < minZoom) nextZoom = minZoom;
      if (nextZoom > maxZoom) nextZoom = maxZoom;
      return nextZoom;
    });
  }, []);

  const handlePanMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isROIMode) return;
      if (e.button !== 0) return;
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { x: panX, y: panY };
    },
    [isROIMode, panX, panY],
  );

  const handlePanMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isROIMode) return;
      if (!isPanningRef.current || !panStartRef.current) return;
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

  const handleClearROI = useCallback(() => {
    setCurrentROI(null);
  }, []);

  const handleShrinkROI = useCallback(() => {
    setCurrentROI(prev => {
      if (!prev) return prev;
      const newWidth = prev.width * 0.8;
      const newHeight = prev.height * 0.8;
      const newX = prev.x + (prev.width - newWidth) / 2;
      const newY = prev.y + (prev.height - newHeight) / 2;
      return {
        ...prev,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };
    });
  }, []);

  return (
    <div
      id="main-container"
      className="h-screen bg-gray-900 text-white flex flex-col"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-blue-400">超声静脉检测系统</h1>
            {/* 测试模式切换 */}
            <button
              onClick={() => setTestMode(!testMode)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                testMode
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
              title={testMode ? "退出测试模式" : "进入测试模式"}
            >
              {testMode ? "测试模式" : "普通模式"}
            </button>
            {currentVideo && (
              <div className="text-sm text-gray-300">
                <FileVideo size={16} className="inline mr-1" />
                {currentVideo.name}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded cursor-pointer flex items-center space-x-2 transition-colors">
              <Upload size={16} />
              <span>上传视频</span>
              <input
                type="file"
                accept="video/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </label>
            <div className="flex items-center space-x-2 text-sm text-gray-200 mr-2">
              <span>分割模型:</span>
              <select
                value={segmentationModel}
                onChange={e => setSegmentationModel(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
              >
                <option value="smp_unet_resnet34">
                  深度模型 · SMP U-Net (ResNet34)
                </option>
                <option value="cv">传统 CV 分割 (OpenCV · 基础版)</option>
                <option value="cv_enhanced">传统 CV 分割 (Frangi 增强版)</option>
                <option value="cv_simple_center">T1 中心黑区 · 简单 CV</option>
                <option value="elliptical_morph">阈值分割</option>
              </select>
            </div>
            <button
              onClick={startAnalysis}
              disabled={!currentVideo || !currentROI || isAnalyzing}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
            >
              <BarChart3 size={16} />
              <span>{isAnalyzing ? `分析中... ${analysisProgress}%` : '开始分析'}</span>
            </button>
            <button
              onClick={() => setShowSegmentationOverlay(prev => !prev)}
              disabled={!segmentationMask}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
            >
              <span>{showSegmentationOverlay ? '隐藏分割结果' : '显示分割结果'}</span>
            </button>
            <button
              onClick={() => setShowCenterPoints(prev => !prev)}
              disabled={!currentROI || analysisCenterPoints.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center space-x-2 transition-colors"
            >
              <span>{showCenterPoints ? '隐藏中心点' : '显示中心点'}</span>
            </button>
            <button
              onClick={() => setShowSettingsPanel(prev => !prev)}
              className={`p-2 rounded transition-colors ${
                showSettingsPanel ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'
              }`}
              title="参数设置"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-600 bg-opacity-20 border border-red-600 rounded text-red-200">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className="bg-gray-800 border-r border-gray-700 flex flex-col"
          style={{ width: `${leftPanelSize}%` }}
        >
                              <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <span>Frame step:</span>
                  <select
                    value={frameStep}
                    onChange={e => {
                      const value = parseInt(e.target.value, 10) || 1;
                      setFrameStep(value);
                      setCurrentFrame(0);
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
                  >
                    <option value={1}>Every frame</option>
                    <option value={2}>Every 2 frames</option>
                    <option value={5}>Every 5 frames</option>
                    <option value={10}>Every 10 frames</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={handleClearROI}
                    disabled={!currentROI}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
                  >
                    Delete ROI
                  </button>
                  <button
                    onClick={() => setIsROIMode(prev => !prev)}
                    className={`px-3 py-1 rounded text-xs text-white transition-colors ${
                      isROIMode ? 'bg-green-500 hover:bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    Draw ROI
                  </button>
                  <button
                    onClick={handleShrinkROI}
                    disabled={!currentROI}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
                  >
                    Shrink ROI
                  </button>
                  {currentROI && (
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded text-white">
                      ROI selected
                    </span>
                  )}

                  {/* ROI边框显示/隐藏按钮 */}
                  {currentROI && (
                    <button
                      onClick={() => {
                        console.log('边框按钮点击 - 前值:', showROIBorder, '后值:', !showROIBorder);
                        setShowROIBorder(!showROIBorder);
                      }}
                      className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-white border border-gray-500 transition-colors duration-150"
                      title={showROIBorder ? "隐藏ROI边框" : "显示ROI边框"}
                    >
                      {showROIBorder ? "👁️ 边框" : "👁️‍🗨️ 边框"}
                    </button>
                  )}

                  {/* 灰度值显示 */}
                  {showGrayscaleInfo && currentGrayscaleValue !== null && (
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded text-white border border-gray-600">
                      灰度: {currentGrayscaleValue}/255
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-300">
                  {currentFrame + 1} / {displayedTotalFrames}
                </div>
              </div>
            </div>
          </div>          <div className="flex-1 p-4 overflow-auto">
            {!currentVideo ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-600 rounded">
                <div className="text-center">
                  <Camera size={48} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">请上传超声视频文件</p>
                  <p className="text-sm text-gray-500">支持 MP4, AVI, MOV 格式</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className="relative mx-auto"
                  style={{
                    width: 800,
                    height: 600,
                    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  onWheel={handleImageWheel}
                  onMouseDown={handlePanMouseDown}
                  onMouseMove={handlePanMouseMove}
                  onMouseUp={handlePanMouseUp}
                  onMouseLeave={handlePanMouseUp}
                >
                  <VideoPlayer
                    videoUrl={currentVideo.videoUrl}
                    currentFrame={currentFrame}
                    totalFrames={displayedTotalFrames}
                    onFrameChange={setCurrentFrame}
                    onTimeUpdate={() => {}}
                    frameStep={frameStep}
                    width={800}
                    height={600}
                    className="w-full h-full"
                    onCanvasRef={canvas => {
                      frameCanvasRef.current = canvas;
                    }}
                    onMouseMove={showGrayscaleInfo ? handleVideoMouseMove : undefined}
                    onMouseLeave={showGrayscaleInfo ? handleVideoMouseLeave : undefined}
                    showGrayscale={showGrayscaleInfo}
                  />

                  <div
                    className="absolute inset-0"
                    style={{ pointerEvents: isROIMode ? 'auto' : 'none' }}
                  >
                    <ROIEditor
                      imageWidth={800}
                      imageHeight={600}
                      currentROI={currentROI}
                      onROIChange={setCurrentROI}
                      onROIClear={() => setCurrentROI(null)}
                      onPointSelect={(point) => {
                        setSelectedPoint(point);
                        // 选择点后自动退出点选择模式
                        if (isPointSelectionMode) {
                          setIsPointSelectionMode(false);
                        }
                      }}
                      className="w-full h-full"
                      showROIBorder={showROIBorder}
                      showCenterPoints={showCenterPoints}
                      centerPoints={analysisCenterPoints}
                      selectedPoint={selectedPoint}
                      enablePointSelection={selectedPointConnectedComponentEnabled || isPointSelectionMode}
                      isPointSelectionMode={isPointSelectionMode}
                    />
                    {segmentationMask && showSegmentationOverlay && (
                      <canvas
                        className="absolute inset-0 pointer-events-none"
                        ref={canvas => {
                          if (!canvas) return;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          const width = 800;
                          const height = 600;
                          canvas.width = width;
                          canvas.height = height;
                          ctx.clearRect(0, 0, width, height);
                          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                          for (let y = 0; y < segmentationMask.length; y += 1) {
                            const row = segmentationMask[y];
                            for (let x = 0; x < row.length; x += 1) {
                              if (row[x]) {
                                ctx.fillRect(x, y, 1, 1);
                              }
                            }
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[800px] px-2">
                  <div className="flex items-center justify-between mb-2 text-xs text-gray-200">
                    <span>时间轴</span>
                    <span>
                      帧 {currentFrame + 1} / {displayedTotalFrames}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() =>
                        setCurrentFrame(prev => Math.max(0, prev - 1))
                      }
                      disabled={currentFrame === 0}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      上一帧
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, displayedTotalFrames - 1)}
                      value={currentFrame}
                      onChange={e => {
                        const value = parseInt(e.target.value, 10);
                        if (!Number.isNaN(value)) {
                          setCurrentFrame(value);
                        }
                      }}
                      className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <button
                      onClick={() =>
                        setCurrentFrame(prev =>
                          Math.min(displayedTotalFrames - 1, prev + 1),
                        )
                      }
                      disabled={currentFrame >= displayedTotalFrames - 1}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      下一帧
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-medium">检测结果</h2>
            {detectionResults.length > 0 && (
              <div className="text-sm text-gray-400 mt-1">共 {detectionResults.length} 帧结果</div>
            )}
          </div>
          <div className={`flex-1 p-4 ${showSettingsPanel ? 'hidden' : ''}`}>
            {currentVideo && showVisualization ? (
              <VeinVisualization
                imageWidth={800}
                imageHeight={600}
                detectionResult={currentDetection}
                visible={showVisualization}
                onToggleVisibility={() => setShowVisualization(!showVisualization)}
                showContours={showContours}
                showCenters={showCenters}
                onToggleContours={() => setShowContours(!showContours)}
                onToggleCenters={() => setShowCenters(!showCenters)}
                confidenceThreshold={confidenceThreshold}
                onConfidenceThresholdChange={setConfidenceThreshold}
                className="h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-600 rounded">
                <div className="text-center text-gray-400">
                  {currentVideo ? '检测结果可视化已隐藏' : '请先上传视频'}
                </div>
              </div>
            )}
          </div>
          {showSettingsPanel && (
            <div className="flex-1 p-4 text-sm text-gray-200 space-y-6">
              <div>
                <h3 className="font-medium mb-2">分割参数</h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="mr-2">分割模型</span>
                    <select
                      value={segmentationModel}
                      onChange={e => setSegmentationModel(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
                    >
                      <option value="smp_unet_resnet34">
                        深度模型 · SMP U-Net (ResNet34)
                      </option>
                      <option value="cv">传统 CV 分割 (OpenCV · 基础版)</option>
                      <option value="cv_enhanced">
                        传统 CV 分割 (Frangi 增强版)
                      </option>
                      <option value="cv_simple_center">T1 中心黑区 · 简单 CV</option>
                      <option value="elliptical_morph">阈值分割</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="mr-2">显示分割叠加</span>
                    <input
                      type="checkbox"
                      checked={showSegmentationOverlay}
                      onChange={e => setShowSegmentationOverlay(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>

                  {/* 灰度值功能 */}
                  <div className="border-t border-gray-600 pt-2 mt-2">
                    <h4 className="font-medium mb-2 text-xs text-gray-300">灰度值分析</h4>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between">
                        <span className="mr-2 text-xs">显示灰度信息</span>
                        <input
                          type="checkbox"
                          checked={showGrayscaleInfo}
                          onChange={e => setShowGrayscaleInfo(e.target.checked)}
                          className="h-3 w-3"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="mr-2 text-xs">自动阈值调整</span>
                        <input
                          type="checkbox"
                          checked={autoThresholdEnabled}
                          onChange={e => setAutoThresholdEnabled(e.target.checked)}
                          disabled={!showGrayscaleInfo}
                          className="h-3 w-3"
                        />
                      </label>
                      {currentGrayscaleValue !== null && showGrayscaleInfo && (
                        <div className="bg-gray-800 rounded px-2 py-1 text-xs">
                          <div>当前灰度值: {currentGrayscaleValue}/255</div>
                          <div className="text-gray-400">
                            建议阈值: {Math.round(currentGrayscaleValue * 0.8)}
                          </div>
                          {testMode && (
                            <div className="text-orange-400 mt-1">
                              测试模式: 移动鼠标查看不同区域的灰度值
                            </div>
                          )}
                        </div>
                      )}
                      {testMode && (
                        <div className="bg-orange-900 bg-opacity-30 border border-orange-600 rounded px-2 py-1 text-xs">
                          <div className="text-orange-300 font-medium mb-1">测试模式说明:</div>
                          <div className="text-orange-200 space-y-1">
                            • 鼠标悬停查看当前像素灰度值</div>
                          <div>• 启用自动阈值会根据灰度值调整参数</div>
                          <div>• 切换到普通模式处理实际视频</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">检测结果可视化</h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="mr-2">显示检测结果层</span>
                    <input
                      type="checkbox"
                      checked={showVisualization}
                      onChange={e => setShowVisualization(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="block">
                    <div className="flex items-center justify-between mb-1">
                      <span>置信度阈值</span>
                      <span>{confidenceThreshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={confidenceThreshold}
                      onChange={e => setConfidenceThreshold(Number(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">播放 / 抽帧</h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="mr-2">抽帧步长</span>
                    <select
                      value={frameStep}
                      onChange={e => {
                        const value = parseInt(e.target.value, 10) || 1;
                        setFrameStep(value);
                        setCurrentFrame(0);
                      }}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
                    >
                      <option value={1}>每帧</option>
                      <option value={2}>每 2 帧</option>
                      <option value={5}>每 5 帧</option>
                      <option value={10}>每 10 帧</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}
          {showSettingsPanel && isEnhancedCV && (
            <div className="flex-1 p-4 text-sm text-gray-200 space-y-3">
              <div>
                <h3 className="font-medium mb-2">增强 OpenCV 参数</h3>
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
                          value={enhancedCVParams.blurKernelSize}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              blurKernelSize: Number(e.target.value) || 1,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>CLAHE 对比度</span>
                        <input
                          type="number"
                          min={0.5}
                          step={0.1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.claheClipLimit}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              claheClipLimit: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>CLAHE 网格大小</span>
                        <input
                          type="number"
                          min={2}
                          step={1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.claheTileGridSize}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              claheTileGridSize: Number(e.target.value) || 1,
                            }))
                          }
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
                          value={enhancedCVParams.frangiScaleMin}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              frangiScaleMin: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>尺度最大</span>
                        <input
                          type="number"
                          min={enhancedCVParams.frangiScaleMin}
                          step={0.1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.frangiScaleMax}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              frangiScaleMax: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>尺度步长</span>
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.frangiScaleStep}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              frangiScaleStep: Number(e.target.value) || 0.1,
                            }))
                          }
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
                          value={enhancedCVParams.frangiThreshold}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              frangiThreshold: Number(e.target.value) || 0,
                            }))
                          }
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
                          value={enhancedCVParams.areaMin}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              areaMin: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>面积最大</span>
                        <input
                          type="number"
                          min={enhancedCVParams.areaMin}
                          step={10}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.areaMax}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              areaMax: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>长宽比最小</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.aspectRatioMin}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              aspectRatioMin: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>长宽比最大</span>
                        <input
                          type="number"
                          min={enhancedCVParams.aspectRatioMin}
                          step={0.1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.aspectRatioMax}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              aspectRatioMax: Number(e.target.value) || 0,
                            }))
                          }
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
                          value={enhancedCVParams.centerBandTop}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              centerBandTop: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>中心带底部(0–1)</span>
                        <input
                          type="number"
                          min={enhancedCVParams.centerBandTop}
                          max={1}
                          step={0.05}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.centerBandBottom}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              centerBandBottom: Number(e.target.value) || 0,
                            }))
                          }
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
                          value={enhancedCVParams.morphKernelSize}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              morphKernelSize: Number(e.target.value) || 1,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>闭运算迭代</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.morphCloseIterations}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              morphCloseIterations: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>开运算迭代</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={enhancedCVParams.morphOpenIterations}
                          onChange={e =>
                            setEnhancedCVParams(prev => ({
                              ...prev,
                              morphOpenIterations: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showSettingsPanel && segmentationModel.toLowerCase() === 'cv_simple_center' && (
            <div className="flex-1 p-4 text-sm text-gray-200 space-y-3">
              <div>
                <h3 className="font-medium mb-2">T1 中心黑区参数（简单 CV）</h3>
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
                        onChange={e => setSimplePreStrength(Number(e.target.value))}
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
                          value={simpleCenterParams.blurKernelSize}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              blurKernelSize: Number(e.target.value) || 1,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>CLAHE 对比度</span>
                        <input
                          type="number"
                          min={0.5}
                          step={0.1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={simpleCenterParams.claheClipLimit}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              claheClipLimit: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>CLAHE 网格大小</span>
                        <input
                          type="number"
                          min={2}
                          step={1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={simpleCenterParams.claheTileGridSize}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              claheTileGridSize: Number(e.target.value) || 1,
                            }))
                          }
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
                        onChange={e => setSimpleMorphStrength(Number(e.target.value))}
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
                          value={simpleCenterParams.morphKernelSize}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              morphKernelSize: Number(e.target.value) || 1,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>闭运算次数</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={simpleCenterParams.morphCloseIterations}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              morphCloseIterations: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>开运算次数</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={simpleCenterParams.morphOpenIterations}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              morphOpenIterations: Number(e.target.value) || 0,
                            }))
                          }
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
                          value={simpleCenterParams.areaMinFactor}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              areaMinFactor: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs">
                        <span>面积上限因子</span>
                        <input
                          type="number"
                          min={simpleCenterParams.areaMinFactor}
                          max={1}
                          step={0.01}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-center"
                          value={simpleCenterParams.areaMaxFactor}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              areaMaxFactor: Number(e.target.value) || 0,
                            }))
                          }
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
                          value={simpleCenterParams.circularityMin}
                          onChange={e =>
                            setSimpleCenterParams(prev => ({
                              ...prev,
                              circularityMin: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showSettingsPanel && segmentationModel.toLowerCase() === 'elliptical_morph' && (
            <div className="flex-1 p-4 text-sm text-gray-200 space-y-3">
              <div>
                <h3 className="font-medium mb-2">阈值分割参数</h3>
                <div className="mb-4 p-3 bg-blue-600 bg-opacity-20 border border-blue-500 rounded">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={autoAnalysisEnabled}
                        onChange={e => setAutoAnalysisEnabled(e.target.checked)}
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
                        <span className="text-gray-400">{ellipticalMorphParams.thresholdMin}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={ellipticalMorphParams.thresholdMin}
                        onChange={e =>
                          setEllipticalMorphParams(prev => ({
                            ...prev,
                            thresholdMin: Number(e.target.value),
                          }))
                        }
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
                        <span className="text-gray-400">{ellipticalMorphParams.thresholdMax}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={ellipticalMorphParams.thresholdMax}
                        onChange={e =>
                          setEllipticalMorphParams(prev => ({
                            ...prev,
                            thresholdMax: Number(e.target.value),
                          }))
                        }
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
                          checked={maxConnectedComponentEnabled}
                          onChange={e => setMaxConnectedComponentEnabled(e.target.checked)}
                          className="h-4 w-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium">🔗 最大连通区域检测</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${maxConnectedComponentEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                        {maxConnectedComponentEnabled ? '已启用' : '已禁用'}
                      </span>
                    </label>
                    <p className="text-xs text-gray-400 mt-2 ml-6">
                      启用后，只保留mask中最大的连通区域，删除其他区域
                    </p>
                  </div>

                  {/* ROI中心点连通域检测 */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={roiCenterConnectedComponentEnabled}
                          onChange={e => setRoiCenterConnectedComponentEnabled(e.target.checked)}
                          className="h-4 w-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium">🎯 ROI中心点连通域检测</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${roiCenterConnectedComponentEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                        {roiCenterConnectedComponentEnabled ? '已启用' : '已禁用'}
                      </span>
                    </label>
                    <p className="text-xs text-gray-400 mt-2 ml-6">
                      启用后，只保留ROI中心点所在的连通区域，删除其他区域
                    </p>
                  </div>

                  {/* 选中点连通域检测 */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedPointConnectedComponentEnabled}
                          onChange={e => {
                            setSelectedPointConnectedComponentEnabled(e.target.checked);
                            // 当启用功能时，自动进入点选择模式
                            if (e.target.checked && !selectedPoint) {
                              // 可以在这里添加进入点选择模式的逻辑
                            }
                          }}
                          className="h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium">📍 选中点连通域检测</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${selectedPointConnectedComponentEnabled ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                        {selectedPointConnectedComponentEnabled ? '已启用' : '已禁用'}
                      </span>
                    </label>
                    <p className="text-xs text-gray-400 mt-2 ml-6">
                      启用后，点击ROI选择点，只保留该点所在的最大连通区域
                    </p>

                    {/* 选择关键点按钮 */}
                    {selectedPointConnectedComponentEnabled && (
                      <div className="mt-3 ml-6">
                        <button
                          onClick={() => {
                            // 切换点选择模式
                            setIsPointSelectionMode(!isPointSelectionMode);
                            if (!isPointSelectionMode) {
                              // 进入点选择模式时的提示
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

                    {selectedPointConnectedComponentEnabled && (
                      <div className="mt-2 ml-6 text-xs text-gray-300">
                        当前选中点: {selectedPoint ? `(${selectedPoint.x}, ${selectedPoint.y})` : '请点击ROI选择点'}
                        {selectedPoint && (
                          <button
                            onClick={() => setSelectedPoint(null)}
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
          )}
          {isAnalyzing && (
            <div className="p-4 border-t border-gray-700">
              <div className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>分析进度</span>
                  <span>{analysisProgress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
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
























