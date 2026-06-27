import cv2
import numpy as np

def apply_hair_color(hair_rgba, color_name):
    """
    Tints a transparent hairstyle RGBA image to a target color 
    while preserving highlights and shadows in the Value channel.
    """
    if color_name is None or color_name.lower() in ['original', 'none', '']:
        return hair_rgba.copy()

    # Split channels
    bgr = hair_rgba[:, :, :3]
    alpha = hair_rgba[:, :, 3]

    # Convert to HSV
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    color_lower = color_name.lower().strip()

    # Color mapping rules (Hue in range 0-180, Saturation 0-255, Value 0-255)
    if color_lower == 'black':
        s = np.zeros_like(s)
        v = (v * 0.25).astype(np.uint8)
    elif color_lower == 'brown':
        h = np.full_like(h, 15)  # Orange/brown hue
        s = np.full_like(s, 110)
        v = (v * 0.6).astype(np.uint8)
    elif color_lower == 'dark brown':
        h = np.full_like(h, 15)
        s = np.full_like(s, 90)
        v = (v * 0.35).astype(np.uint8)
    elif color_lower == 'golden':
        h = np.full_like(h, 23)
        s = np.full_like(s, 190)
        v = np.clip(v.astype(float) * 1.5 + 90, 0, 255).astype(np.uint8)
    elif color_lower == 'blonde':
        h = np.full_like(h, 25)
        s = np.full_like(s, 110)
        v = np.clip(v.astype(float) * 1.5 + 100, 0, 255).astype(np.uint8)
    elif color_lower == 'ash blonde':
        h = np.full_like(h, 25)
        s = np.full_like(s, 60)
        v = np.clip(v.astype(float) * 1.4 + 80, 0, 255).astype(np.uint8)
    elif color_lower == 'grey':
        s = (s * 0.05).astype(np.uint8)
        v = np.clip(v.astype(float) * 1.2 + 60, 0, 255).astype(np.uint8)
    elif color_lower == 'silver':
        s = (s * 0.02).astype(np.uint8)
        v = np.clip(v.astype(float) * 1.5 + 110, 0, 255).astype(np.uint8)
    elif color_lower == 'red':
        h = np.full_like(h, 0)
        s = np.full_like(s, 200)
        v = np.clip(v.astype(float) * 1.3 + 50, 0, 255).astype(np.uint8)
    elif color_lower == 'blue':
        h = np.full_like(h, 115)
        s = np.full_like(s, 180)
        v = np.clip(v.astype(float) * 1.2 + 40, 0, 255).astype(np.uint8)
    elif color_lower == 'purple':
        h = np.full_like(h, 145)
        s = np.full_like(s, 170)
        v = np.clip(v.astype(float) * 1.2 + 40, 0, 255).astype(np.uint8)
    elif color_lower == 'pink':
        h = np.full_like(h, 170)
        s = np.full_like(s, 120)
        v = np.clip(v.astype(float) * 1.4 + 60, 0, 255).astype(np.uint8)
    else:
        # Unknown color, return original
        return hair_rgba.copy()

    # Re-merge HSV
    hsv_tinted = cv2.merge([h, s, v])
    bgr_tinted = cv2.cvtColor(hsv_tinted, cv2.COLOR_HSV2BGR)

    # Re-merge BGRA
    rgba_tinted = cv2.merge([bgr_tinted[:, :, 0], bgr_tinted[:, :, 1], bgr_tinted[:, :, 2], alpha])
    return rgba_tinted
