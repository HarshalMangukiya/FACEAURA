import math
from ..utils.landmark_constants import (
    LEFT_EYE_CENTER, RIGHT_EYE_CENTER,
    NOSE_BRIDGE, FOREHEAD_TOP, CHIN,
    CHEEKBONE_LEFT, CHEEKBONE_RIGHT,
    JAW_LEFT, JAW_RIGHT
)

def get_pixel_coords(landmarks, img_w, img_h):
    """
    Converts relative landmarks to pixel coordinate list.
    """
    coords = {}
    for idx in [LEFT_EYE_CENTER, RIGHT_EYE_CENTER, NOSE_BRIDGE, FOREHEAD_TOP, CHIN, CHEEKBONE_LEFT, CHEEKBONE_RIGHT, JAW_LEFT, JAW_RIGHT]:
        if idx < len(landmarks):
            pt = landmarks[idx]
            coords[idx] = (int(round(pt['x'] * img_w)), int(round(pt['y'] * img_h)))
        else:
            coords[idx] = (0, 0)
    return coords


def align_face(landmarks, img_w, img_h):
    """
    Computes rotation angle, scaling metrics, and center anchors for facial features.
    """
    coords = get_pixel_coords(landmarks, img_w, img_h)
    
    left_eye = coords[LEFT_EYE_CENTER]
    right_eye = coords[RIGHT_EYE_CENTER]
    nose = coords[NOSE_BRIDGE]
    forehead = coords[FOREHEAD_TOP]
    chin = coords[CHIN]
    cheek_l = coords[CHEEKBONE_LEFT]
    cheek_r = coords[CHEEKBONE_RIGHT]
    jaw_l = coords[JAW_LEFT]
    jaw_r = coords[JAW_RIGHT]

    # 1. Rotation Angle
    dx = right_eye[0] - left_eye[0]
    dy = right_eye[1] - left_eye[1]
    rotation_angle = math.degrees(math.atan2(dy, dx))

    # 2. Eye Distance
    eye_distance = math.sqrt(dx**2 + dy**2)

    # 3. Cheekbone Width (Face width)
    face_width = math.sqrt((cheek_r[0] - cheek_l[0])**2 + (cheek_r[1] - cheek_l[1])**2)

    # 4. Jaw Width
    jaw_width = math.sqrt((jaw_r[0] - jaw_l[0])**2 + (jaw_r[1] - jaw_l[1])**2)

    # 5. Height metrics
    face_height = math.sqrt((chin[0] - forehead[0])**2 + (chin[1] - forehead[1])**2)

    return {
        'face_center': nose,
        'forehead_top': forehead,
        'chin_base': chin,
        'rotation_angle': rotation_angle,
        'eye_distance': eye_distance if eye_distance > 0 else 1.0,
        'face_width': face_width if face_width > 0 else 1.0,
        'jaw_width': jaw_width if jaw_width > 0 else 1.0,
        'face_height': face_height if face_height > 0 else 1.0,
    }
