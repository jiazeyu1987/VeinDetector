"""
Optimized Vein Segmentation Inference System

This module provides a clean, efficient interface for vein segmentation
that eliminates code duplication and provides proper configuration management.
It serves as a drop-in replacement for the original samus_inference.py
while maintaining backward compatibility.
"""

import base64
import logging
from io import BytesIO
from typing import Dict, Optional, Tuple, Union

import cv2
import numpy as np
from PIL import Image

from model_loader import (
    BaseVeinSegmentor,
    VeinModelManager,
    get_model_manager,
    create_segmentor,
    ModelConfig
)
from models import ROIRegion

logger = logging.getLogger(__name__)


def decode_image_from_data_url(data_url: str) -> np.ndarray:
    """
    Decode frontend data URL to RGB numpy array.

    Args:
        data_url: Data URL in format "data:image/png;base64,AAAA..."

    Returns:
        RGB numpy array

    Raises:
        ValueError: If data URL is malformed or decoding fails
    """
    if not data_url.startswith("data:"):
        raise ValueError("Invalid image data URL format")

    try:
        _, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise ValueError("Malformed image data URL - missing comma separator") from exc

    try:
        image_bytes = base64.b64decode(encoded)
        with Image.open(BytesIO(image_bytes)) as img:
            image = img.convert("RGB")
        return np.array(image)
    except Exception as exc:
        logger.exception("Failed to decode image data URL")
        raise ValueError(f"Image decoding failed: {exc}") from exc


