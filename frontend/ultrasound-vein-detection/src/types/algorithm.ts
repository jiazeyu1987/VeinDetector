// Algorithm parameter types for vein detection

// 处理模式枚举 - 五种互斥的处理模式
export enum ProcessingMode {
  DIRECT_RAW_MASK = 'direct_raw_mask',          // 直接显示原始mask
  IMAGE_PREPROCESSING = 'image_preprocessing',   // 图像预处理
  MAX_CONNECTED_COMPONENT = 'max_connected_component',  // 最大连通区域检测
  ROI_CENTER_CONNECTED = 'roi_center_connected',  // ROI中心点连通域检测
  SELECTED_POINT_CONNECTED = 'selected_point_connected'  // 选中点连通域检测
}

export type EnhancedCVParams = {
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

export type SimpleCenterParams = {
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

export type EllipticalMorphParams = {
  thresholdMin: number;
  thresholdMax: number;
  ellipseMajorAxis: number;
  ellipseMinorAxis: number;
  ellipseAngle: number;
  morphStrength: number;
  blurKernelSize: number;
  claheClipLimit: number;
  claheTileGridSize: number;
  processingMode: ProcessingMode;  // 使用新的枚举替代多个布尔值
  ellipticalConstraintEnabled: boolean;  // 保留椭圆约束选项
};

export type Point2D = {
  x: number;
  y: number;
};

export type ZoomPanState = {
  zoom: number;
  panX: number;
  panY: number;
};

export type VideoControlState = {
  isPlaying: boolean;
  frameStep: number;
  zoom: number;
  panX: number;
  panY: number;
};

export type AnalysisState = {
  isAnalyzing: boolean;
  analysisProgress: number;
  autoAnalysisEnabled: boolean;
  autoThresholdEnabled: boolean;
};

export type DisplayState = {
  showSegmentationOverlay: boolean;
  showCenterPoints: boolean;
  showVisualization: boolean;
  showContours: boolean;
  showCenters: boolean;
  showGrayscaleInfo: boolean;
  showSettingsPanel: boolean;
  showROIBorder: boolean;
  confidenceThreshold: number;
};

export type GrayscaleInfo = {
  currentValue: number | null;
  showGrayscaleInfo: boolean;
  autoThresholdEnabled: boolean;
  testMode: boolean;
};

export type ConnectedComponentCenter = {
  x: number;
  y: number;
  area: number;
  label: number;
  confidence: number;
};

export type ROIControlState = {
  isROIMode: boolean;
  isPointSelectionMode: boolean;
  selectedPoint: Point2D | null;
};