#!/usr/bin/env python3
"""
Face Detection with Age and Gender Estimation
Uses OpenCV DNN with pre-trained Caffe models for age and gender detection
"""
import json
import sys
import os
from pathlib import Path
import urllib.request

import warnings
warnings.filterwarnings('ignore')

class SuppressOutput:
    def write(self, s):
        pass
    def flush(self):
        pass

_stderr_backup = sys.stderr

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "opencv-python not installed. Run: pip install opencv-python-headless"}))
    sys.exit(1)


def download_model(url, filepath, fallback_urls=None):
    """Download model file if it doesn't exist"""
    if os.path.exists(filepath):
        file_size = os.path.getsize(filepath)
        if file_size > 0:
            print(f"Model file {os.path.basename(filepath)} already exists ({file_size} bytes)", file=sys.stderr)
            return True
        else:
            print(f"WARNING: Model file {os.path.basename(filepath)} exists but is empty, re-downloading", file=sys.stderr)
            os.remove(filepath)
    
    urls_to_try = [url]
    if fallback_urls:
        urls_to_try.extend(fallback_urls)
    
    for attempt_url in urls_to_try:
        try:
            print(f"Downloading {os.path.basename(filepath)} from {attempt_url}...", file=sys.stderr)
            urllib.request.urlretrieve(attempt_url, filepath)
            if os.path.exists(filepath):
                file_size = os.path.getsize(filepath)
                if file_size > 0:
                    print(f"Downloaded {os.path.basename(filepath)} successfully ({file_size} bytes)", file=sys.stderr)
                    return True
                else:
                    print(f"WARNING: Downloaded file {os.path.basename(filepath)} is empty, trying next URL...", file=sys.stderr)
                    if os.path.exists(filepath):
                        os.remove(filepath)
            continue
        except Exception as e:
            print(f"WARNING: Failed to download from {attempt_url}: {str(e)}", file=sys.stderr)
            if os.path.exists(filepath):
                os.remove(filepath)
            continue
    
    print(f"ERROR: Failed to download {os.path.basename(filepath)} from all attempted URLs", file=sys.stderr)
    return False


def load_age_gender_models():
    """Load age and gender detection models"""
    script_dir = Path(__file__).parent
    models_dir = script_dir / 'models'
    models_dir.mkdir(exist_ok=True)
    
    gender_proto = models_dir / 'gender_deploy.prototxt'
    gender_model = models_dir / 'gender_net.caffemodel'
    age_proto = models_dir / 'age_deploy.prototxt'
    age_model = models_dir / 'age_net.caffemodel'
    
    # Use reliable GitHub repositories for the models
    # Prototxt files from Isfhan repository (confirmed working)
    proto_base_url = 'https://raw.githubusercontent.com/Isfhan/age-gender-detection/master/'
    # Model files - try multiple sources as fallback
    # Primary: ritvik03 repository (has both models)
    model_base_url = 'https://raw.githubusercontent.com/ritvik03/Age-Gender_Prediction/master/'
    
    try:
        if not gender_proto.exists():
            print(f"Downloading gender_deploy.prototxt...", file=sys.stderr)
            if not download_model(proto_base_url + 'gender_deploy.prototxt', str(gender_proto)):
                print(f"ERROR: Failed to download gender_deploy.prototxt", file=sys.stderr)
                return None, None
        if not gender_model.exists():
            print(f"Downloading gender_net.caffemodel (this may take a while, ~3MB)...", file=sys.stderr)
            fallback_urls = [
                'https://raw.githubusercontent.com/Isfhan/age-gender-detection/master/gender_net.caffemodel',
                'https://github.com/OshaPandey/Age_Gender_Detection/raw/master/gender_net.caffemodel'
            ]
            if not download_model(model_base_url + 'gender_net.caffemodel', str(gender_model), fallback_urls):
                print(f"ERROR: Failed to download gender_net.caffemodel", file=sys.stderr)
                return None, None
        if not age_proto.exists():
            print(f"Downloading age_deploy.prototxt...", file=sys.stderr)
            if not download_model(proto_base_url + 'age_deploy.prototxt', str(age_proto)):
                print(f"ERROR: Failed to download age_deploy.prototxt", file=sys.stderr)
                return None, None
        if not age_model.exists():
            print(f"Downloading age_net.caffemodel (this may take a while, ~45MB)...", file=sys.stderr)
            fallback_urls = [
                'https://raw.githubusercontent.com/Isfhan/age-gender-detection/master/age_net.caffemodel',
                'https://github.com/OshaPandey/Age_Gender_Detection/raw/master/age_net.caffemodel',
                'https://github.com/eveningglow/age-and-gender-classification/raw/master/model/age_net.caffemodel'
            ]
            if not download_model(model_base_url + 'age_net.caffemodel', str(age_model), fallback_urls):
                print(f"ERROR: Failed to download age_net.caffemodel", file=sys.stderr)
                return None, None
        
        if not all([gender_proto.exists(), gender_model.exists(), age_proto.exists(), age_model.exists()]):
            print(f"ERROR: Not all model files exist after download attempt", file=sys.stderr)
            return None, None
        
        print(f"Loading age/gender models...", file=sys.stderr)
        gender_net = cv2.dnn.readNetFromCaffe(str(gender_proto), str(gender_model))
        age_net = cv2.dnn.readNetFromCaffe(str(age_proto), str(age_model))
        
        if gender_net.empty() or age_net.empty():
            print(f"ERROR: Failed to load models (empty network)", file=sys.stderr)
            return None, None
        
        print(f"Models loaded successfully", file=sys.stderr)
        return gender_net, age_net
    except Exception as e:
        print(f"ERROR: Exception loading models: {str(e)}", file=sys.stderr)
        return None, None


