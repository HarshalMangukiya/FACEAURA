import cv2
import numpy as np
import math

def detect_skin_tone(img, landmarks):
    """
    Analyzes face skin tone by extracting forehead and cheek patches,
    calculating the average color, converting to CIELAB, and using ITA.
    
    Args:
        img (numpy.ndarray): BGR image.
        landmarks (list): List of 468 landmark coordinates {"x": x, "y": y, "z": z}.
        
    Returns:
        dict: {"skin_tone": str, "confidence": float, "average_bgr": list}
    """
    if not landmarks or img is None:
        return {"skin_tone": "Medium", "confidence": 0.50, "average_bgr": [128, 128, 128]}
        
    h, w, _ = img.shape
    
    # 1. Calculate face width as a reference for patch sizes
    # Landmark 234: Left cheekbone, Landmark 454: Right cheekbone
    pt_l_cb = np.array([landmarks[234]["x"] * w, landmarks[234]["y"] * h])
    pt_r_cb = np.array([landmarks[454]["x"] * w, landmarks[454]["y"] * h])
    face_width = np.linalg.norm(pt_l_cb - pt_r_cb)
    
    # Define a dynamic patch size (e.g. 5% of face width, minimum 8 pixels)
    patch_radius = max(8, int(face_width * 0.05))
    
    # 2. Define center coordinates for forehead, left cheek, and right cheek
    # Forehead Center: Landmark 9 is safe (lower forehead, avoids hairline)
    # Left Cheek: Landmark 117 or 118
    # Right Cheek: Landmark 346 or 347
    forehead_idx = 9
    l_cheek_idx = 117
    r_cheek_idx = 346
    
    regions = [forehead_idx, l_cheek_idx, r_cheek_idx]
    skin_pixels = []
    
    rois_bounds = [] # Save for visualization debug: [ (xmin, ymin, xmax, ymax) ]
    
    for idx in regions:
        cx = int(landmarks[idx]["x"] * w)
        cy = int(landmarks[idx]["y"] * h)
        
        # Clamp coordinates to image boundaries
        xmin = max(0, cx - patch_radius)
        xmax = min(w - 1, cx + patch_radius)
        ymin = max(0, cy - patch_radius)
        ymax = min(h - 1, cy + patch_radius)
        
        rois_bounds.append((xmin, ymin, xmax, ymax))
        
        patch = img[ymin:ymax, xmin:xmax]
        if patch.size == 0:
            continue
            
        # Convert patch to HSV to segment skin pixels and remove highlights/hair
        hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
        
        # Skin HSV bounds
        lower1 = np.array([0, 20, 50], dtype=np.uint8)
        upper1 = np.array([20, 175, 255], dtype=np.uint8)
        mask1 = cv2.inRange(hsv, lower1, upper1)
        
        lower2 = np.array([170, 20, 50], dtype=np.uint8)
        upper2 = np.array([180, 175, 255], dtype=np.uint8)
        mask2 = cv2.inRange(hsv, lower2, upper2)
        
        mask = mask1 | mask2
        patch_skin = patch[mask > 0]
        
        if len(patch_skin) > 0:
            skin_pixels.extend(patch_skin)
        else:
            # Fallback to all pixels in the patch if skin segmenter yields nothing
            skin_pixels.extend(patch.reshape(-1, 3))
            
    if len(skin_pixels) == 0:
        return {"skin_tone": "Medium", "confidence": 0.50, "average_bgr": [128, 128, 128], "rois": rois_bounds}
        
    # Calculate average BGR color of skin pixels
    avg_bgr = np.mean(skin_pixels, axis=0)
    
    # 3. Convert Average BGR -> CIELAB to calculate ITA
    # Create 1x1 image
    color_img = np.uint8([[avg_bgr]])
    lab_img = cv2.cvtColor(color_img, cv2.COLOR_BGR2LAB)
    L, A, B_val = lab_img[0, 0]
    
    # Convert OpenCV LAB [0, 255] values to standard range
    L_star = L * 100.0 / 255.0
    A_star = A - 128.0
    B_star = B_val - 128.0
    
    # Individual Typology Angle (ITA) in degrees
    # ITA = arctan((L* - 50) / b*) * (180 / pi)
    # Using atan2 to avoid division by zero
    ita = math.atan2(L_star - 50.0, B_star) * (180.0 / math.pi)
    
    # 4. Classify based on ITA boundaries
    # Very Light/Fair: ITA > 55
    # Light: 41 < ITA <= 55
    # Medium: 28 < ITA <= 41
    # Tan: 10 < ITA <= 28
    # Deep: ITA <= 10
    if ita > 55:
        tone = "Fair"
        # Map ITA value to a confidence score [0.7, 0.99]
        confidence = min(0.99, 0.70 + (ita - 55.0) / 45.0)
    elif ita > 41:
        tone = "Light"
        confidence = min(0.99, 0.70 + (ita - 41.0) / 14.0 * 0.29)
    elif ita > 28:
        tone = "Medium"
        confidence = min(0.99, 0.70 + (ita - 28.0) / 13.0 * 0.29)
    elif ita > 10:
        tone = "Tan"
        confidence = min(0.99, 0.70 + (ita - 10.0) / 18.0 * 0.29)
    else:
        tone = "Deep"
        confidence = min(0.99, 0.70 + abs(ita - 10.0) / 40.0)
        
    # Ensure confidence stays clean
    confidence = round(float(confidence), 2)
    avg_bgr_list = [round(float(c), 2) for c in avg_bgr]
    
    return {
        "skin_tone": tone,
        "confidence": confidence,
        "average_bgr": avg_bgr_list,
        "rois": rois_bounds
    }
