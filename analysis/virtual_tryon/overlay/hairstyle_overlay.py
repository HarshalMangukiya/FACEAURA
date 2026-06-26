import cv2
import numpy as np
import os
from .overlay_utils import resize_image, rotate_image, blend_rgba_onto_bgr
from ..color.hair_color import apply_hair_color

class HairOverlay:
    def __init__(self):
        self.asset_img = None
        self.processed_img = None
        self.x_offset = 0
        self.y_offset = 0

    def load_asset(self, path):
        """
        Loads the transparent hairstyle PNG.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"Hairstyle asset path not found: {path}")
        # Read with alpha channel
        self.asset_img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        if self.asset_img is None or self.asset_img.shape[2] != 4:
            raise ValueError(f"Hairstyle asset must be a transparent 4-channel PNG: {path}")
        self.processed_img = self.asset_img.copy()

    def resize(self, scale_factor):
        if self.processed_img is not None:
            self.processed_img = resize_image(self.processed_img, scale_factor)

    def rotate(self, angle):
        if self.processed_img is not None:
            self.processed_img = rotate_image(self.processed_img, angle)

    def change_color(self, color_name):
        if self.processed_img is not None:
            self.processed_img = apply_hair_color(self.processed_img, color_name)

    def align(self, alignment_data):
        """
        Aligns the hairstyle on the forehead center (FOREHEAD_TOP),
        scaling relative to face_width and rotating relative to face tilt.
        """
        if self.asset_img is None:
            return

        # 1. Reset processed image
        self.processed_img = self.asset_img.copy()

        # 2. Extract metrics
        forehead_center = alignment_data['forehead_top']
        face_width = alignment_data['face_width']
        rotation_angle = alignment_data['rotation_angle']

        # 3. Calculate target size
        # A good hairstyle width is around 1.35x cheekbone width
        target_w = face_width * 1.35
        asset_w = self.asset_img.shape[1]
        scale_factor = target_w / asset_w
        
        # 4. Resize and Rotate
        self.resize(scale_factor)
        self.rotate(rotation_angle)

        # 5. Position alignment
        # Forehead top hairline center is mapped to center-bottom of the hair asset.
        # Template anchor: horizontally centered (width // 2), vertically around 65% of the asset height.
        h, w = self.processed_img.shape[:2]
        anchor_x = w // 2
        anchor_y = int(h * 0.62)

        # Calculate offset coordinates
        self.x_offset = forehead_center[0] - anchor_x
        self.y_offset = forehead_center[1] - anchor_y

    def blend(self, background_img):
        """
        Overlays the processed hair image onto the face photo.
        """
        if self.processed_img is None:
            return background_img
        return blend_rgba_onto_bgr(background_img, self.processed_img, self.x_offset, self.y_offset)
