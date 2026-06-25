import math
from .landmark_indexes import (
    FOREHEAD_CENTER,
    FOREHEAD_LEFT,
    FOREHEAD_RIGHT,
    CHEEKBONE_LEFT,
    CHEEKBONE_RIGHT,
    JAW_LEFT,
    JAW_RIGHT,
    CHIN
)

def calculate_face_measurements(landmarks, img_width=500, img_height=500):
    """
    Calculates facial measurements based on 468 landmarks extracted from MediaPipe Face Mesh.
    Coordinates are scaled to the actual image width and height to return pixel-based distances.
    
    Args:
        landmarks (list): A list of 468 dicts with keys 'x' and 'y' (normalized coords).
        img_width (int): Width of the image in pixels.
        img_height (int): Height of the image in pixels.
        
    Returns:
        dict: A dictionary containing face_length, forehead_width, cheekbone_width, and jaw_width.
    """
    if not landmarks or len(landmarks) < 468:
        raise ValueError("Invalid landmarks. Must provide exactly 468 landmark points.")

    # Helper function to get scaled pixel coordinates (x, y)
    def get_pixel_pt(index):
        point = landmarks[index]
        return (point['x'] * img_width, point['y'] * img_height)

    # Helper function for Euclidean distance
    def euclidean_distance(p1, p2):
        return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

    # 1. Face Length (Forehead Center to Chin)
    pt_forehead_center = get_pixel_pt(FOREHEAD_CENTER)
    pt_chin = get_pixel_pt(CHIN)
    face_length = euclidean_distance(pt_forehead_center, pt_chin)

    # 2. Forehead Width (Left Forehead to Right Forehead)
    pt_forehead_left = get_pixel_pt(FOREHEAD_LEFT)
    pt_forehead_right = get_pixel_pt(FOREHEAD_RIGHT)
    forehead_width = euclidean_distance(pt_forehead_left, pt_forehead_right)

    # 3. Cheekbone Width (Left Cheekbone to Right Cheekbone)
    pt_cheekbone_left = get_pixel_pt(CHEEKBONE_LEFT)
    pt_cheekbone_right = get_pixel_pt(CHEEKBONE_RIGHT)
    cheekbone_width = euclidean_distance(pt_cheekbone_left, pt_cheekbone_right)

    # 4. Jaw Width (Left Jaw to Right Jaw)
    pt_jaw_left = get_pixel_pt(JAW_LEFT)
    pt_jaw_right = get_pixel_pt(JAW_RIGHT)
    jaw_width = euclidean_distance(pt_jaw_left, pt_jaw_right)

    return {
        "face_length": round(face_length),
        "forehead_width": round(forehead_width),
        "cheekbone_width": round(cheekbone_width),
        "jaw_width": round(jaw_width)
    }
