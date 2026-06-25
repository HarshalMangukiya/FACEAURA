import math

def calculate_similarity(value, ideal, tolerance):
    """
    Calculates a similarity score in [0.0, 1.0] using a Gaussian penalty function.
    A value equal to the ideal returns 1.0, decaying towards 0.0 as it moves away.
    """
    return math.exp(-((value - ideal) / tolerance) ** 2)

def detect_face_shape(measurements):
    """
    Analyzes face measurements, calculates structural ratios, and determines face shape.
    Supported face shapes: Oval, Round, Square, Rectangle, Heart, Diamond.
    
    Args:
        measurements (dict): A dict with face_length, forehead_width, cheekbone_width, jaw_width.
        
    Returns:
        dict: A dictionary containing 'face_shape' and 'confidence' (float in [0.0, 1.0]).
    """
    fl = float(measurements["face_length"])
    fw = float(measurements["forehead_width"])
    cw = float(measurements["cheekbone_width"])
    jw = float(measurements["jaw_width"])

    # Protect against division by zero
    if cw <= 0 or jw <= 0:
        return {"face_shape": "Oval", "confidence": 0.0}

    # 1. Calculate the 4 main facial ratios
    r1 = fl / cw  # Face Length / Cheekbone Width (ideal: Oval/Rectangle long, Round/Square short)
    r2 = jw / cw  # Jaw Width / Cheekbone Width (ideal: Square/Rectangle wide, Heart/Diamond narrow)
    r3 = fw / jw  # Forehead Width / Jaw Width (ideal: Heart wide forehead, Square/Rectangle equal)
    r4 = fw / cw  # Forehead Width / Cheekbone Width (ideal: Heart wide, Diamond narrow)

    scores = {}

    # --- OVAL RULE ---
    # - Face Length > Cheekbone Width (r1 > 1.0, ideal around 1.20)
    # - Forehead Width slightly larger than Jaw Width (r3 > 1.0, ideal around 1.10)
    # - Rounded/soft jaw (r2 around 0.80)
    scores["Oval"] = (
        calculate_similarity(r1, 1.20, 0.18) *
        calculate_similarity(r3, 1.10, 0.15) *
        calculate_similarity(r2, 0.80, 0.12) *
        calculate_similarity(r4, 0.90, 0.12)
    ) ** 0.25

    # --- ROUND RULE ---
    # - Face Length ≈ Face Width (r1 ≈ 1.0, ideal 0.98)
    # - Rounded jaw, jaw narrow compared to cheeks (r2 around 0.82)
    # - Cheekbones widest area (cw > fw and cw > jw)
    round_base = (
        calculate_similarity(r1, 0.98, 0.10) *
        calculate_similarity(r3, 1.02, 0.12) *
        calculate_similarity(r2, 0.82, 0.12) *
        calculate_similarity(r4, 0.85, 0.12)
    ) ** 0.25
    # Boost if cheekbones are actually the widest part
    round_bonus = 1.0 if (cw > fw and cw > jw) else 0.5
    scores["Round"] = round_base * round_bonus

    # --- SQUARE RULE ---
    # - Face Length ≈ Face Width (r1 ≈ 1.0, ideal 0.98)
    # - Strong Jaw (jaw is wide, r2 >= 0.85)
    # - Forehead Width ≈ Jaw Width (r3 ≈ 1.0, ideal 1.00)
    square_base = (
        calculate_similarity(r1, 0.98, 0.10) *
        calculate_similarity(r3, 1.00, 0.12) *
        calculate_similarity(r2, 0.92, 0.12) *
        calculate_similarity(r4, 0.92, 0.12)
    ) ** 0.25
    # Must have a relatively wide jaw to be square
    square_bonus = 1.0 if (jw / cw > 0.85) else 0.5
    scores["Square"] = square_base * square_bonus

    # --- RECTANGLE (OBLONG) RULE ---
    # - Face Length much greater than Width (r1 is high, e.g., > 1.25)
    # - Forehead Width ≈ Jaw Width (r3 ≈ 1.0, ideal 1.00)
    rectangle_base = (
        calculate_similarity(r1, 1.35, 0.20) *
        calculate_similarity(r3, 1.00, 0.12) *
        calculate_similarity(r2, 0.88, 0.12) *
        calculate_similarity(r4, 0.88, 0.12)
    ) ** 0.25
    # Must be elongated to be rectangle
    rectangle_bonus = 1.0 if (r1 > 1.12) else 0.4
    scores["Rectangle"] = rectangle_base * rectangle_bonus

    # --- HEART RULE ---
    # - Forehead Widest (fw > cw and fw > jw)
    # - Jaw Narrow (r2 is low, e.g., < 0.80)
    # - Pointed chin (r3 is high, e.g., > 1.2)
    heart_base = (
        calculate_similarity(r4, 1.08, 0.12) *
        calculate_similarity(r3, 1.25, 0.20) *
        calculate_similarity(r2, 0.75, 0.12) *
        calculate_similarity(r1, 1.10, 0.18)
    ) ** 0.25
    # Forehead must be widest or very close
    heart_bonus = 1.0 if (fw > cw and fw > jw) else 0.5
    scores["Heart"] = heart_base * heart_bonus

    # --- DIAMOND RULE ---
    # - Cheekbones Widest (cw > fw and cw > jw)
    # - Forehead Narrow and Jaw Narrow (r4 < 0.9, r2 < 0.8)
    diamond_base = (
        calculate_similarity(r1, 1.15, 0.15) *
        calculate_similarity(r4, 0.80, 0.12) *
        calculate_similarity(r2, 0.75, 0.12) *
        calculate_similarity(r3, 1.05, 0.15)
    ) ** 0.25
    # Cheekbones must be wider than forehead and jaw
    diamond_bonus = 1.0 if (cw > fw and cw > jw) else 0.5
    scores["Diamond"] = diamond_base * diamond_bonus

    # Find the shape with the maximum similarity score
    best_shape = max(scores, key=scores.get)
    confidence = scores[best_shape]

    # Normalize/clamp confidence to [0.0, 1.0] and round
    confidence = round(max(0.0, min(1.0, confidence)), 2)

    return {
        "face_shape": best_shape,
        "confidence": confidence
    }
