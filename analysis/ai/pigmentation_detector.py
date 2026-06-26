import cv2
import numpy as np

def detect_pigmentation(img, landmarks):
    """
    Detects hyperpigmentation and uneven skin tone by analyzing standard deviation
    of lightness and identifying local dark patches via morphological bottom-hat filtering.
    
    Args:
        img (numpy.ndarray): BGR image.
        landmarks (list): List of 468 landmarks.
        
    Returns:
        dict: {"pigmentation_detected": bool, "variance_score": float}
    """
    if not landmarks or img is None:
        return {"pigmentation_detected": False, "variance_score": 0.0}
        
    h, w, _ = img.shape
    
    # Calculate face width to scale patches
    pt_l_cb = np.array([landmarks[234]["x"] * w, landmarks[234]["y"] * h])
    pt_r_cb = np.array([landmarks[454]["x"] * w, landmarks[454]["y"] * h])
    face_width = np.linalg.norm(pt_l_cb - pt_r_cb)
    
    # Define a larger patch radius to capture variation (e.g. 10% of face width)
    patch_radius = max(15, int(face_width * 0.10))
    
    # Forehead and cheeks indices
    regions = [9, 117, 346]
    
    skin_l_values = []
    uneven_indicators = 0
    total_skin_pixels = 0
    
    # Bottom-hat morph filter detects dark spots on light backgrounds
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    
    for idx in regions:
        cx, cy = int(landmarks[idx]["x"] * w), int(landmarks[idx]["y"] * h)
        xmin, xmax = max(0, cx - patch_radius), min(w - 1, cx + patch_radius)
        ymin, ymax = max(0, cy - patch_radius), min(h - 1, cy + patch_radius)
        
        patch = img[ymin:ymax, xmin:xmax]
        if patch.size == 0:
            continue
            
        # Segment skin pixels using HSV
        hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
        lower1, upper1 = np.array([0, 20, 40]), np.array([20, 180, 255])
        lower2, upper2 = np.array([170, 20, 40]), np.array([180, 180, 255])
        skin_mask = cv2.inRange(hsv, lower1, upper1) | cv2.inRange(hsv, lower2, upper2)
        
        if np.sum(skin_mask > 0) < 50:
            continue
            
        # Convert to LAB space
        lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        
        skin_l = l_channel[skin_mask > 0] * 100.0 / 255.0
        skin_l_values.extend(skin_l)
        
        # Apply Bottom-Hat filter to extract dark patches
        gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
        
        # Apply skin mask to blackhat
        masked_blackhat = cv2.bitwise_and(blackhat, blackhat, mask=skin_mask)
        
        # Count pixels with strong local darkness
        _, dark_spots = cv2.threshold(masked_blackhat, 12, 255, cv2.THRESH_BINARY)
        dark_pixel_count = np.sum(dark_spots > 0)
        
        # If more than 3.5% of skin pixels in the patch represent a local dark spot,
        # flag this patch as potentially hyperpigmented
        patch_skin_count = np.sum(skin_mask > 0)
        if patch_skin_count > 0 and (dark_pixel_count / patch_skin_count) > 0.035:
            uneven_indicators += 1
            
    if len(skin_l_values) == 0:
        return {"pigmentation_detected": False, "variance_score": 0.0}
        
    # Calculate overall lightness standard deviation (uneven tone measure)
    l_std = np.std(skin_l_values)
    
    # Classify:
    # 1. Overall standard deviation is high (> 5.5) -> uneven tone
    # 2. Local blackhat filtering detects multiple hyperpigmented clusters (uneven_indicators >= 2)
    detected = False
    if l_std > 5.5 or uneven_indicators >= 2:
        detected = True
        
    return {
        "pigmentation_detected": detected,
        "variance_score": float(round(l_std, 2)),
        "dark_patch_indicators": uneven_indicators
    }
