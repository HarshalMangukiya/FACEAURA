import cv2
import os
from .renderer_core import process_overlay_composition

def render_image(image_path, landmarks, hairstyle_path=None, beard_path=None, glasses_path=None, color_name=None):
    """
    Renders virtual overlays onto a static image file loaded from disk.
    Returns the composite image array (BGR).
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Original image not found: {image_path}")
        
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise ValueError(f"Failed to read original image: {image_path}")
        
    return process_overlay_composition(
        img_bgr=img_bgr,
        landmarks=landmarks,
        hairstyle_path=hairstyle_path,
        beard_path=beard_path,
        glasses_path=glasses_path,
        color_name=color_name
    )
