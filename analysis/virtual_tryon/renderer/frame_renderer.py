from .renderer_core import process_overlay_composition

def render_frame(frame_bgr, landmarks, hairstyle_path=None, beard_path=None, glasses_path=None, color_name=None):
    """
    Renders virtual overlays on raw BGR frame arrays in real-time.
    Used for live camera loop streaming (Phase 9 integration prep).
    """
    return process_overlay_composition(
        img_bgr=frame_bgr,
        landmarks=landmarks,
        hairstyle_path=hairstyle_path,
        beard_path=beard_path,
        glasses_path=glasses_path,
        color_name=color_name
    )
