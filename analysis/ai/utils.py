import os
import cv2
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from django.conf import settings

def ensure_models_exist():
    """
    Ensures that blaze_face_short_range.tflite and face_landmarker.task are downloaded.
    Returns a dict with paths to the models.
    """
    model_dir = os.path.join(settings.BASE_DIR, 'analysis', 'ai', 'models')
    os.makedirs(model_dir, exist_ok=True)

    detector_path = os.path.join(model_dir, "blaze_face_short_range.tflite")
    landmarker_path = os.path.join(model_dir, "face_landmarker.task")

    detector_url = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
    landmarker_url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

    if not os.path.exists(detector_path):
        urllib.request.urlretrieve(detector_url, detector_path)
    if not os.path.exists(landmarker_path):
        urllib.request.urlretrieve(landmarker_url, landmarker_path)

    return {
        "detector": detector_path,
        "landmarker": landmarker_path
    }

def draw_face_landmarks(image_path, landmarks, image_id):
    """
    Draws face bounding box and 468 landmark points on the image,
    then saves the output to media/debug/face_debug_{image_id}.jpg.
    
    Returns:
        str: Relative URL path to the debug image.
    """
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Corrupted image or unsupported image format")
        
    h, w, _ = image.shape
    
    # 1. Draw bounding box from MediaPipe Tasks FaceDetector
    models = ensure_models_exist()
    mp_image = mp.Image.create_from_file(image_path)
    base_options = python.BaseOptions(model_asset_path=models["detector"])
    options = vision.FaceDetectorOptions(base_options=base_options)
    
    with vision.FaceDetector.create_from_options(options) as detector:
        res = detector.detect(mp_image)
        if res.detections:
            for detection in res.detections:
                bbox = detection.bounding_box
                xmin = bbox.origin_x
                ymin = bbox.origin_y
                width = bbox.width
                height = bbox.height
                
                # Draw bounding box (BGR color: Indigo/Violet (180, 80, 100))
                cv2.rectangle(image, (xmin, ymin), (xmin + width, ymin + height), (180, 80, 100), 2)
                
    # 2. Draw 468 Landmark points
    if landmarks:
        for lm in landmarks:
            lx = int(lm["x"] * w)
            ly = int(lm["y"] * h)
            # Draw a tiny dot for each landmark (BGR color: Mint Green (128, 222, 74))
            cv2.circle(image, (lx, ly), 1, (74, 222, 128), -1)
            
    # Create media/debug directory inside MEDIA_ROOT
    debug_dir = os.path.join(settings.MEDIA_ROOT, 'debug')
    os.makedirs(debug_dir, exist_ok=True)
    
    output_filename = f"face_debug_{image_id}.jpg"
    output_path = os.path.join(debug_dir, output_filename)
    
    cv2.imwrite(output_path, image)
    
    # Return relative URL path (e.g. /media/debug/face_debug_1.jpg)
    return f"{settings.MEDIA_URL}debug/{output_filename}"


