#!/usr/bin/env python3
"""
YOLO Object Detection Script
Detects objects in an image using Ultralytics YOLO
"""
import json
import sys
import os
from pathlib import Path

# Suppress all non-essential output
import warnings
warnings.filterwarnings('ignore')

# Redirect stderr to suppress YOLO progress messages
class SuppressOutput:
    def write(self, s):
        pass
    def flush(self):
        pass

# Temporarily suppress stderr during model loading
_stderr_backup = sys.stderr

try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({"error": "ultralytics not installed. Run: pip install ultralytics"}))
    sys.exit(1)


def detect_objects(image_path: str, confidence_threshold: float = 0.25):
    """
    Detect objects in an image using YOLO
    
    Args:
        image_path: Path to the image file
        confidence_threshold: Minimum confidence score (0-1)
    
    Returns:
        List of detected object class names
    """
    try:
        # Suppress stderr during model loading and inference
        sys.stderr = SuppressOutput()
        
        # Load YOLOv8n model (nano - lightweight)
        model = YOLO('yolov8n.pt')
        
        # Run inference with verbose=False and suppress all output
        results = model(image_path, conf=confidence_threshold, verbose=False, show=False)
        
        # Restore stderr
        sys.stderr = _stderr_backup
        
        # Extract unique class names
        detected_classes = set()
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    class_name = model.names[class_id]
                    detected_classes.add(class_name.lower())
        
        return list(detected_classes)
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python detect.py <image_path> [confidence_threshold]"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    confidence = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"Image file not found: {image_path}"}))
        sys.exit(1)
    
    result = detect_objects(image_path, confidence)
    
    # Output as JSON
    if isinstance(result, dict) and "error" in result:
        print(json.dumps(result))
        sys.exit(1)
    else:
        print(json.dumps({"objects": result}))

