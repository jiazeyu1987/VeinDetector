#!/usr/bin/env python3
"""
测试前端和后端灰度值一致性问题
"""

import numpy as np
import cv2
from PIL import Image
import base64
from io import BytesIO
import sys
import os

# 添加backend路径以便导入decode_image_from_data_url
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from samus_inference import decode_image_from_data_url

def create_test_image():
    """创建一个简单的测试图像，包含已知的灰度值"""
    # 创建一个100x100的RGB图像
    img = np.zeros((100, 100, 3), dtype=np.uint8)

    # 设置一些已知的颜色值
    # 纯红色 (255,0,0) -> 灰度值约76
    img[10:20, 10:20] = [255, 0, 0]
    # 纯绿色 (0,255,0) -> 灰度值约150
    img[30:40, 30:40] = [0, 255, 0]
    # 纯蓝色 (0,0,255) -> 灰度值约29
    img[50:60, 50:60] = [0, 0, 255]
    # 灰色 (128,128,128) -> 灰度值128
    img[70:80, 70:80] = [128, 128, 128]
    # 白色 (255,255,255) -> 灰度值255
    img[85:95, 85:95] = [255, 255, 255]

    return img

def frontend_grayscale_calculation(pixel_rgb):
    """前端使用的灰度计算方法"""
    r, g, b = pixel_rgb
    # 前端公式: 0.299*R + 0.587*G + 0.114*B
    grayscale = int(round(0.299 * r + 0.587 * g + 0.114 * b))
    return grayscale

def backend_grayscale_calculation(pixel_rgb):
    """后端OpenCV使用的灰度计算方法"""
    r, g, b = pixel_rgb
    # OpenCV默认公式: 0.299*R + 0.587*G + 0.114*B (与前端相同)
    grayscale = int(round(0.299 * r + 0.587 * g + 0.114 * b))
    return grayscale

def image_to_data_url(img):
    """将numpy图像转换为data URL格式（模拟前端）"""
    # 转换为PIL图像
    pil_img = Image.fromarray(img.astype(np.uint8))

    # 转换为bytes
    buffer = BytesIO()
    pil_img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()

    # 转换为base64
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')

    # 构造data URL
    data_url = f"data:image/png;base64,{img_b64}"

    return data_url

def test_grayscale_consistency():
    """Test grayscale consistency between frontend and backend"""
    print("Test: Frontend-Backend Grayscale Consistency")
    print("=" * 60)

    # 创建测试图像
    original_img = create_test_image()
    print(f"Created test image with shape: {original_img.shape}")

    # 定义测试点和预期的RGB值
    test_points = [
        ((15, 15), [255, 0, 0], "Pure Red"),
        ((35, 35), [0, 255, 0], "Pure Green"),
        ((55, 55), [0, 0, 255], "Pure Blue"),
        ((75, 75), [128, 128, 128], "Gray"),
        ((90, 90), [255, 255, 255], "White"),
        ((50, 50), [0, 0, 0], "Black Background"),
    ]

    print("\nTesting specific pixels:")
    print("-" * 40)

    for (y, x), expected_rgb, desc in test_points:
        actual_rgb = original_img[y, x].tolist()

        # 前端计算
        frontend_gray = frontend_grayscale_calculation(actual_rgb)

        # 后端计算
        backend_gray = backend_grayscale_calculation(actual_rgb)

        print(f"{desc} ({y},{x}):")
        print(f"  RGB值: {actual_rgb}")
        print(f"  前端灰度: {frontend_gray}")
        print(f"  后端灰度: {backend_gray}")
        print(f"  差异: {abs(frontend_gray - backend_gray)}")
        print()

    # 测试完整的图像处理流程
    print("🔄 测试完整图像处理流程:")
    print("-" * 40)

    # 1. 转换为data URL (模拟前端)
    data_url = image_to_data_url(original_img)
    print("✅ 图像转换为data URL")

    # 2. 后端解码data URL
    try:
        decoded_img = decode_image_from_data_url(data_url)
        print("✅ 后端成功解码data URL")
        print(f"解码后图像形状: {decoded_img.shape}")
        print(f"解码后图像类型: {decoded_img.dtype}")

        # 检查图像是否一致
        if np.array_equal(original_img, decoded_img):
            print("✅ 原始图像与解码图像完全一致")
        else:
            print("⚠️  原始图像与解码图像不一致")
            diff = np.abs(original_img.astype(float) - decoded_img.astype(float))
            print(f"最大差异: {diff.max():.2f}")
            print(f"平均差异: {diff.mean():.2f}")

    except Exception as e:
        print(f"❌ 后端解码失败: {e}")
        return

    # 3. 后端转换为灰度 (模拟OpenCV处理)
    gray_cv2 = cv2.cvtColor(decoded_img, cv2.COLOR_RGB2GRAY)
    print("✅ OpenCV转换为灰度图像")

    # 4. 比较特定点的灰度值
    print("\n🎯 验证特定点在完整流程中的灰度值:")
    print("-" * 40)

    for (y, x), expected_rgb, desc in test_points:
        # 直接从原始RGB计算的灰度值
        direct_gray = frontend_grayscale_calculation(expected_rgb)

        # 完整流程后的灰度值
        final_gray = gray_cv2[y, x]

        print(f"{desc} ({y},{x}):")
        print(f"  直接计算灰度: {direct_gray}")
        print(f"  完整流程灰度: {final_gray}")
        print(f"  匹配: {'✅' if direct_gray == final_gray else '❌'}")
        print()

    # 5. 测试阈值逻辑 (0-100范围)
    print("🎯 测试阈值逻辑 (0-100):")
    print("-" * 40)

    threshold_min, threshold_max = 0, 100
    mask = ((gray_cv2 >= threshold_min) & (gray_cv2 <= threshold_max)).astype(np.uint8) * 255
    masked_pixels = (mask > 0).sum()
    total_pixels = gray_cv2.size

    print(f"阈值范围: [{threshold_min}, {threshold_max}]")
    print(f"图像统计: min={gray_cv2.min()}, max={gray_cv2.max()}, mean={gray_cv2.mean():.2f}")
    print(f"在阈值范围内的像素: {masked_pixels}/{total_pixels} ({masked_pixels/total_pixels*100:.1f}%)")

    # 检查特定的测试点是否被正确标记
    for (y, x), expected_rgb, desc in test_points:
        gray_val = gray_cv2[y, x]
        is_marked = mask[y, x] > 0
        should_be_marked = threshold_min <= gray_val <= threshold_max

        print(f"{desc} ({y},{x}): 灰度={gray_val}, 标记={'✅' if is_marked else '❌'}, 应该标记={'✅' if should_be_marked else '❌'}")

if __name__ == "__main__":
    test_grayscale_consistency()