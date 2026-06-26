import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from .utils import ensure_models_exist

def detect_face(image_path):
    """
    Loads an image, runs MediaPipe Tasks FaceDetector,
    and returns a structured result.
    
    Returns format:
    {
        "face_detected": bool,
        "total_faces": int,
        "confidence": float
    }
    """
    # Ensure local model exists
    models = ensure_models_exist()

    # Load image using OpenCV to prevent path or file format reading issues on Windows
    cv_img = cv2.imread(image_path)
    if cv_img is None:
        raise ValueError("Corrupted image or unsupported image format")

    # MediaPipe expects RGB format, OpenCV loads BGR
    rgb_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
    
    base_options = python.BaseOptions(model_asset_path=models["detector"])
    options = vision.FaceDetectorOptions(base_options=base_options)
    
    with vision.FaceDetector.create_from_options(options) as detector:
        detection_result = detector.detect(mp_image)
        
        face_detected = False
        total_faces = 0
        confidence = 0.0
        
        if detection_result.detections:
            total_faces = len(detection_result.detections)
            face_detected = True
            # Get the confidence score of the first detected face from Category score
            confidence = float(detection_result.detections[0].categories[0].score)
            
        return {
            "face_detected": face_detected,
            "total_faces": total_faces,
            "confidence": round(confidence, 4)
        }
