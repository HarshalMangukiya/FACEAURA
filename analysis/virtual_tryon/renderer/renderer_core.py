import cv2
from ..alignment.face_alignment import align_face
from ..overlay.hairstyle_overlay import HairOverlay
from ..overlay.beard_overlay import BeardOverlay
from ..overlay.glasses_overlay import GlassesOverlay

def process_overlay_composition(img_bgr, landmarks, hairstyle_path=None, beard_path=None, glasses_path=None, color_name=None):
    """
    Core overlay rendering logic.
    Accepts BGR image array and landmarks list, applies requested hairstyle,
    beard, glasses overlays, and tints hair to the target color.
    """
    img_h, img_w = img_bgr.shape[:2]
    
    # 1. Run face alignment parameters calculation
    alignment_data = align_face(landmarks, img_w, img_h)
    
    composite_img = img_bgr.copy()

    # 2. Apply Hairstyle Overlay
    if hairstyle_path:
        try:
            hair_overlay = HairOverlay()
            hair_overlay.load_asset(hairstyle_path)
            hair_overlay.align(alignment_data)
            if color_name:
                hair_overlay.change_color(color_name)
            composite_img = hair_overlay.blend(composite_img)
        except Exception as e:
            # Log error and continue overlaying other assets
            print(f"Error applying hairstyle overlay: {e}")

    # 3. Apply Beard Overlay
    if beard_path:
        try:
            beard_overlay = BeardOverlay()
            beard_overlay.load_asset(beard_path)
            beard_overlay.align(alignment_data)
            composite_img = beard_overlay.blend(composite_img)
        except Exception as e:
            print(f"Error applying beard overlay: {e}")

    # 4. Apply Glasses Overlay
    if glasses_path:
        try:
            glasses_overlay = GlassesOverlay()
            glasses_overlay.load_asset(glasses_path)
            glasses_overlay.align(alignment_data)
            composite_img = glasses_overlay.blend(composite_img)
        except Exception as e:
            print(f"Error applying glasses overlay: {e}")

    return composite_img