def draw_shape_analysis(image_path, landmarks, measurements, face_shape, confidence, image_id):
    """
    Draws face landmarks, measurement lines (forehead, cheekbone, jaw, length),
    and overlays analysis summary stats on the image, saving the output
    to media/debug/shape_analysis_{image_id}.jpg.
    
    Returns:
        str: Relative URL path to the shape analysis debug image.
    """
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Corrupted image or unsupported image format")
        
    h, w, _ = image.shape
    
    # 1. Import indexes locally to prevent circular imports
    from .landmark_indexes import (
        FOREHEAD_CENTER,
        FOREHEAD_LEFT,
        FOREHEAD_RIGHT,
        CHEEKBONE_LEFT,
        CHEEKBONE_RIGHT,
        JAW_LEFT,
        JAW_RIGHT,
        CHIN
    )
    
    # 2. Draw 468 Landmark points as tiny dots (Mint Green (74, 222, 128))
    if landmarks:
        for lm in landmarks:
            lx = int(lm["x"] * w)
            ly = int(lm["y"] * h)
            cv2.circle(image, (lx, ly), 1, (128, 222, 74), -1)
            
    # Helper to get pixel coordinates
    def get_pt(idx):
        pt = landmarks[idx]
        return (int(pt['x'] * w), int(pt['y'] * h))
        
    # Get endpoints for lines
    p_fh_l = get_pt(FOREHEAD_LEFT)
    p_fh_r = get_pt(FOREHEAD_RIGHT)
    p_cb_l = get_pt(CHEEKBONE_LEFT)
    p_cb_r = get_pt(CHEEKBONE_RIGHT)
    p_jw_l = get_pt(JAW_LEFT)
    p_jw_r = get_pt(JAW_RIGHT)
    p_fh_c = get_pt(FOREHEAD_CENTER)
    p_chin = get_pt(CHIN)
    
    # 3. Draw lines with anti-aliasing
    # Forehead Width Line (Blue/Cyan: BGR (235, 160, 50))
    cv2.line(image, p_fh_l, p_fh_r, (235, 160, 50), 2, cv2.LINE_AA)
    # Cheekbone Width Line (Green: BGR (75, 220, 75))
    cv2.line(image, p_cb_l, p_cb_r, (75, 220, 75), 2, cv2.LINE_AA)
    # Jaw Width Line (Purple/Magenta: BGR (180, 80, 200))
    cv2.line(image, p_jw_l, p_jw_r, (180, 80, 200), 2, cv2.LINE_AA)
    # Face Length Line (Red/Orange: BGR (50, 80, 240))
    cv2.line(image, p_fh_c, p_chin, (50, 80, 240), 2, cv2.LINE_AA)
    
    # Draw endpoints on lines to make them look nice
    dots = [p_fh_l, p_fh_r, p_cb_l, p_cb_r, p_jw_l, p_jw_r, p_fh_c, p_chin]
    colors = [(235, 160, 50), (235, 160, 50), (75, 220, 75), (75, 220, 75), (180, 80, 200), (180, 80, 200), (50, 80, 240), (50, 80, 240)]
    for pt, col in zip(dots, colors):
        cv2.circle(image, pt, 4, col, -1, cv2.LINE_AA)
        cv2.circle(image, pt, 5, (255, 255, 255), 1, cv2.LINE_AA)
        
    # 4. Draw HUD style text overlay
    # Create dark semi-transparent rectangle on the top left
    overlay = image.copy()
    overlay_w, overlay_h = min(w - 20, 280), 160
    cv2.rectangle(overlay, (10, 10), (10 + overlay_w, 10 + overlay_h), (15, 10, 5), -1)
    # Blend overlay with original (70% opacity)
    cv2.addWeighted(overlay, 0.7, image, 0.3, 0, image)
    
    # Put text with anti-aliasing
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.55
    color_white = (255, 255, 255)
    thickness_bold = 2
    thickness_normal = 1
    
    cv2.putText(image, f"Shape: {face_shape} ({int(confidence * 100)}%)", (20, 35), font, 0.65, (74, 222, 128), thickness_bold, cv2.LINE_AA)
    cv2.putText(image, f"Length: {measurements['face_length']} px", (20, 65), font, font_scale, (50, 80, 240), thickness_normal, cv2.LINE_AA)
    cv2.putText(image, f"Forehead: {measurements['forehead_width']} px", (20, 90), font, font_scale, (235, 160, 50), thickness_normal, cv2.LINE_AA)
    cv2.putText(image, f"Cheekbone: {measurements['cheekbone_width']} px", (20, 115), font, font_scale, (75, 220, 75), thickness_normal, cv2.LINE_AA)
    cv2.putText(image, f"Jaw: {measurements['jaw_width']} px", (20, 140), font, font_scale, (180, 80, 200), thickness_normal, cv2.LINE_AA)
    
    # Save the output to media/debug/
    debug_dir = os.path.join(settings.MEDIA_ROOT, 'debug')
    os.makedirs(debug_dir, exist_ok=True)
    
    output_filename = f"shape_analysis_{image_id}.jpg"
    output_path = os.path.join(debug_dir, output_filename)
    
    cv2.imwrite(output_path, image)
    
    # Return relative URL path (e.g. /media/debug/shape_analysis_1.jpg)
    return f"{settings.MEDIA_URL}debug/{output_filename}"

