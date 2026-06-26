def calculate_skin_health_score(acne_severity, dark_circles_detected, pigmentation_detected, variance_score=0.0):
    """
    Calculates a composite skin health score between 0 and 100.
    
    Formula:
        Score = 100 - AcnePenalty - DarkCirclePenalty - PigmentationPenalty - TexturePenalty
        
    Penalties:
        - Acne: None (0), Mild (6), Moderate (15), Severe (35)
        - Dark Circles: 8 if detected
        - Pigmentation: 10 if detected
        - Texture: up to 5 points based on variance_score
    """
    # 1. Acne Penalty
    acne_severity = str(acne_severity).capitalize()
    if acne_severity == "Mild":
        acne_penalty = 6
    elif acne_severity == "Moderate":
        acne_penalty = 15
    elif acne_severity == "Severe":
        acne_penalty = 35
    else:
        acne_penalty = 0
        
    # 2. Dark Circles Penalty
    dark_circles_penalty = 8 if dark_circles_detected else 0
    
    # 3. Pigmentation Penalty
    pigmentation_penalty = 10 if pigmentation_detected else 0
    
    # 4. Texture/Roughness Penalty (derived from color variance_score)
    # variance_score typical range [2.0, 10.0]
    # We map variance_score > 4.0 to a penalty up to 5 points
    if variance_score > 4.0:
        texture_penalty = min(5, int((variance_score - 4.0) * 0.8))
    else:
        texture_penalty = 0
        
    # Calculate score
    score = 100 - acne_penalty - dark_circles_penalty - pigmentation_penalty - texture_penalty
    
    # Ensure it's between 0 and 100
    score = max(0, min(100, score))
    
    return score
