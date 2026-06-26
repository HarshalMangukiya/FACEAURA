import cv2
import os
from .overlay_utils import resize_image, rotate_image, blend_rgba_onto_bgr

class GlassesOverlay:
    def __init__(self):
        self.asset_img = None
        self.processed_img = None
        self.x_offset = 0
        self.y_offset = 0

    def load_asset(self, path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Glasses asset path not found: {path}")
        self.asset_img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        if self.asset_img is None or self.asset_img.shape[2] != 4:
            raise ValueError(f"Glasses asset must be a transparent 4-channel PNG: {path}")
        self.processed_img = self.asset_img.copy()

    def resize(self, scale_factor):
        if self.processed_img is not None:
            self.processed_img = resize_image(self.processed_img, scale_factor)

    def rotate(self, angle):
        if self.processed_img is not None:
            self.processed_img = rotate_image(self.processed_img, angle)

    def align(self, alignment_data):
        """
        Aligns glasses on the nose bridge center, scaling to fit the eye distance.
        """
        if self.asset_img is None:
            return

        self.processed_img = self.asset_img.copy()

        face_center = alignment_data['face_center']
        eye_distance = alignment_data['eye_distance']
        rotation_angle = alignment_data['rotation_angle']

        # Glasses width target should be approximately 2.25x the distance between eyes
        target_w = eye_distance * 2.3
        asset_w = self.asset_img.shape[1]
        scale_factor = target_w / asset_w

        self.resize(scale_factor)
        self.rotate(rotation_angle)

        # Map center of glasses (horizontally and vertically centered) to the nose bridge center
        h, w = self.processed_img.shape[:2]
        anchor_x = w // 2
        anchor_y = h // 2

        self.x_offset = face_center[0] - anchor_x
        self.y_offset = face_center[1] - anchor_y

    def blend(self, background_img):
        if self.processed_img is None:
            return background_img
        return blend_rgba_onto_bgr(background_img, self.processed_img, self.x_offset, self.y_offset)