class OptimizedVeinSegmentor:
    """
    Optimized vein segmentation system that provides:
    - Unified interface for all segmentation models
    - Configuration-driven operation
    - Automatic model selection and loading
    - Proper error handling and fallback
    - Performance monitoring
    """

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the vein segmentor.

        Args:
            config_path: Path to configuration file (optional)
        """
        self.model_manager = get_model_manager(config_path)
        self.default_model = "samus"
        self._segmentation_cache = {}

    def set_default_model(self, model_type: str) -> None:
        """
        Set the default model type.

        Args:
            model_type: Model type (samus, cv_enhanced, etc.)
        """
        if model_type not in self.model_manager.list_available_models():
            raise ValueError(f"Unknown model type: {model_type}")

        self.default_model = model_type
        logger.info(f"Default model set to: {model_type}")

    def update_parameters(self, **kwargs) -> None:
        """
        Update detection parameters dynamically.

        Args:
            **kwargs: Parameters to update
        """
        self.model_manager.update_config(**kwargs)
        logger.info(f"Updated parameters: {kwargs}")

    def segment(
        self,
        image: np.ndarray,
        roi: ROIRegion,
        model_type: Optional[str] = None,
        parameters: Optional[Dict[str, float]] = None,
        return_confidence: bool = False
    ) -> Union[np.ndarray, Tuple[np.ndarray, float]]:
        """
        Perform vein segmentation with automatic model selection.

        Args:
            image: Input image (RGB or grayscale)
            roi: Region of interest
            model_type: Specific model to use (optional, uses default if None)
            parameters: Runtime parameter overrides (optional)
            return_confidence: If True, return (mask, confidence) tuple

        Returns:
            Binary mask, or (mask, confidence) if return_confidence=True
        """
        model_type = model_type or self.default_model

        try:
            # Get model instance
            model = self.model_manager.get_model(model_type)

            # Apply runtime parameters if provided
            if parameters:
                for key, value in parameters.items():
                    if hasattr(model.config, key):
                        setattr(model.config, key, value)

            # Perform segmentation
            mask = model.segment(image, roi, parameters)

            if return_confidence:
                # Calculate simple confidence based on mask coverage
                confidence = self._calculate_confidence(mask, roi)
                return mask, confidence

            return mask

        except Exception as exc:
            logger.error(f"Segmentation failed with model {model_type}: {exc}")

            # Fallback to basic CV if primary model fails
            if model_type != "cv_basic":
                logger.info("Falling back to basic CV segmentation")
                try:
                    fallback_model = self.model_manager.get_model("cv_basic")
                    mask = fallback_model.segment(image, roi, parameters)
                    if return_confidence:
                        confidence = self._calculate_confidence(mask, roi)
                        return mask, confidence
                    return mask
                except Exception as fallback_exc:
                    logger.error(f"Fallback segmentation also failed: {fallback_exc}")

            # Final fallback - return empty mask
            logger.warning("All segmentation methods failed, returning empty mask")
            if image.ndim == 2:
                empty_mask = np.zeros(image.shape, dtype=np.uint8)
            else:
                empty_mask = np.zeros(image.shape[:2], dtype=np.uint8)

            if return_confidence:
                return empty_mask, 0.0
            return empty_mask

    def _calculate_confidence(self, mask: np.ndarray, roi: ROIRegion) -> float:
        """
        Calculate confidence score for segmentation result.

        Args:
            mask: Binary segmentation mask
            roi: Region of interest used for segmentation

        Returns:
            Confidence score between 0.0 and 1.0
        """
        roi_area = roi.width * roi.height
        if roi_area <= 0:
            return 0.0

        mask_area = np.sum(mask > 0)
        coverage_ratio = mask_area / roi_area

        # Heuristic confidence calculation
        # Too little coverage or too much coverage might indicate problems
        if coverage_ratio < 0.01:  # Very little detection
            return coverage_ratio * 50  # Scale up slightly
        elif coverage_ratio > 0.8:  # Too much coverage
            return max(0.1, 1.0 - (coverage_ratio - 0.8))
        else:
            # Sweet spot around 10-60% coverage
            return min(1.0, coverage_ratio * 1.5)

    def get_available_models(self) -> list:
        """Get list of available model types."""
        return self.model_manager.list_available_models()

    def get_model_info(self, model_type: Optional[str] = None) -> dict:
        """
        Get information about a specific model.

        Args:
            model_type: Model type (optional, uses default if None)

        Returns:
            Dictionary with model information
        """
        model_type = model_type or self.default_model
        model = self.model_manager.get_model(model_type)

        return {
            "type": model_type,
            "device": str(model.device),
            "initialized": model._initialized,
            "config": model.config.__dict__
        }

    def benchmark_models(
        self,
        image: np.ndarray,
        roi: ROIRegion,
        iterations: int = 3
    ) -> dict:
        """
        Benchmark different models on the same input.

        Args:
            image: Test image
            roi: Test ROI
            iterations: Number of iterations for timing

        Returns:
            Dictionary with benchmark results
        """
        import time

        results = {}

        for model_type in self.get_available_models():
            try:
                model = self.model_manager.get_model(model_type)

                # Warmup
                model.segment(image, roi)

                # Benchmark
                times = []
                for _ in range(iterations):
                    start_time = time.time()
                    mask = model.segment(image, roi)
                    end_time = time.time()
                    times.append(end_time - start_time)

                avg_time = sum(times) / len(times)
                mask_coverage = np.sum(mask > 0) / (roi.width * roi.height)

                results[model_type] = {
                    "avg_time_seconds": avg_time,
                    "mask_coverage": mask_coverage,
                    "iterations": iterations,
                    "device": str(model.device)
                }

            except Exception as exc:
                results[model_type] = {
                    "error": str(exc),
                    "iterations": 0
                }
                logger.error(f"Benchmark failed for {model_type}: {exc}")

        return results


# Global segmentor instance for backward compatibility
_global_segmentor = None


def get_segmentor(config_path: Optional[str] = None) -> OptimizedVeinSegmentor:
    """Get global vein segmentor instance."""
    global _global_segmentor
    if _global_segmentor is None:
        _global_segmentor = OptimizedVeinSegmentor(config_path)
    return _global_segmentor


# Legacy compatibility functions
def create_samus_segmentor() -> 'SamusVeinSegmentor':
    """Create SAMUS segmentor for backward compatibility."""
    from model_loader import SamusVeinSegmentor, ModelConfig
    return SamusVeinSegmentor(ModelConfig())


def create_enhanced_cv_segmentor() -> 'EnhancedCVVeinSegmentor':
    """Create enhanced CV segmentor for backward compatibility."""
    from model_loader import EnhancedCVVeinSegmentor, ModelConfig
    return EnhancedCVVeinSegmentor(ModelConfig())


def segment_veins(
    image: np.ndarray,
    roi: ROIRegion,
    model_type: str = "samus",
    parameters: Optional[Dict[str, float]] = None
) -> np.ndarray:
    """
    Convenience function for simple vein segmentation.

    Args:
        image: Input image
        roi: Region of interest
        model_type: Model type to use
        parameters: Optional parameters

    Returns:
        Binary segmentation mask
    """
    segmentor = get_segmentor()
    return segmentor.segment(image, roi, model_type, parameters)


# Quick test function
def _quick_test():
    """Quick test of the optimized system."""
    try:
        # Create test image
        test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        test_roi = ROIRegion(x=100, y=100, width=200, height=150)

        # Test segmentation
        segmentor = get_segmentor()
        mask = segmentor.segment(test_image, test_roi)

        logger.info(f"Quick test successful. Mask shape: {mask.shape}, non-zero pixels: {np.sum(mask > 0)}")

        # Test model info
        info = segmentor.get_model_info()
        logger.info(f"Model info: {info}")

        return True

    except Exception as exc:
        logger.error(f"Quick test failed: {exc}")
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    _quick_test()