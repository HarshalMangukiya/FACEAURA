import os
import cv2
import numpy as np
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.files import File
from analysis.models import HairStyleAsset, BeardAsset, GlassesAsset

class Command(BaseCommand):
    help = 'Seeds mock transparent overlay assets (hairstyles, beards, glasses) for Phase 8 Virtual Try-On'

    def handle(self, *args, **options):
        self.stdout.write("Generating mock overlay asset PNG images...")

        # Create directories in media if they don't exist
        media_root = settings.MEDIA_ROOT
        hs_dir = os.path.join(media_root, 'assets', 'hairstyles')
        hs_thumb_dir = os.path.join(hs_dir, 'thumbnails')
        beard_dir = os.path.join(media_root, 'assets', 'beards')
        beard_thumb_dir = os.path.join(beard_dir, 'thumbnails')
        glasses_dir = os.path.join(media_root, 'assets', 'glasses')
        glasses_thumb_dir = os.path.join(glasses_dir, 'thumbnails')

        for d in [hs_dir, hs_thumb_dir, beard_dir, beard_thumb_dir, glasses_dir, glasses_thumb_dir]:
            os.makedirs(d, exist_ok=True)

        # -------------------------------------------------------------
        # Helper: Generate Hairstyle PNG
        # -------------------------------------------------------------
        def create_hairstyle_png(path, filename, hair_type="slick"):
            # Size 400x400
            img = np.zeros((400, 400, 4), dtype=np.uint8) # Transparent BG
            # Anchor point is around (200, 248) (center, 62% down)
            # Forehead top hairline is mapped here. So hair is drawn above y=248.
            
            if hair_type == "slick":
                # Dark slick back hair: arc from y=80 to y=250
                cv2.ellipse(img, (200, 200), (120, 80), 0, 180, 360, (30, 40, 50, 255), -1)
                # Some texture strands
                cv2.ellipse(img, (200, 200), (120, 80), 0, 180, 360, (50, 65, 80, 255), 3)
                cv2.ellipse(img, (200, 200), (90, 60), 0, 180, 360, (50, 65, 80, 255), 2)
            elif hair_type == "wavy":
                # Long wavy locks: hair volume at top, waves hanging down left and right
                # Top cap
                cv2.ellipse(img, (200, 190), (140, 90), 0, 180, 360, (60, 110, 150, 255), -1)
                # Left locks hanging down to y=350
                cv2.ellipse(img, (80, 270), (40, 90), 0, 0, 360, (50, 90, 130, 255), -1)
                # Right locks hanging down to y=350
                cv2.ellipse(img, (320, 270), (40, 90), 0, 0, 360, (50, 90, 130, 255), -1)
            elif hair_type == "bob":
                # Short bob: hair framing face
                cv2.ellipse(img, (200, 180), (130, 80), 0, 180, 360, (40, 45, 90, 255), -1)
                # Left side
                cv2.rectangle(img, (70, 180), (110, 270), (35, 40, 80, 255), -1)
                # Right side
                cv2.rectangle(img, (290, 180), (330, 270), (35, 40, 80, 255), -1)
            elif hair_type == "curly":
                # Round Afro shape
                cv2.circle(img, (200, 180), 120, (20, 20, 20, 255), -1)
                # Draw small circles to simulate curls texture
                for a in range(0, 360, 15):
                    rad = np.deg2rad(a)
                    cx = int(200 + 120 * np.cos(rad))
                    cy = int(180 + 120 * np.sin(rad))
                    cv2.circle(img, (cx, cy), 25, (30, 30, 30, 255), -1)
            
            full_path = os.path.join(path, filename)
            cv2.imwrite(full_path, img)
            return full_path

        # -------------------------------------------------------------
        # Helper: Generate Beard PNG
        # -------------------------------------------------------------
        def create_beard_png(path, filename, beard_type="full"):
            img = np.zeros((400, 400, 4), dtype=np.uint8)
            # Anchor point is around (200, 260) (center, 65% down)
            # Chin base is mapped here. Beard wraps around y=260 and below.

            if beard_type == "full":
                # Big chin loop beard
                cv2.ellipse(img, (200, 250), (110, 90), 0, 0, 180, (25, 30, 35, 255), -1)
                # Sideburns going up left & right
                cv2.rectangle(img, (90, 150), (120, 250), (25, 30, 35, 255), -1)
                # Right sideburn
                cv2.rectangle(img, (280, 150), (310, 250), (25, 30, 35, 255), -1)
                # Moustache
                cv2.ellipse(img, (200, 215), (70, 15), 0, 0, 360, (20, 25, 30, 255), -1)
            elif beard_type == "goatee":
                # Chin patch & moustache only
                cv2.ellipse(img, (200, 270), (45, 45), 0, 0, 180, (25, 30, 35, 255), -1)
                cv2.ellipse(img, (200, 215), (65, 12), 0, 0, 360, (20, 25, 30, 255), -1)
            elif beard_type == "stubble":
                # Light stubble outline (semi-transparent gray/black)
                cv2.ellipse(img, (200, 250), (105, 85), 0, 0, 180, (40, 45, 50, 120), 15)
                # Moustache
                cv2.ellipse(img, (200, 215), (65, 12), 0, 0, 360, (40, 45, 50, 120), -1)

            full_path = os.path.join(path, filename)
            cv2.imwrite(full_path, img)
            return full_path

        # -------------------------------------------------------------
        # Helper: Generate Glasses PNG
        # -------------------------------------------------------------
        def create_glasses_png(path, filename, glasses_type="classic"):
            # Size 400x200
            img = np.zeros((200, 400, 4), dtype=np.uint8)
            # Anchor point is around (200, 100) (center)
            # Nose bridge mapped here.
            
            if glasses_type == "classic":
                # Thick square black glasses
                # Left frame
                cv2.rectangle(img, (95, 65), (175, 135), (20, 20, 20, 255), 6)
                # Right frame
                cv2.rectangle(img, (225, 65), (305, 135), (20, 20, 20, 255), 6)
                # Bridge
                cv2.line(img, (175, 100), (225, 100), (20, 20, 20, 255), 6)
                # Temples (legs)
                cv2.line(img, (95, 90), (40, 80), (20, 20, 20, 255), 5)
                cv2.line(img, (305, 90), (360, 80), (20, 20, 20, 255), 5)
            elif glasses_type == "round":
                # Round metal frames
                cv2.circle(img, (135, 100), 38, (80, 80, 80, 255), 4)
                cv2.circle(img, (265, 100), 38, (80, 80, 80, 255), 4)
                # Bridge
                cv2.ellipse(img, (200, 95), (30, 15), 0, 180, 360, (80, 80, 80, 255), 4)
                # Temples
                cv2.line(img, (97, 100), (45, 90), (80, 80, 80, 255), 3)
                cv2.line(img, (303, 100), (355, 90), (80, 80, 80, 255), 3)
            elif glasses_type == "aviator":
                # Tinted aviator shades (dark lenses with gold rim)
                # Left lens
                pts_l = np.array([[95,85], [170,80], [175,120], [135,140], [100,120]], dtype=np.int32)
                cv2.fillPoly(img, [pts_l], (40, 30, 20, 190))
                cv2.polylines(img, [pts_l], True, (30, 180, 220, 255), 3)
                # Right lens
                pts_r = np.array([[230,80], [305,85], [300,120], [265,140], [225,120]], dtype=np.int32)
                cv2.fillPoly(img, [pts_r], (40, 30, 20, 190))
                cv2.polylines(img, [pts_r], True, (30, 180, 220, 255), 3)
                # Bridge
                cv2.line(img, (170, 88), (230, 88), (30, 180, 220, 255), 4)
                cv2.line(img, (172, 100), (228, 100), (30, 180, 220, 255), 2)
                # Temples
                cv2.line(img, (95, 95), (45, 85), (30, 180, 220, 255), 3)
                cv2.line(img, (305, 95), (355, 85), (30, 180, 220, 255), 3)

            full_path = os.path.join(path, filename)
            cv2.imwrite(full_path, img)
            return full_path

        # -------------------------------------------------------------
        # Seed Hairstyles
        # -------------------------------------------------------------
        hairstyles_data = [
            {"name": "Classic Slick Back", "face_shape": "Oval", "gender": "Male", "length": "Short", "style": "Professional", "type": "slick"},
            {"name": "Long Wavy Locks", "face_shape": "Heart", "gender": "Female", "length": "Long", "style": "Casual", "type": "wavy"},
            {"name": "Modern Bob Cut", "face_shape": "Square", "gender": "Female", "length": "Medium", "style": "Trendy", "type": "bob"},
            {"name": "Curly Afro Volume", "face_shape": "Round", "gender": "Unisex", "length": "Medium", "style": "Casual", "type": "curly"},
        ]

        for item in hairstyles_data:
            filename = f"hs_{item['type']}.png"
            path = create_hairstyle_png(hs_dir, filename, item['type'])
            
            # Thumbnail can be the same file or a resized copy
            thumb_filename = f"hs_{item['type']}_thumb.png"
            thumb_path = os.path.join(hs_thumb_dir, thumb_filename)
            cv2.imwrite(thumb_path, cv2.resize(cv2.imread(path, cv2.IMREAD_UNCHANGED), (120, 120)))

            # Save model
            asset, created = HairStyleAsset.objects.get_or_create(
                name=item['name'],
                defaults={
                    "face_shape": item['face_shape'],
                    "gender": item['gender'],
                    "length": item['length'],
                    "style": item['style'],
                    "image": f"assets/hairstyles/{filename}",
                    "thumbnail": f"assets/hairstyles/thumbnails/{thumb_filename}",
                    "active": True
                }
            )
            status_str = "Created" if created else "Already Exists"
            self.stdout.write(f"Hairstyle '{item['name']}': {status_str}")

        # -------------------------------------------------------------
        # Seed Beards
        # -------------------------------------------------------------
        beards_data = [
            {"name": "Full Hipster Beard", "type": "full"},
            {"name": "Classic Goatee", "type": "goatee"},
            {"name": "Light Stubble", "type": "stubble"},
        ]

        for item in beards_data:
            filename = f"beard_{item['type']}.png"
            path = create_beard_png(beard_dir, filename, item['type'])

            # Thumbnail
            thumb_filename = f"beard_{item['type']}_thumb.png"
            thumb_path = os.path.join(beard_thumb_dir, thumb_filename)
            cv2.imwrite(thumb_path, cv2.resize(cv2.imread(path, cv2.IMREAD_UNCHANGED), (120, 120)))

            # Save model
            asset, created = BeardAsset.objects.get_or_create(
                name=item['name'],
                defaults={
                    "image": f"assets/beards/{filename}",
                    "thumbnail": f"assets/beards/thumbnails/{thumb_filename}",
                    "active": True
                }
            )
            status_str = "Created" if created else "Already Exists"
            self.stdout.write(f"Beard '{item['name']}': {status_str}")

        # -------------------------------------------------------------
        # Seed Glasses
        # -------------------------------------------------------------
        glasses_data = [
            {"name": "Classic Black Square Frames", "type": "classic"},
            {"name": "Retro Round Wire Frames", "type": "round"},
            {"name": "Sleek Aviator Sunglasses", "type": "aviator"},
        ]

        for item in glasses_data:
            filename = f"glasses_{item['type']}.png"
            path = create_glasses_png(glasses_dir, filename, item['type'])

            # Thumbnail
            thumb_filename = f"glasses_{item['type']}_thumb.png"
            thumb_path = os.path.join(glasses_thumb_dir, thumb_filename)
            cv2.imwrite(thumb_path, cv2.resize(cv2.imread(path, cv2.IMREAD_UNCHANGED), (120, 60)))

            # Save model
            asset, created = GlassesAsset.objects.get_or_create(
                name=item['name'],
                defaults={
                    "image": f"assets/glasses/{filename}",
                    "thumbnail": f"assets/glasses/thumbnails/{thumb_filename}",
                    "active": True
                }
            )
            status_str = "Created" if created else "Already Exists"
            self.stdout.write(f"Glasses '{item['name']}': {status_str}")

        self.stdout.write(self.style.SUCCESS("All Virtual Try-On assets seeded successfully!"))
