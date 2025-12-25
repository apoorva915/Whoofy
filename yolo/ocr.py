#!/usr/bin/env python3
"""
OCR Script using pytesseract
Reads text from an image using Tesseract OCR
"""
import json
import sys
import os

try:
    import pytesseract
    from PIL import Image
except ImportError:
    print(json.dumps({"error": "pytesseract not installed. Run: pip install pytesseract pillow"}))
    sys.exit(1)


def read_text(image_path: str):
    """
    Read text from an image using OCR
    
    Args:
        image_path: Path to the image file
    
    Returns:
        Extracted text string
    """
    try:
        # Check if tesseract is available
        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            return {"error": "tesseract is not installed or it's not in your PATH. See README file for more information."}
        
        # Open and process image
        image = Image.open(image_path)
        
        # Try multiple OCR configurations for better text extraction
        # Packaging text can be challenging, so we try different PSM modes
        texts = []
        
        # Try PSM 6 (uniform block of text) - good for packaging labels
        try:
            text1 = pytesseract.image_to_string(image, lang='eng', config='--psm 6').strip()
            if text1:
                texts.append(text1)
        except:
            pass
        
        # Try PSM 11 (sparse text) - good for text overlays
        try:
            text2 = pytesseract.image_to_string(image, lang='eng', config='--psm 11').strip()
            if text2 and text2 != text1:
                texts.append(text2)
        except:
            pass
        
        # Try default (PSM 3) as fallback
        try:
            text3 = pytesseract.image_to_string(image, lang='eng').strip()
            if text3 and text3 not in texts:
                texts.append(text3)
        except:
            pass
        
        # Combine all detected text, removing duplicates
        # Use the longest text as it's likely most complete
        if texts:
            combined_text = ' '.join(texts)
            # Remove duplicate words while preserving order
            words = combined_text.split()
            seen = set()
            unique_words = []
            for word in words:
                word_lower = word.lower()
                if word_lower not in seen:
                    seen.add(word_lower)
                    unique_words.append(word)
            return ' '.join(unique_words)
        
        return ''
    except Exception as e:
        error_msg = str(e)
        # Provide helpful error message for common issues
        if 'tesseract' in error_msg.lower() or 'not found' in error_msg.lower():
            return {"error": "tesseract is not installed or it's not in your PATH. See README file for more information."}
        return {"error": error_msg}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python ocr.py <image_path>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"Image file not found: {image_path}"}))
        sys.exit(1)
    
    result = read_text(image_path)
    
    # Output as JSON
    if isinstance(result, dict) and "error" in result:
        print(json.dumps(result))
        sys.exit(1)
    else:
        print(json.dumps({"text": result}))

