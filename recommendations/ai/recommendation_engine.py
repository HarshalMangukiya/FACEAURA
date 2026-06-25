from ..models import Hairstyle, BeardStyle, EyewearStyle

# Rule engine rules mapping face shapes to styling names (priority-ordered)
RULE_ENGINE_RULES = {
    'Oval': {
        'hairstyles': ["Pompadour", "Quiff", "Slick Back", "Textured Crop", "Side Part"],
        'beards': ["Stubble", "Short Beard", "Full Beard"],
        'eyewear': ["Aviator", "Rectangle Frame", "Wayfarer"]
    },
    'Round': {
        'hairstyles': ["High Fade", "Pompadour", "Faux Hawk", "Quiff"],
        'beards': ["Goatee", "Extended Goatee"],
        'eyewear': ["Rectangle Frame", "Square Frame"]
    },
    'Square': {
        'hairstyles': ["Side Part", "Crew Cut", "Textured Crop"],
        'beards': ["Light Stubble", "Full Beard"],
        'eyewear': ["Round Frame", "Oval Frame"]
    },
    'Heart': {
        'hairstyles': ["Fringe", "Side Swept", "Layered Cut"],
        'beards': [],
        'eyewear': ["Bottom Heavy Frames", "Round Frames"]
    },
    'Diamond': {
        'hairstyles': ["Textured Fringe", "Side Part"],
        'beards': [],
        'eyewear': ["Oval Frames", "Rimless Frames"]
    },
    'Rectangle': {
        'hairstyles': ["Fringe", "Side Part", "Layered Medium Hair"],
        'beards': [],
        'eyewear': ["Large Frames", "Round Frames"]
    }
}

def get_face_shape_key(face_shape):
    """
    Standardize the face shape string to match the dictionary keys.
    """
    if not face_shape:
        return 'Oval'
    
    # Capitalize the first letter, handle common variations
    normalized = face_shape.strip().lower()
    for key in RULE_ENGINE_RULES.keys():
        if key.lower() == normalized:
            return key
            
    return 'Oval'  # Fallback standard


def calculate_match_score(name, priority_list, confidence):
    """
    Calculate confidence score (0-100) based on style priority index
    and biometric confidence multiplier.
    """
    base_score = 70  # Default base score for matching but unlisted styles
    
    # Check if name exists in the priority list (case-insensitive)
    index = -1
    for idx, priority_name in enumerate(priority_list):
        if priority_name.lower() == name.lower():
            index = idx
            break
            
    if index != -1:
        total = len(priority_list)
        if total > 1:
            # Score declines from 95 (highest priority) down to 75 (lowest priority)
            base_score = 95 - int(index * (20 / (total - 1)))
        else:
            base_score = 95
            
    # Apply confidence multiplier: scales final score based on detection confidence
    # If confidence is 100%, score = base_score. If confidence is 0%, score = base_score * 0.85
    conf_value = confidence if confidence is not None else 1.0
    multiplier = 0.85 + (0.15 * conf_value)
    
    final_score = int(base_score * multiplier)
    return min(max(final_score, 0), 100)


def generate_recommendations(face_shape, face_shape_confidence=1.0, request=None):
    """
    Generate recommendations from the database for the given face shape.
    Returns:
        dict: A dictionary containing lists of hairstyles, beard styles, and eyewear.
    """
    from ..serializers import HairstyleSerializer, BeardStyleSerializer, EyewearStyleSerializer
    
    normalized_shape = get_face_shape_key(face_shape)
    rules = RULE_ENGINE_RULES.get(normalized_shape, {'hairstyles': [], 'beards': [], 'eyewear': []})
    
    # Context dictionary for building absolute URLs for images in serializers
    serializer_context = {'request': request} if request else {}
    
    # 1. Hairstyle recommendations
    hairstyles = Hairstyle.objects.all()
    matching_hairstyles = []
    for h in hairstyles:
        if any(shape.lower() == normalized_shape.lower() for shape in h.suitable_face_shapes):
            serialized = HairstyleSerializer(h, context=serializer_context).data
            score = calculate_match_score(h.name, rules['hairstyles'], face_shape_confidence)
            serialized['score'] = score
            matching_hairstyles.append(serialized)
    # Sort by score descending
    matching_hairstyles.sort(key=lambda x: x['score'], reverse=True)
    
    # 2. Beard recommendations
    beards = BeardStyle.objects.all()
    matching_beards = []
    for b in beards:
        if any(shape.lower() == normalized_shape.lower() for shape in b.suitable_face_shapes):
            serialized = BeardStyleSerializer(b, context=serializer_context).data
            score = calculate_match_score(b.name, rules['beards'], face_shape_confidence)
            serialized['score'] = score
            matching_beards.append(serialized)
    matching_beards.sort(key=lambda x: x['score'], reverse=True)
    
    # 3. Eyewear recommendations
    eyewear = EyewearStyle.objects.all()
    matching_eyewear = []
    for e in eyewear:
        if any(shape.lower() == normalized_shape.lower() for shape in e.suitable_face_shapes):
            serialized = EyewearStyleSerializer(e, context=serializer_context).data
            score = calculate_match_score(e.name, rules['eyewear'], face_shape_confidence)
            serialized['score'] = score
            matching_eyewear.append(serialized)
    matching_eyewear.sort(key=lambda x: x['score'], reverse=True)
    
    return {
        'face_shape': normalized_shape,
        'hairstyles': matching_hairstyles,
        'beard_styles': matching_beards,
        'eyewear': matching_eyewear
    }
