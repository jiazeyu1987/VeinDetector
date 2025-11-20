"""
Dynamic Model Loading and Management System for Vein Detection

This module provides a unified interface for loading and managing different
vein segmentation models while eliminating code duplication and providing
proper configuration-driven operation.
"""

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Type, Union
from pathlib import Path
try:
    import yaml
except ImportError:
    yaml = None
    logging.warning("PyYAML not available - configuration file support disabled")

import torch
import torch.nn.functional as F

# ---------------------------------------------------------------------------
# Compatibility shim for torch.utils._pytree / transformers
# Newer versions of transformers call torch.utils._pytree.register_pytree_node
# with an extra keyword argument (serialized_type_name) which older torch
# versions do not accept. We need to patch this before any transformers import.
import sys
import warnings

# Store original register_pytree_node if it exists
_orig_register_pytree_node = None

def _patch_torch_pytree():
    """Patch torch.utils._pytree to handle transformers compatibility."""
    try:
        import torch.utils._pytree as _pytree  # type: ignore[attr-defined]

        # Patch both register_pytree_node and _register_pytree_node
        for func_name in ['register_pytree_node', '_register_pytree_node']:
            if hasattr(_pytree, func_name):
                orig_func = getattr(_pytree, func_name)

                def _shim_register(*args, **kwargs):
                    # Remove the problematic keyword argument
                    kwargs.pop("serialized_type_name", None)
                    return orig_func(*args, **kwargs)

                # Set the shim
                setattr(_pytree, func_name, _shim_register)
                globals()[f'_orig_{func_name}'] = orig_func

    except Exception as e:
        warnings.warn(f"Failed to patch torch.utils._pytree: {e}")

# Apply the patch immediately
_patch_torch_pytree()

# Also prevent transformers from causing issues by setting environment variable
import os
os.environ['TRANSFORMERS_CACHE'] = os.path.join(os.getcwd(), 'cache', 'transformers')
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import cv2
import numpy as np
from PIL import Image
from skimage.filters import frangi

# Model imports with fallback handling
try:
    import segmentation_models_pytorch as smp
except ImportError:
    smp = None
    logging.warning("segmentation_models_pytorch not available")

from models import ROIRegion

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """Configuration for vein detection models and algorithms."""

    # Model selection
    model_type: str = "samus"  # samus, unet, cv_enhanced, cv_simple, cv_basic

    # Deep Learning Model Config
    encoder_name: str = "resnet34"
    encoder_weights: str = "imagenet"
    in_channels: int = 3
    classes: int = 1
    model_path: Optional[str] = None
    threshold: float = 0.5

    # Image Processing Config
    blur_kernel_size: int = 5
    clahe_clip_limit: float = 2.0
    clahe_tile_grid_size: int = 8
    morph_kernel_size: int = 5
    morph_close_iterations: int = 2
    morph_open_iterations: int = 1

    # Enhanced CV Config
    frangi_scale_min: float = 1.5
    frangi_scale_max: float = 5.0
    frangi_scale_step: float = 0.5
    frangi_threshold: float = 0.04

    # Contour Filtering Config
    area_min: float = 300.0
    area_max: float = 3500.0
    aspect_ratio_min: float = 0.6
    aspect_ratio_max: float = 1.6
    center_band_top: float = 0.4
    center_band_bottom: float = 0.8

    # Simple CV Config
    area_min_factor: float = 0.01
    area_max_factor: float = 0.4
    circularity_min: float = 0.4

    # Device Config
    device: str = "auto"  # auto, cpu, cuda

    # Padding Config
    padding_size: int = 32

    def __post_init__(self):
        """Validate and normalize configuration parameters."""
        # Ensure odd kernel sizes
        if self.blur_kernel_size % 2 == 0:
            self.blur_kernel_size += 1
        if self.morph_kernel_size % 2 == 0:
            self.morph_kernel_size += 1

        # Validate ranges
        self.threshold = max(0.0, min(1.0, self.threshold))
        self.clahe_clip_limit = max(0.1, self.clahe_clip_limit)


class ModelRegistry:
    """Registry for managing available vein segmentation models."""

    _models: Dict[str, Type["BaseVeinSegmentor"]] = {}

    @classmethod
    def register(cls, name: str, model_class: Type["BaseVeinSegmentor"]):
        """Register a model class with the registry."""
        cls._models[name.lower()] = model_class
        logger.info(f"Registered model: {name}")

    @classmethod
    def get_model(cls, name: str) -> Optional[Type["BaseVeinSegmentor"]]:
        """Get a model class by name."""
        return cls._models.get(name.lower())

    @classmethod
    def list_models(cls) -> List[str]:
        """List all registered model names."""
        return list(cls._models.keys())


