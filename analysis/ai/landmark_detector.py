import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from .utils import ensure_models_exist

def extract_landmarks(image_path):
    """
    Runs MediaPipe Tasks FaceLandmarker on the image and extracts exactly 468 facial landmarks.
    Each landmark is represented as a dictionary with 'x', 'y', and 'z' keys.
    
    Returns:
        list: A list of 468 dicts if a face is detected, else None.
    """
    # Ensure local model exists
    models = ensure_models_exist()
    
    mp_image = mp.Image.create_from_file(image_path)
    
    base_options = python.BaseOptions(model_asset_path=models["landmarker"])
    # We specify num_faces=1 since we enforce exactly one face
    options = vision.FaceLandmarkerOptions(base_options=base_options, num_faces=1)
    
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp_image)
        
        if not result.face_landmarks:
            return None
            
        # Get face landmarks for the first detected face
        face_landmarks = result.face_landmarks[0]
        
        landmarks_list = []
        # Slice to exactly 468 landmarks (excluding the 10 extra iris landmarks if present)
        for landmark in face_landmarks[:468]:
            landmarks_list.append({
                "x": round(float(landmark.x), 4),
                "y": round(float(landmark.y), 4),
                "z": round(float(landmark.z), 4)
            })
            
        return landmarks_list
