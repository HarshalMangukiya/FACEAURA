from django.core.management.base import BaseCommand
from recommendations.models import Hairstyle, BeardStyle, EyewearStyle

class Command(BaseCommand):
    help = 'Seeds the database with hairstyles, beard styles, and eyewear styles'

    def handle(self, *args, **options):
        self.stdout.write('Seeding recommendations database...')

        # --- HAIRSTYLES ---
        hairstyles_data = [
            {
                "name": "Pompadour",
                "description": "High volume top with short sides. Hair is swept upwards and backwards, creating a dramatic, clean look.",
                "suitable_face_shapes": ["Oval", "Square", "Round"],
                "difficulty_level": "Hard",
                "maintenance_level": "High",
                "tags": ["trendy", "professional", "volume"]
            },
            {
                "name": "Quiff",
                "description": "Similar to the pompadour, but brushed forward before being swept up and back. Highly versatile and styled slightly messy.",
                "suitable_face_shapes": ["Oval", "Round", "Heart"],
                "difficulty_level": "Medium",
                "maintenance_level": "Medium",
                "tags": ["casual", "trendy"]
            },
            {
                "name": "Slick Back",
                "description": "Hair is combed flat straight back using a pomade or wax. Offers a sleek, classic look emphasizing facial structure.",
                "suitable_face_shapes": ["Oval"],
                "difficulty_level": "Easy",
                "maintenance_level": "Medium",
                "tags": ["professional", "classic", "sleek"]
            },
            {
                "name": "Textured Crop",
                "description": "Short textured hair on top with a fade or undercut on the sides. Very modern, low effort, and easy to maintain.",
                "suitable_face_shapes": ["Oval", "Square", "Round", "Diamond"],
                "difficulty_level": "Easy",
                "maintenance_level": "Low",
                "tags": ["casual", "low_maintenance", "trendy"]
            },
            {
                "name": "Side Part",
                "description": "A classic corporate haircut split neatly down one side. Elegant, clean-cut, and perfect for business settings.",
                "suitable_face_shapes": ["Oval", "Square", "Diamond", "Rectangle"],
                "difficulty_level": "Easy",
                "maintenance_level": "Low",
                "tags": ["professional", "classic", "low_maintenance"]
            },
            {
                "name": "High Fade",
                "description": "Sides are cut extremely short near the top of the head, leaving longer hair on top. Creates height and slim silhouette.",
                "suitable_face_shapes": ["Round"],
                "difficulty_level": "Medium",
                "maintenance_level": "High",
                "tags": ["trendy", "edgy"]
            },
            {
                "name": "Faux Hawk",
                "description": "Hair styled upwards along the center line of the head, mimicking a mohawk but with blended sides. Energetic and trendy.",
                "suitable_face_shapes": ["Round", "Diamond"],
                "difficulty_level": "Medium",
                "maintenance_level": "Medium",
                "tags": ["casual", "trendy"]
            },
            {
                "name": "Crew Cut",
                "description": "A military classic where the top is cut relatively short and graduated down to a fade on the sides. Practical and clean.",
                "suitable_face_shapes": ["Square"],
                "difficulty_level": "Easy",
                "maintenance_level": "Low",
                "tags": ["classic", "low_maintenance", "professional"]
            },
            {
                "name": "Fringe",
                "description": "Hair falls over the forehead in a styled crop or sweep. Excellent for balancing long foreheads or balancing chin taper.",
                "suitable_face_shapes": ["Heart", "Rectangle"],
                "difficulty_level": "Easy",
                "maintenance_level": "Medium",
                "tags": ["casual", "trendy"]
            },
            {
                "name": "Side Swept",
                "description": "Longer hair styled to lay across the forehead to one side. Softens heart shape temples and adds casual elegance.",
                "suitable_face_shapes": ["Heart"],
                "difficulty_level": "Easy",
                "maintenance_level": "Medium",
                "tags": ["casual"]
            },
            {
                "name": "Layered Cut",
                "description": "Cut into varying lengths to create depth, volume, and movement. Great for thick or wavy hair textures.",
                "suitable_face_shapes": ["Heart"],
                "difficulty_level": "Medium",
                "maintenance_level": "Medium",
                "tags": ["trendy", "volume"]
            },
            {
                "name": "Textured Fringe",
                "description": "Choppy, layered fringe on top with short tapered sides. Creates contrast and covers a narrower forehead.",
                "suitable_face_shapes": ["Diamond"],
                "difficulty_level": "Easy",
                "maintenance_level": "Medium",
                "tags": ["trendy", "casual"]
            },
            {
                "name": "Layered Medium Hair",
                "description": "Medium length hair cut in layers around the face to add width and volume, balancing elongated structures.",
                "suitable_face_shapes": ["Rectangle"],
                "difficulty_level": "Medium",
                "maintenance_level": "High",
                "tags": ["casual", "trendy"]
            }
        ]

        # --- BEARD STYLES ---
        beards_data = [
            {
                "name": "Stubble",
                "description": "A very short growth of beard hair (1-3mm). Highly attractive, extremely easy to maintain, and suits almost anyone.",
                "suitable_face_shapes": ["Oval", "Heart", "Diamond", "Rectangle"],
                "tags": ["low_maintenance", "casual", "trendy"]
            },
            {
                "name": "Short Beard",
                "description": "A neatly trimmed full beard about 5-10mm long. Professional, structured, and frames the jawline elegantly.",
                "suitable_face_shapes": ["Oval", "Rectangle"],
                "tags": ["professional", "classic", "low_maintenance"]
            },
            {
                "name": "Full Beard",
                "description": "Heavy, dense growth covering the chin, cheeks, and neck. Classic masculine aesthetic that demands regular conditioning.",
                "suitable_face_shapes": ["Oval", "Square"],
                "tags": ["classic", "trendy"]
            },
            {
                "name": "Goatee",
                "description": "Hair restricted purely to the chin and mustache area. Helps elongate round face shapes by creating a focal point at the chin.",
                "suitable_face_shapes": ["Round"],
                "tags": ["casual", "classic"]
            },
            {
                "name": "Extended Goatee",
                "description": "A goatee that extends along the jawline but keeps cheeks clean-shaven. Blends structure with modern flare.",
                "suitable_face_shapes": ["Round"],
                "tags": ["trendy", "casual"]
            },
            {
                "name": "Light Stubble",
                "description": "Barely-there shadow stubble. Adds shadow definition to a strong square jaw without hiding its masculine shape.",
                "suitable_face_shapes": ["Square"],
                "tags": ["low_maintenance", "casual"]
            }
        ]

        # --- EYEWEAR STYLES ---
        eyewear_data = [
            {
                "name": "Aviator",
                "description": "Teardrop-shaped metal frames. Classic retro style that flatters balanced cheekbones and oval structures.",
                "suitable_face_shapes": ["Oval"],
                "tags": ["classic", "trendy", "casual"]
            },
            {
                "name": "Rectangle Frame",
                "description": "Wider than they are tall, adding angular contrast to curves. Ideal for round and oval faces.",
                "suitable_face_shapes": ["Oval", "Round"],
                "tags": ["professional", "classic"]
            },
            {
                "name": "Wayfarer",
                "description": "Thick trapezoidal plastic frames. Timeless design that complements casual and formal attire.",
                "suitable_face_shapes": ["Oval"],
                "tags": ["casual", "trendy", "classic"]
            },
            {
                "name": "Square Frame",
                "description": "Sharp corners that introduce definition to soft features and round structures.",
                "suitable_face_shapes": ["Round"],
                "tags": ["trendy", "professional"]
            },
            {
                "name": "Round Frame",
                "description": "Circular lenses that soften angular face lines. Excellent for square, heart, and rectangle faces.",
                "suitable_face_shapes": ["Square", "Heart", "Rectangle"],
                "tags": ["trendy", "casual"]
            },
            {
                "name": "Oval Frame",
                "description": "Gently rounded oval shapes that soften square and diamond cheek structures.",
                "suitable_face_shapes": ["Square", "Diamond"],
                "tags": ["classic", "professional"]
            },
            {
                "name": "Bottom Heavy Frames",
                "description": "Frames that flare wider at the base to balance a wider heart-shaped forehead.",
                "suitable_face_shapes": ["Heart"],
                "tags": ["trendy", "casual"]
            },
            {
                "name": "Rimless Frames",
                "description": "Minimalist glasses with no border, drawing focus to eyes instead of diamond jawlines.",
                "suitable_face_shapes": ["Diamond"],
                "tags": ["professional", "classic"]
            },
            {
                "name": "Large Frames",
                "description": "Oversized structures that break up the long vertical profile of rectangle faces.",
                "suitable_face_shapes": ["Rectangle"],
                "tags": ["casual", "trendy"]
            }
        ]

        # Create objects
        for data in hairstyles_data:
            Hairstyle.objects.update_or_create(
                name=data["name"],
                defaults={
                    "description": data["description"],
                    "suitable_face_shapes": data["suitable_face_shapes"],
                    "difficulty_level": data["difficulty_level"],
                    "maintenance_level": data["maintenance_level"],
                    "tags": data["tags"]
                }
            )

        for data in beards_data:
            BeardStyle.objects.update_or_create(
                name=data["name"],
                defaults={
                    "description": data["description"],
                    "suitable_face_shapes": data["suitable_face_shapes"],
                    "tags": data["tags"]
                }
            )

        for data in eyewear_data:
            EyewearStyle.objects.update_or_create(
                name=data["name"],
                defaults={
                    "description": data["description"],
                    "suitable_face_shapes": data["suitable_face_shapes"],
                    "tags": data["tags"]
                }
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded hairstyles, beards, and eyewear styles!'))