class BaseVeinSegmentor(ABC):
    """Abstract base class for all vein segmentation models."""

    def __init__(self, config: ModelConfig):
        self.config = config
        self.device = self._get_device()
        self._initialized = False

    def _get_device(self) -> torch.device:
        """Determine the appropriate device for computation."""
        if self.config.device == "auto":
            return torch.device("cuda" if torch.cuda.is_available() else "cpu")
        return torch.device(self.config.device)

    @abstractmethod
    def _initialize_model(self) -> None:
        """Initialize the model (lazy loading)."""
        pass

    @abstractmethod
    def _segment_roi(self, roi_image: np.ndarray) -> np.ndarray:
        """Perform segmentation on ROI image."""
        pass

    def _ensure_initialized(self) -> None:
        """Lazy initialization to avoid resource usage at import time."""
        if not self._initialized:
            self._initialize_model()
            self._initialized = True

    def _extract_roi(self, image: np.ndarray, roi: ROIRegion) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
        """Extract ROI from full image with validation."""
        if image.ndim == 2:
            height, width = image.shape
            gray = image
            rgb_image = np.stack([image] * 3, axis=-1)
        else:
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            rgb_image = image

        # Calculate ROI bounds with validation
        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            raise ValueError(f"Invalid ROI: ({x1},{y1}) to ({x2},{y2})")

        roi_img = gray[y1:y2, x1:x2]
        roi_rgb = rgb_image[y1:y2, x1:x2]

        return roi_img, roi_rgb, (x1, y1, x2 - x1, y2 - y1)

    def _reconstruct_full_mask(self, roi_mask: np.ndarray, roi_bounds: Tuple[int, int, int, int],
                              full_shape: Tuple[int, int]) -> np.ndarray:
        """Reconstruct full image mask from ROI mask."""
        height, width = full_shape
        x1, y1, roi_w, roi_h = roi_bounds

        full_mask = np.zeros((height, width), dtype=np.uint8)

        # Ensure ROI mask fits within bounds
        roi_h_actual = min(roi_h, roi_mask.shape[0])
        roi_w_actual = min(roi_w, roi_mask.shape[1])

        full_mask[y1:y1 + roi_h_actual, x1:x1 + roi_w_actual] = roi_mask[:roi_h_actual, :roi_w_actual]

        return full_mask

    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Apply common image preprocessing."""
        # Gaussian blur
        ksize = self.config.blur_kernel_size
        blurred = cv2.GaussianBlur(image, (ksize, ksize), 0)

        # CLAHE enhancement
        clahe = cv2.createCLAHE(
            clipLimit=self.config.clahe_clip_limit,
            tileGridSize=(self.config.clahe_tile_grid_size, self.config.clahe_tile_grid_size)
        )
        enhanced = clahe.apply(blurred)

        return enhanced

    def _apply_morphology(self, binary_image: np.ndarray) -> np.ndarray:
        """Apply morphological operations."""
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (self.config.morph_kernel_size, self.config.morph_kernel_size)
        )

        # Close operation (fill holes)
        closed = cv2.morphologyEx(
            binary_image,
            cv2.MORPH_CLOSE,
            kernel,
            iterations=self.config.morph_close_iterations
        )

        # Open operation (remove noise)
        opened = cv2.morphologyEx(
            closed,
            cv2.MORPH_OPEN,
            kernel,
            iterations=self.config.morph_open_iterations
        )

        return opened

    def segment(self, image: np.ndarray, roi: ROIRegion,
                parameters: Optional[Dict[str, float]] = None) -> np.ndarray:
        """
        Main segmentation method with unified error handling and validation.

        Args:
            image: Input image (grayscale or RGB)
            roi: Region of interest
            parameters: Optional parameter overrides

        Returns:
            Binary segmentation mask
        """
        try:
            # Update config with runtime parameters
            if parameters:
                self._update_config(parameters)

            # Extract ROI with validation
            try:
                roi_img, roi_rgb, roi_bounds = self._extract_roi(image, roi)
            except ValueError as exc:
                logger.warning(f"ROI extraction failed: {exc}")
                if image.ndim == 2:
                    return np.zeros(image.shape, dtype=np.uint8)
                else:
                    return np.zeros(image.shape[:2], dtype=np.uint8)

            # Initialize model if needed
            self._ensure_initialized()

            # Perform segmentation
            roi_mask = self._segment_roi(roi_img, roi_rgb)

            # Reconstruct full mask
            full_shape = image.shape[:2] if image.ndim > 2 else image.shape
            full_mask = self._reconstruct_full_mask(roi_mask, roi_bounds, full_shape)

            return full_mask

        except Exception as exc:
            logger.exception(f"Segmentation failed: {exc}")
            # Return empty mask as fallback
            if image.ndim == 2:
                return np.zeros(image.shape, dtype=np.uint8)
            else:
                return np.zeros(image.shape[:2], dtype=np.uint8)

    def _update_config(self, parameters: Dict[str, float]) -> None:
        """Update configuration with runtime parameters."""
        for key, value in parameters.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
            else:
                logger.debug(f"Unknown parameter: {key}")


class SamusVeinSegmentor(BaseVeinSegmentor):
    """SAMUS U-Net based vein segmentation with dynamic loading."""

    def _initialize_model(self) -> None:
        """Initialize SMP U-Net model."""
        if smp is None:
            raise RuntimeError("segmentation_models_pytorch not available")

        logger.info(f"Initializing SAMUS U-Net with {self.config.encoder_name} encoder...")

        self.model = smp.Unet(
            encoder_name=self.config.encoder_name,
            encoder_weights=self.config.encoder_weights,
            in_channels=self.config.in_channels,
            classes=self.config.classes,
            activation=None,
        )

        self.model.to(self.device)
        self.model.eval()

        # Load custom weights if specified
        if self.config.model_path and os.path.exists(self.config.model_path):
            logger.info(f"Loading custom weights from {self.config.model_path}")
            state_dict = torch.load(self.config.model_path, map_location=self.device)
            self.model.load_state_dict(state_dict)

    def _prepare_roi_tensor(self, roi_rgb: np.ndarray) -> torch.Tensor:
        """Convert ROI RGB image to model input tensor."""
        tensor = torch.from_numpy(roi_rgb).float() / 255.0
        tensor = tensor.permute(2, 0, 1).unsqueeze(0)  # 1,3,H,W

        # Pad to multiple of padding_size
        _, _, h, w = tensor.shape
        pad_h = (self.config.padding_size - h % self.config.padding_size) % self.config.padding_size
        pad_w = (self.config.padding_size - w % self.config.padding_size) % self.config.padding_size

        if pad_h or pad_w:
            tensor = F.pad(tensor, (0, pad_w, 0, pad_h), mode="reflect")

        return tensor.to(self.device)

    def _segment_roi(self, roi_img: np.ndarray, roi_rgb: np.ndarray) -> np.ndarray:
        """Segment ROI using U-Net model."""
        if self.model is None:
            # Return empty mask if model not available
            return np.zeros(roi_img.shape, dtype=np.uint8)

        # Prepare tensor
        roi_tensor = self._prepare_roi_tensor(roi_rgb)
        _, _, orig_h, orig_w = roi_tensor.shape

        # Inference
        with torch.no_grad():
            pred = self.model(roi_tensor)
            pred = torch.sigmoid(pred)

        # Remove padding
        pred = pred[:, :, :orig_h, :orig_w]
        prob_mask = pred[0, 0].cpu().numpy()

        # Threshold to get binary mask
        binary_mask = (prob_mask > self.config.threshold).astype(np.uint8)

        return binary_mask


class BasicCVVeinSegmentor(BaseVeinSegmentor):
    """Basic computer vision-based vein segmentation."""

    def _initialize_model(self) -> None:
        """No model to initialize for CV approach."""
        self._initialized = True

    def _segment_roi(self, roi_img: np.ndarray, roi_rgb: np.ndarray) -> np.ndarray:
        """Segment ROI using basic CV approach."""
        # Preprocess
        enhanced = self._preprocess_image(roi_img)

        # Thresholding
        _, thresh = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )

        # Morphology
        processed = self._apply_morphology(thresh)

        return (processed > 0).astype(np.uint8)


class EnhancedCVVeinSegmentor(BaseVeinSegmentor):
    """Enhanced computer vision-based vein segmentation with Frangi filters."""

    def _initialize_model(self) -> None:
        """No model to initialize for CV approach."""
        self._initialized = True

    def _segment_roi(self, roi_img: np.ndarray, roi_rgb: np.ndarray) -> np.ndarray:
        """Segment ROI using enhanced CV approach."""
        # Preprocess
        enhanced = self._preprocess_image(roi_img)

        # Frangi vessel detection
        enhanced_norm = enhanced.astype(np.float32) / 255.0
        try:
            vessel_prob = frangi(
                enhanced_norm,
                scale_range=(self.config.frangi_scale_min, self.config.frangi_scale_max),
                scale_step=self.config.frangi_scale_step,
                black_ridges=True,
            )
        except Exception as exc:
            logger.warning(f"Frangi filter failed: {exc}")
            vessel_prob = np.zeros_like(enhanced_norm)

        # Dark region detection
        _, dark_mask = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )

        # Combine vessel and dark region detection
        vessel_mask = vessel_prob > self.config.frangi_threshold
        combined_mask = np.logical_and(vessel_mask, dark_mask > 0)
        vessel_binary = combined_mask.astype(np.uint8) * 255

        # Morphology
        processed = self._apply_morphology(vessel_binary)

        # Contour filtering
        return self._filter_contours(processed, roi_img.shape)

    def _filter_contours(self, binary_image: np.ndarray, shape: Tuple[int, int]) -> np.ndarray:
        """Filter contours based on shape and position criteria."""
        contours, _ = cv2.findContours(binary_image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        roi_h, roi_w = shape
        mask = np.zeros(shape, dtype=np.uint8)

        for contour in contours:
            area = cv2.contourArea(contour)

            # Area filtering
            if not (self.config.area_min <= area <= self.config.area_max):
                continue

            # Aspect ratio filtering
            x, y, w, h = cv2.boundingRect(contour)
            if h == 0:
                continue
            aspect_ratio = float(w) / h

            if not (self.config.aspect_ratio_min <= aspect_ratio <= self.config.aspect_ratio_max):
                continue

            # Center band filtering
            center_y = y + h / 2.0
            if not (self.config.center_band_top * roi_h < center_y < self.config.center_band_bottom * roi_h):
                continue

            cv2.drawContours(mask, [contour], -1, 1, thickness=-1)

        return mask


# Register models
ModelRegistry.register("samus", SamusVeinSegmentor)
ModelRegistry.register("unet", SamusVeinSegmentor)  # Alias
ModelRegistry.register("cv_basic", BasicCVVeinSegmentor)
ModelRegistry.register("cv", BasicCVVeinSegmentor)  # Alias
ModelRegistry.register("cv_enhanced", EnhancedCVVeinSegmentor)
ModelRegistry.register("cv-frangi", EnhancedCVVeinSegmentor)  # Alias


class VeinModelManager:
    """High-level manager for vein detection models with configuration support."""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or "config.yaml"
        self.config = self._load_config()
        self.models: Dict[str, BaseVeinSegmentor] = {}

    def _load_config(self) -> ModelConfig:
        """Load configuration from file or create default."""
        if yaml is None:
            logger.info("PyYAML not available, using default configuration")
            return ModelConfig()

        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    data = yaml.safe_load(f)
                    return ModelConfig(**data)
            except Exception as exc:
                logger.warning(f"Failed to load config from {self.config_path}: {exc}")

        return ModelConfig()

    def save_config(self) -> None:
        """Save current configuration to file."""
        if yaml is None:
            logger.warning("PyYAML not available, cannot save configuration")
            return

        try:
            with open(self.config_path, 'w') as f:
                yaml.dump(self.config.__dict__, f, default_flow_style=False)
            logger.info(f"Configuration saved to {self.config_path}")
        except Exception as exc:
            logger.error(f"Failed to save config: {exc}")

    def get_model(self, model_type: Optional[str] = None) -> BaseVeinSegmentor:
        """Get or create a model instance."""
        model_type = model_type or self.config.model_type

        if model_type not in self.models:
            # Create config copy for this model type
            model_config = ModelConfig(**self.config.__dict__)
            model_config.model_type = model_type

            # Get model class
            model_class = ModelRegistry.get_model(model_type)
            if model_class is None:
                raise ValueError(f"Unknown model type: {model_type}")

            # Create model instance
            self.models[model_type] = model_class(model_config)
            logger.info(f"Created new model instance: {model_type}")

        return self.models[model_type]

    def update_config(self, **kwargs) -> None:
        """Update configuration parameters."""
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
            else:
                logger.warning(f"Unknown config parameter: {key}")

    def list_available_models(self) -> List[str]:
        """List all available model types."""
        return ModelRegistry.list_models()


# Global manager instance
_model_manager = None


def get_model_manager(config_path: Optional[str] = None) -> VeinModelManager:
    """Get global model manager instance."""
    global _model_manager
    if _model_manager is None:
        _model_manager = VeinModelManager(config_path)
    return _model_manager


def create_segmentor(model_type: str = "samus", **kwargs) -> BaseVeinSegmentor:
    """Convenience function to create a segmentor."""
    config = ModelConfig(model_type=model_type, **kwargs)

    model_class = ModelRegistry.get_model(model_type)
    if model_class is None:
        raise ValueError(f"Unknown model type: {model_type}")

    return model_class(config)
