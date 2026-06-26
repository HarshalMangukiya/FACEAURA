import cv2
import os
from .overlay_utils import resize_image, rotate_image, blend_rgba_onto_bgr

class BeardOverlay:
    def __init__(self):
        self.asset_img = None
        self.processed_img = None
        self.x_offset = 0
        self.y_offset = 0

    def load_asset(self, path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Beard asset path not found: {path}")
        self.asset_img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        if self.asset_img is None or self.asset_img.shape[2] != 4:
            raise ValueError(f"Beard asset must be a transparent 4-channel PNG: {path}")
        self.processed_img = self.asset_img.copy()

    def resize(self, scale_factor):
        if self.processed_img is not None:
            self.processed_img = resize_image(self.processed_img, scale_factor)

    def rotate(self, angle):
        if self.processed_img is not None:
            self.processed_img = rotate_image(self.processed_img, angle)

    def align(self, alignment_data):
        """
        Aligns the beard asset on the chin, scaling to match jaw width.
        """
        if self.asset_img is None:
            return

        self.processed_img = self.asset_img.copy()

        chin_base = alignment_data['chin_base']
        jaw_width = alignment_data['jaw_width']
        rotation_angle = alignment_data['rotation_angle']

        # Beard width target should scale to 1.1x jaw width
        target_w = jaw_width * 1.15
        asset_w = self.asset_img.shape[1]
        scale_factor = target_w / asset_w

        self.resize(scale_factor)
        self.rotate(rotation_angle)

        # Bottom-center of the mouth/chin coordinates relative to beard template.
        # Let's map chin_base to horizontally centered (width // 2), vertically around 65% of the beard asset.
        h, w = self.processed_img.shape[:2]
        anchor_x = w // 2
        anchor_y = int(h * 0.65)

        self.x_offset = chin_base[0] - anchor_x
        self.y_offset = chin_base[1] - anchor_y

    def blend(self, background_img):
        if self.processed_img is None:
            return background_img
        return blend_rgba_onto_bgr(background_img, self.processed_img, self.x_offset, self.y_offset)