def predict_age_gender(face_roi, gender_net, age_net):
    """Predict age and gender for a face ROI"""
    blob = cv2.dnn.blobFromImage(face_roi, 1.0, (227, 227), (78.4263377603, 87.7689143744, 114.895847746), swapRB=False)
    
    gender_net.setInput(blob)
    gender_preds = gender_net.forward()
    gender = "male" if gender_preds[0][0] > gender_preds[0][1] else "female"
    gender_confidence = float(max(gender_preds[0]))
    
    age_net.setInput(blob)
    age_preds = age_net.forward()
    age_list = ['(0-2)', '(4-6)', '(8-12)', '(15-20)', '(25-32)', '(38-43)', '(48-53)', '(60-100)']
    age_index = age_preds[0].argmax()
    age_range = age_list[age_index]
    age_confidence = float(age_preds[0][age_index])
    
    age_bracket_map = {
        '(0-2)': 'child',
        '(4-6)': 'child',
        '(8-12)': 'child',
        '(15-20)': 'young',
        '(25-32)': 'young',
        '(38-43)': 'middle_age',
        '(48-53)': 'middle_age',
        '(60-100)': 'old'
    }
    
    age_bracket = age_bracket_map.get(age_range, 'unknown')
    
    return gender, gender_confidence, age_bracket, age_confidence


def detect_faces(image_path: str):
    """
    Detect faces in an image and estimate age/gender using OpenCV DNN models
    
    Args:
        image_path: Path to the image file
    
    Returns:
        JSON string with people demographics
    """
    try:
        sys.stderr = SuppressOutput()
        
        if not os.path.exists(image_path):
            return json.dumps({"error": f"Image file not found: {image_path}"})
        
        image = cv2.imread(image_path)
        if image is None:
            return json.dumps({"error": f"Could not read image: {image_path}"})
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        if not os.path.exists(cascade_path):
            cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
            if not os.path.exists(cascade_path):
                return json.dumps({"error": "Haar Cascade classifier not found"})
        
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            return json.dumps({"error": "Failed to load Haar Cascade classifier"})
        
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        sys.stderr = _stderr_backup
        
        print(f"Detected {len(faces)} face(s) in image", file=sys.stderr)
        
        if len(faces) == 0:
            return json.dumps({"people": []})
        
        gender_net, age_net = load_age_gender_models()
        
        if gender_net is None or age_net is None:
            print(f"WARNING: Age/gender models not available, returning unknown demographics", file=sys.stderr)
            people = []
            for (x, y, w, h) in faces:
                face_area = w * h
                image_area = image.shape[0] * image.shape[1]
                face_ratio = face_area / image_area if image_area > 0 else 0
                face_confidence = min(0.7 + (face_ratio * 2), 0.9)
                
                people.append({
                    "gender": "unknown",
                    "genderConfidence": 0.3,
                    "ageBracket": "unknown",
                    "ageConfidence": 0.3,
                    "faceConfidence": round(face_confidence, 3)
                })
            return json.dumps({"people": people})
        
        people = []
        for (x, y, w, h) in faces:
            face_roi = image[y:y+h, x:x+w]
            
            try:
                gender, gender_conf, age_bracket, age_conf = predict_age_gender(face_roi, gender_net, age_net)
            except Exception as e:
                print(f"WARNING: Age/gender prediction failed for face: {str(e)}", file=sys.stderr)
                gender = "unknown"
                gender_conf = 0.3
                age_bracket = "unknown"
                age_conf = 0.3
            
            face_area = w * h
            image_area = image.shape[0] * image.shape[1]
            face_ratio = face_area / image_area if image_area > 0 else 0
            face_confidence = min(0.7 + (face_ratio * 2), 0.9)
            
            people.append({
                "gender": gender,
                "genderConfidence": round(gender_conf, 3),
                "ageBracket": age_bracket,
                "ageConfidence": round(age_conf, 3),
                "faceConfidence": round(face_confidence, 3)
            })
        
        return json.dumps({"people": people})
        
    except Exception as e:
        sys.stderr = _stderr_backup
        error_msg = str(e)
        if "No face detected" in error_msg or "Face could not be detected" in error_msg:
            return json.dumps({"people": []})
        return json.dumps({"error": f"Face detection failed: {error_msg}"})


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python face_detection.py <image_path>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    result = detect_faces(image_path)
    print(result)
