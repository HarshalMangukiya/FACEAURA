import cv2
import numpy as np

def detect_dark_circles(img, landmarks):
    """
    Detects dark circles by comparing the lightness of the under-eye regions
    to the cheek regions.
    
    Args:
        img (numpy.ndarray): BGR image.
        landmarks (list): List of 468 landmarks.
        
    Returns:
        dict: {"dark_circle_detected": bool, "eye_brightness": float, "cheek_brightness": float}
    """
    if not landmarks or img is None:
        return {"dark_circle_detected": False, "eye_brightness": 0.0, "cheek_brightness": 0.0}
        
    h, w, _ = img.shape
    
    # 1. Estimate eye dimensions to locate the under-eye patches
    # Left eye: 33 (inner corner), 133 (outer corner)
    pt_l_inner = np.array([landmarks[33]["x"] * w, landmarks[33]["y"] * h])
    pt_l_outer = np.array([landmarks[133]["x"] * w, landmarks[133]["y"] * h])
    eye_width = np.linalg.norm(pt_l_inner - pt_l_outer)
    
    # Define patch radius (e.g. 15% of eye width)
    patch_radius = max(4, int(eye_width * 0.15))
    
    # Under-eye vertical offset (shift down by 25% of eye width from lowest point)
    vertical_offset = int(eye_width * 0.25)
    
    # Left lowest eye landmark: 145
    # Right lowest eye landmark: 374
    l_undereye_cx = int(landmarks[145]["x"] * w)
    l_undereye_cy = int(landmarks[145]["y"] * h) + vertical_offset
    
    r_undereye_cx = int(landmarks[374]["x"] * w)
    r_undereye_cy = int(landmarks[374]["y"] * h) + vertical_offset
    
    # Cheek reference centers (Landmarks 117 and 346)
    l_cheek_cx = int(landmarks[117]["x"] * w)
    l_cheek_cy = int(landmarks[117]["y"] * h)
    
    r_cheek_cx = int(landmarks[346]["x"] * w)
    r_cheek_cy = int(landmarks[346]["y"] * h)
    
    def get_average_lightness(cx, cy):
        xmin = max(0, cx - patch_radius)
        xmax = min(w - 1, cx + patch_radius)
        ymin = max(0, cy - patch_radius)
        ymax = min(h - 1, cy + patch_radius)
        
        patch = img[ymin:ymax, xmin:xmax]
        if patch.size == 0:
            return None, (xmin, ymin, xmax, ymax)
            
        # Convert to LAB space to analyze perceptual lightness (L*)
        lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
        # Average L* channel
        avg_l = np.mean(lab[:, :, 0]) * 100.0 / 255.0 # Scale [0, 255] to [0, 100]
        return avg_l, (xmin, ymin, xmax, ymax)
        
    l_eye_l, l_eye_roi = get_average_lightness(l_undereye_cx, l_undereye_cy)
    r_eye_l, r_eye_roi = get_average_lightness(r_undereye_cx, r_undereye_cy)
    l_chk_l, l_chk_roi = get_average_lightness(l_cheek_cx, l_cheek_cy)
    r_chk_l, r_chk_roi = get_average_lightness(r_cheek_cx, r_cheek_cy)
    
    # Fallback checking
    valid_eyes = [l for l in [l_eye_l, r_eye_l] if l is not None]
    valid_cheeks = [l for l in [l_chk_l, r_chk_l] if l is not None]
    
    if not valid_eyes or not valid_cheeks:
        return {
            "dark_circle_detected": False,
            "eye_brightness": 0.0,
            "cheek_brightness": 0.0,
            "rois": [l_eye_roi, r_eye_roi, l_chk_roi, r_chk_roi]
        }
        
    eye_brightness = np.mean(valid_eyes)
    cheek_brightness = np.mean(valid_cheeks)
    
    # Classify: if cheeks are significantly brighter than the under-eye area, dark circles are detected
    # We use a combined threshold: L_cheek - L_eye > 4.5 or L_eye / L_cheek < 0.925
    detected = False
    diff = cheek_brightness - eye_brightness
    ratio = eye_brightness / cheek_brightness if cheek_brightness > 0 else 1.0
    
    if diff > 4.5 or ratio < 0.925:
        detected = True
        
    return {
        "dark_circle_detected": detected,
        "eye_brightness": float(round(eye_brightness, 2)),
        "cheek_brightness": float(round(cheek_brightness, 2)),
        "rois": [l_eye_roi, r_eye_roi, l_chk_roi, r_chk_roi]
    }
