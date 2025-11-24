// Algorithm parameter types for vein detection

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
};

export type ConnectedComponentOptions = {
  ellipticalConstraintEnabled: boolean;
  maxConnectedComponentEnabled: boolean;
  roiCenterConnectedComponentEnabled: boolean;
  selectedPointConnectedComponentEnabled: boolean;
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