import cv2
import numpy as np

def get_hull_points(landmarks, indices, w, h):
    pts = []
    for idx in indices:
        if idx < len(landmarks):
            pt = landmarks[idx]
            pts.append([int(pt["x"] * w), int(pt["y"] * h)])
    return np.array(pts, dtype=np.int32)

def detect_acne(img, landmarks):
    """
    Detects acne, pimples, and red spots using a localized redness index,
    skin segmentation masking, and shape analysis.
    
    Args:
        img (numpy.ndarray): BGR image.
        landmarks (list): List of 468 landmark coordinates.
        
    Returns:
        dict: {"acne_detected": bool, "severity": str, "acne_spots": list}
    """
    if not landmarks or img is None:
        return {"acne_detected": False, "severity": "None", "acne_spots": []}
        
    h, w, _ = img.shape
    
    # 1. Create a binary mask of bare skin (excluding eyes, brows, lips)
    mask = np.zeros((h, w), dtype=np.uint8)
    
    # Draw outer face boundary
    face_pts = get_hull_points(landmarks, list(range(468)), w, h)
    face_hull = cv2.convexHull(face_pts)
    cv2.drawContours(mask, [face_hull], -1, 255, -1)
    
    # Exclude left eye
    left_eye_indices = [33, 160, 158, 133, 153, 144, 145, 163, 7, 154, 155]
    left_eye_pts = get_hull_points(landmarks, left_eye_indices, w, h)
    if len(left_eye_pts) > 0:
        cv2.drawContours(mask, [cv2.convexHull(left_eye_pts)], -1, 0, -1)
        
    # Exclude right eye
    right_eye_indices = [362, 385, 386, 263, 373, 374, 380, 381, 382, 398]
    right_eye_pts = get_hull_points(landmarks, right_eye_indices, w, h)
    if len(right_eye_pts) > 0:
        cv2.drawContours(mask, [cv2.convexHull(right_eye_pts)], -1, 0, -1)
        
    # Exclude lips
    lips_indices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415]
    lips_pts = get_hull_points(landmarks, lips_indices, w, h)
    if len(lips_pts) > 0:
        cv2.drawContours(mask, [cv2.convexHull(lips_pts)], -1, 0, -1)
        
    # Exclude eyebrows
    left_eb_indices = [70, 63, 105, 66, 107, 55, 46, 53, 52, 65]
    left_eb_pts = get_hull_points(landmarks, left_eb_indices, w, h)
    if len(left_eb_pts) > 0:
        cv2.drawContours(mask, [cv2.convexHull(left_eb_pts)], -1, 0, -1)
        
    right_eb_indices = [300, 293, 334, 296, 336, 285, 276, 283, 282, 295]
    right_eb_pts = get_hull_points(landmarks, right_eb_indices, w, h)
    if len(right_eb_pts) > 0:
        cv2.drawContours(mask, [cv2.convexHull(right_eb_pts)], -1, 0, -1)
        
    # 2. Compute redness index: R - G
    r_channel = img[:, :, 2].astype(np.float32)
    g_channel = img[:, :, 1].astype(np.float32)
    redness = cv2.subtract(r_channel, g_channel)
    
    # Calculate stats of redness in skin area
    skin_redness = redness[mask > 0]
    if len(skin_redness) == 0:
        return {"acne_detected": False, "severity": "None", "acne_spots": []}
        
    avg_redness = np.mean(skin_redness)
    std_redness = np.std(skin_redness)
    
    # Red spot threshold: pixels that are significantly redder than the rest of the skin
    red_threshold = max(10.0, avg_redness + 1.8 * std_redness)
    
    _, red_spots_mask = cv2.threshold(redness, red_threshold, 255, cv2.THRESH_BINARY)
    red_spots_mask = red_spots_mask.astype(np.uint8)
    
    # Ensure spots fall within bare skin mask
    acne_mask = cv2.bitwise_and(red_spots_mask, red_spots_mask, mask=mask)
    
    # Also filter by HSV hue to make sure it's in the reddish/pinkish hue range
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h_channel = hsv[:, :, 0]
    hue_mask = ((h_channel <= 22) | (h_channel >= 158)).astype(np.uint8) * 255
    acne_mask = cv2.bitwise_and(acne_mask, acne_mask, mask=hue_mask)
    
    # 3. Find contours of the spots
    contours, _ = cv2.findContours(acne_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Scale acne spot sizes using face width
    pt_l_cb = np.array([landmarks[234]["x"] * w, landmarks[234]["y"] * h])
    pt_r_cb = np.array([landmarks[454]["x"] * w, landmarks[454]["y"] * h])
    face_width = np.linalg.norm(pt_l_cb - pt_r_cb)
    
    # Define area limits based on face width
    min_area = max(2, int(face_width * 0.003))
    max_area = max(40, int(face_width * 0.05))
    
    detected_spots = []
    for c in contours:
        area = cv2.contourArea(c)
        if min_area <= area <= max_area:
            perimeter = cv2.arcLength(c, True)
            if perimeter == 0:
                continue
            circularity = 4 * np.pi * area / (perimeter * perimeter)
            # Permissive circularity to catch pimples and red marks of different shapes
            if circularity > 0.15:
                M = cv2.moments(c)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    radius = int(np.sqrt(area / np.pi)) + 1
                    detected_spots.append({
                        "center": (cx, cy),
                        "radius": radius
                    })
                    
    num_spots = len(detected_spots)
    
    if num_spots == 0:
        severity = "None"
        acne_detected = False
    elif num_spots <= 3:
        severity = "Mild"
        acne_detected = True
    elif num_spots <= 10:
        severity = "Moderate"
        acne_detected = True
    else:
        severity = "Severe"
        acne_detected = True
        
    return {
        "acne_detected": acne_detected,
        "severity": severity,
        "acne_spots": detected_spots
    }
