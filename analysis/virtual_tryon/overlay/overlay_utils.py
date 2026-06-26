import cv2
import numpy as np

def rotate_image(image, angle, center=None):
    """
    Rotates an image (RGBA or BGR) by a given angle around a center.
    Fills background with transparency/black.
    """
    h, w = image.shape[:2]
    if center is None:
        center = (w // 2, h // 2)
    rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Check if image is RGBA
    if image.shape[2] == 4:
        border_val = (0, 0, 0, 0)
    else:
        border_val = (0, 0, 0)
        
    rotated = cv2.warpAffine(
        image, rot_mat, (w, h), 
        flags=cv2.INTER_LINEAR, 
        borderMode=cv2.BORDER_CONSTANT, 
        borderValue=border_val
    )
    return rotated


def resize_image(image, scale_factor):
    """
    Resizes an image by a scale factor.
    """
    h, w = image.shape[:2]
    new_w = int(w * scale_factor)
    new_h = int(h * scale_factor)
    if new_w <= 0 or new_h <= 0:
        return image.copy()
    
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized


def blend_rgba_onto_bgr(background, overlay_rgba, x_offset, y_offset):
    """
    Blends a transparent RGBA image onto a BGR background image at x, y offset.
    Handles out-of-bounds positioning gracefully by cropping.
    """
    bg_h, bg_w = background.shape[:2]
    ov_h, ov_w = overlay_rgba.shape[:2]

    # Overlay placement bounds
    x1, y1 = max(0, x_offset), max(0, y_offset)
    x2, y2 = min(bg_w, x_offset + ov_w), min(bg_h, y_offset + ov_h)

    # Completely out of bounds
    if x1 >= x2 or y1 >= y2:
        return background.copy()

    # Overlay crop bounds
    ov_x1 = max(0, -x_offset)
    ov_y1 = max(0, -y_offset)
    ov_x2 = ov_x1 + (x2 - x1)
    ov_y2 = ov_y1 + (y2 - y1)

    # Crop both arrays
    overlay_crop = overlay_rgba[ov_y1:ov_y2, ov_x1:ov_x2]
    background_crop = background[y1:y2, x1:x2]

    # Blend math
    overlay_rgb = overlay_crop[:, :, :3]
    overlay_alpha = overlay_crop[:, :, 3] / 255.0
    alpha_3d = np.expand_dims(overlay_alpha, axis=2)

    blended = (overlay_rgb * alpha_3d + background_crop * (1.0 - alpha_3d)).astype(np.uint8)

    # Update background copy
    result = background.copy()
    result[y1:y2, x1:x2] = blended
    return result
