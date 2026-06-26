import cv2
import numpy as np

def detect_skin_type(img, landmarks):
    """
    Detects skin type (Oily, Dry, Combination, Normal) by analyzing shine
    and specular reflection intensity in the T-zone (forehead) and U-zone (cheeks).
    
    Args:
        img (numpy.ndarray): BGR image.
        landmarks (list): List of 468 landmarks.
        
    Returns:
        dict: {"skin_type": str, "confidence": float}
    """
    if not landmarks or img is None:
        return {"skin_type": "Normal", "confidence": 0.80}
        
    h, w, _ = img.shape
    
    # Calculate face width to scale patches
    pt_l_cb = np.array([landmarks[234]["x"] * w, landmarks[234]["y"] * h])
    pt_r_cb = np.array([landmarks[454]["x"] * w, landmarks[454]["y"] * h])
    face_width = np.linalg.norm(pt_l_cb - pt_r_cb)
    patch_radius = max(8, int(face_width * 0.05))
    
    # 1. Extract Forehead (T-zone) and Cheek (U-zone) patches
    forehead_idx = 9
    l_cheek_idx = 117
    r_cheek_idx = 346
    
    def get_patch_hsv(idx):
        cx, cy = int(landmarks[idx]["x"] * w), int(landmarks[idx]["y"] * h)
        xmin, xmax = max(0, cx - patch_radius), min(w - 1, cx + patch_radius)
        ymin, ymax = max(0, cy - patch_radius), min(h - 1, cy + patch_radius)
        patch = img[ymin:ymax, xmin:xmax]
        if patch.size == 0:
            return None, None
        hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
        return hsv, patch
        
    fh_hsv, fh_patch = get_patch_hsv(forehead_idx)
    lc_hsv, lc_patch = get_patch_hsv(l_cheek_idx)
    rc_hsv, rc_patch = get_patch_hsv(r_cheek_idx)
    
    # Gather all skin pixels to calculate adaptive thresholds
    all_v_channels = []
    for hsv in [fh_hsv, lc_hsv, rc_hsv]:
        if hsv is not None:
            # Mask skin colors
            lower1, upper1 = np.array([0, 20, 40]), np.array([20, 180, 255])
            lower2, upper2 = np.array([170, 20, 40]), np.array([180, 180, 255])
            mask = cv2.inRange(hsv, lower1, upper1) | cv2.inRange(hsv, lower2, upper2)
            skin_v = hsv[:, :, 2][mask > 0]
            if len(skin_v) > 0:
                all_v_channels.extend(skin_v)
                
    if len(all_v_channels) == 0:
        return {"skin_type": "Normal", "confidence": 0.75}
        
    # Calculate average and standard deviation of Value (brightness) channel
    avg_v = np.mean(all_v_channels)
    std_v = np.std(all_v_channels)
    
    # Adaptive shine threshold: average + 35, bounded between 185 and 245
    shine_threshold = min(245, max(185, int(avg_v + 35)))
    
    # Calculate shine ratio in T-Zone (Forehead) and U-Zone (Cheeks)
    def calculate_shine_ratio(hsv):
        if hsv is None:
            return 0.0
        lower1, upper1 = np.array([0, 20, 40]), np.array([20, 180, 255])
        lower2, upper2 = np.array([170, 20, 40]), np.array([180, 180, 255])
        mask = cv2.inRange(hsv, lower1, upper1) | cv2.inRange(hsv, lower2, upper2)
        skin_pixels = hsv[mask > 0]
        if len(skin_pixels) == 0:
            return 0.0
        shiny_pixels = skin_pixels[:, 2] > shine_threshold
        return np.sum(shiny_pixels) / len(skin_pixels)
        
    t_shine = calculate_shine_ratio(fh_hsv)
    
    lc_shine = calculate_shine_ratio(lc_hsv)
    rc_shine = calculate_shine_ratio(rc_hsv)
    u_shine = (lc_shine + rc_shine) / 2.0
    
    # Classify skin type
    # Oily: High shine in both T and U zones
    # Combination: High shine in T-zone, low/medium shine in U-zone
    # Dry: Very low shine in both zones
    # Normal: Medium shine in T-zone, low/medium in U-zone
    
    oily_threshold = 0.12
    dry_threshold = 0.03
    
    if t_shine > oily_threshold and u_shine > oily_threshold:
        skin_type = "Oily"
        confidence = 0.70 + min(0.28, (t_shine + u_shine) * 0.6)
    elif t_shine > oily_threshold and u_shine <= oily_threshold:
        skin_type = "Combination"
        confidence = 0.70 + min(0.28, t_shine * 0.8)
    elif t_shine < dry_threshold and u_shine < dry_threshold:
        skin_type = "Dry"
        confidence = 0.75 + min(0.23, (dry_threshold - max(t_shine, u_shine)) * 5.0)
    else:
        skin_type = "Normal"
        confidence = 0.85
        
    confidence = round(float(confidence), 2)
    
    return {
        "skin_type": skin_type,
        "confidence": confidence,
        "t_zone_shine": float(round(t_shine, 4)),
        "u_zone_shine": float(round(u_shine, 4))
    }
