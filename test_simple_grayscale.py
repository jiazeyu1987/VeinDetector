#!/usr/bin/env python3
"""
Simple test for grayscale value consistency
"""

import numpy as np
import cv2
from PIL import Image
import base64
from io import BytesIO
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from samus_inference import decode_image_from_data_url

def test_simple_case():
    """Test simple grayscale calculation"""
    print("Testing grayscale calculation consistency")
    print("=" * 50)

    # Create simple test image
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    # Set a gray pixel (value 50)
    img[25, 25] = [50, 50, 50]
    # Set a dark pixel (value 30)
    img[10, 10] = [30, 30, 30]
    # Set a bright pixel (value 80)
    img[40, 40] = [80, 80, 80]

    print("Created test image with known grayscale values")
    print("Pixel (25,25): RGB=[50,50,50] -> Expected grayscale=50")
    print("Pixel (10,10): RGB=[30,30,30] -> Expected grayscale=30")
    print("Pixel (40,40): RGB=[80,80,80] -> Expected grayscale=80")

    # Convert to PIL and back to data URL
    pil_img = Image.fromarray(img)
    buffer = BytesIO()
    pil_img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    data_url = f"data:image/png;base64,{img_b64}"

    print("Converted to data URL")

    # Decode using backend function
    try:
        decoded_img = decode_image_from_data_url(data_url)
        print("Backend decoded successfully")

        # Convert to grayscale using OpenCV
        gray_img = cv2.cvtColor(decoded_img, cv2.COLOR_RGB2GRAY)

        # Check specific pixels
        pixels_to_check = [
            (25, 25, 50, "center gray"),
            (10, 10, 30, "dark pixel"),
            (40, 40, 80, "bright pixel"),
        ]

        print("\nChecking pixel values:")
        for y, x, expected, desc in pixels_to_check:
            actual = gray_img[y, x]
            in_range_0_100 = 0 <= actual <= 100
            print(f"{desc} ({y},{x}): expected={expected}, actual={actual}, in_0_100_range={in_range_0_100}")

        # Test threshold 0-100
        mask = ((gray_img >= 0) & (gray_img <= 100)).astype(np.uint8) * 255
        print(f"\nThreshold [0,100] results:")
        print(f"Pixels marked: {(mask > 0).sum()}")
        print(f"Total pixels: {gray_img.size}")
        print(f"Percentage: {(mask > 0).sum() / gray_img.size * 100:.1f}%")

        # Check if our test pixels are marked
        for y, x, expected, desc in pixels_to_check:
            is_marked = mask[y, x] > 0
            print(f"{desc}: marked={is_marked}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_simple_case()