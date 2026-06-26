def find_best_product(product_list, keywords=None, category_fallback_list=None):
    """
    Helper function to scan a sorted list of products for matching keywords, 
    falling back to the first product in the list if no keyword match is found.
    """
    if not product_list:
        if category_fallback_list:
            return find_best_product(category_fallback_list, keywords)
        return None
        
    if not keywords:
        return product_list[0]
        
    for prod in product_list:
        name_desc = f"{prod['name']} {prod['description']}".lower()
        if any(kw.lower() in name_desc for kw in keywords):
            return prod
            
    # Fallback to the top-scoring product if keyword match is not found
    return product_list[0]


def generate_routines(recommended_products, skin_type, skin_tone, acne_detected, dark_circle_detected, pigmentation_detected):
    """
    Assembles Morning and Night skincare routines step-by-step.
    """
    face_washes = recommended_products.get('face_wash', [])
    moisturizers = recommended_products.get('moisturizers', [])
    sunscreens = recommended_products.get('sunscreens', [])
    serums = recommended_products.get('serums', [])
    acne_treatments = recommended_products.get('acne_treatment', [])
    eye_cares = recommended_products.get('dark_circle', [])

    # 1. MORNING ROUTINE
    morning_steps = []
    
    # Step 1: Cleanse
    clean_prod = find_best_product(face_washes)
    morning_steps.append({
        'step': 1,
        'title': 'Cleanse',
        'subtitle': 'Purify & Refresh',
        'product': clean_prod,
        'description': 'Wash away oils, dead skin, and impurities accumulated overnight to prepare your skin for active products.',
        'instructions': 'Splash face with lukewarm water, lather cleanser gently in circular motions for 30-60 seconds, then rinse and pat dry.'
    })
    
    # Step 2: Brighten / Antioxidant Serum (prefer Vitamin C or Niacinamide)
    vit_c_keywords = ['vitamin c', 'vit c', 'ascorbic', 'brightening', 'niacinamide']
    serum_prod = find_best_product(serums, vit_c_keywords)
    morning_steps.append({
        'step': 2,
        'title': 'Antioxidant Treatment',
        'subtitle': 'Brighten & Protect',
        'product': serum_prod,
        'description': 'Protect your skin against daily pollution, UV radiation, and free radicals while targeting uneven tone.',
        'instructions': 'Apply 3-4 drops to face and neck. Gently press into dry skin and allow it to absorb fully for 2 minutes.'
    })
    
    # Step 3: Hydrate
    # Prefer gel moisturizers for oily skin, cream for dry skin
    moist_prod = find_best_product(moisturizers)
    morning_steps.append({
        'step': 3,
        'title': 'Moisturize',
        'subtitle': 'Lock in Hydration',
        'product': moist_prod,
        'description': 'Reinforces the skin barrier and keeps the skin hydrated throughout the day.',
        'instructions': 'Apply a pea-sized amount onto fingers and sweep gently across the face and neck using upward strokes.'
    })
    
    # Step 4: Sunscreen (Protect)
    sun_prod = find_best_product(sunscreens)
    morning_steps.append({
        'step': 4,
        'title': 'Sun Protection',
        'subtitle': 'Shield UV Rays',
        'product': sun_prod,
        'description': 'Crucial step to prevent premature aging, hyperpigmentation, and sun damage.',
        'instructions': 'Apply generously (about two finger-lengths) to the face and neck. Reapply every 2-3 hours if outdoors.'
    })

    # 2. NIGHT ROUTINE
    night_steps = []
    
    # Step 1: Cleanse
    night_clean_prod = find_best_product(face_washes)
    night_steps.append({
        'step': 1,
        'title': 'Cleanse',
        'subtitle': 'Deep Clarify',
        'product': night_clean_prod,
        'description': 'Clears sunscreen, sebum, dirt, and pollution built up during the day.',
        'instructions': 'Use warm water to open pores, massage cleanser into skin, and rinse thoroughly. (Double cleanse if wearing makeup or heavy sunscreen).'
    })
    
    # Step 2: Target Treatment Serum
    # If acne detected, prefer spot treatment or salicylic acid
    # If pigmentation, prefer alpha arbutin or retinol
    # If dark circles, prefer caffeine eye cream
    # Otherwise general repair serum
    treatment_prod = None
    treatment_desc = ""
    treatment_instructions = ""
    treatment_title = "Active Treatment"
    treatment_subtitle = "Repair & Correct"
    
    if acne_detected:
        treatment_title = "Acne Target Treatment"
        treatment_subtitle = "Clear Breakouts"
        acne_keywords = ['salicylic', 'acne', 'spot', 'bha', 'benzoyl', 'clarifying']
        treatment_prod = find_best_product(acne_treatments, acne_keywords, serums)
        treatment_desc = 'Targets active acne breakouts, reduces inflammation, and unclogs pores to prevent future pimples.'
        treatment_instructions = 'Apply a thin layer to affected acne zones or apply directly as a spot treatment. Avoid eye area.'
    elif pigmentation_detected:
        treatment_title = "Pigmentation Treatment"
        treatment_subtitle = "Fade Dark Spots"
        pigment_keywords = ['retinol', 'arbutin', 'glycolic', 'aha', 'pigment', 'dark spot']
        treatment_prod = find_best_product(serums, pigment_keywords)
        treatment_desc = 'Promotes cellular turnover and inhibits melanin production to fade dark spots and even skin tone.'
        treatment_instructions = 'Apply 3-4 drops to clean, dry skin. Start 2-3 nights a week if using retinol, building tolerance slowly.'
    elif dark_circle_detected:
        treatment_title = "Eye Contour Care"
        treatment_subtitle = "Revitalize Eyes"
        eye_keywords = ['caffeine', 'retinol eye', 'eye repair', 'dark circle']
        treatment_prod = find_best_product(eye_cares, eye_keywords)
        treatment_desc = 'Reduces puffiness, stimulates circulation, and brightens the delicate under-eye area.'
        treatment_instructions = 'Dispense a tiny amount on ring finger and gently tap around the orbital bone. Do not pull skin.'
    else:
        treatment_prod = find_best_product(serums, ['hyaluronic', 'niacinamide', 'peptide'])
        treatment_desc = 'Rehydrates and repairs skin barrier functions during the body\'s natural overnight cell renewal cycle.'
        treatment_instructions = 'Apply 3-4 drops on damp face and massage gently in circular motions.'

    night_steps.append({
        'step': 2,
        'title': treatment_title,
        'subtitle': treatment_subtitle,
        'product': treatment_prod,
        'description': treatment_desc,
        'instructions': treatment_instructions
    })
    
    # Step 3: Repair Moisturizer / Night Cream
    # Prefer products indicating "night" or "barrier repair" or "rich"
    night_moist_keywords = ['night', 'barrier', 'repair', 'sleeping mask', 'rich', 'ceramide']
    night_moist_prod = find_best_product(moisturizers, night_moist_keywords)
    night_steps.append({
        'step': 3,
        'title': 'Nourish & Lock',
        'subtitle': 'Deep Recovery',
        'product': night_moist_prod,
        'description': 'Locks in hydration and treatments, ensuring deep nourishment while you sleep.',
        'instructions': 'Apply a slightly thicker layer than in the morning. Pat gently over face and neck as the final skincare step.'
    })

    return {
        'morning': morning_steps,
        'night': night_steps
    }
