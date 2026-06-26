import logging
from django.db.models import Q
from ..models import BeautyProduct, RecommendationRule, ProductCategory
from ..serializers import BeautyProductSerializer

logger = logging.getLogger('products')

def calculate_match_score(product, skin_type, skin_tone, acne_detected, acne_severity, dark_circle_detected, pigmentation_detected, rules=None):
    """
    Calculates a match score from 0 to 100 for a beauty product based on user skin parameters.
    Formula:
      - Skin Type Match = 40 Points
      - Skin Tone Match = 20 Points
      - Concern Match = 30 Points
      - Rating Bonus = 10 Points
    """
    score = 0
    
    # 1. Skin Type Match (40 Points)
    # If the product is suitable for the user's skin type, award 40 points.
    if skin_type in product.suitable_skin_types:
        score += 40
    else:
        # Check if the product suits 'All' or is a general product
        if 'All' in product.suitable_skin_types or not product.suitable_skin_types:
            score += 30  # Partial points for general suitability
        else:
            score += 5   # Minimal points for mismatch
            
    # 2. Skin Tone Match (20 Points)
    if skin_tone in product.suitable_skin_tones:
        score += 20
    else:
        if 'All' in product.suitable_skin_tones or not product.suitable_skin_tones:
            score += 15  # Partial points for general suitability
        else:
            score += 5

    # 3. Concern Match (30 Points)
    has_concerns = acne_detected or dark_circle_detected or pigmentation_detected
    
    if not has_concerns:
        # If user has no specific concerns, standard gentle/maintenance products get full concern score
        if product.sensitive_skin_safe or product.fragrance_free or (not product.acne_friendly and not product.pigmentation_friendly and not product.dark_circle_friendly):
            score += 30
        else:
            score += 15
    else:
        # User has concerns. Check if product helps with the specific detected concerns.
        concern_matched = False
        
        if acne_detected and product.acne_friendly:
            concern_matched = True
        if pigmentation_detected and product.pigmentation_friendly:
            concern_matched = True
        if dark_circle_detected and product.dark_circle_friendly:
            concern_matched = True
            
        if concern_matched:
            score += 30
        else:
            # If it doesn't target their concern, but is a safe daily staple, give partial points
            if product.sensitive_skin_safe or product.fragrance_free:
                score += 15
            else:
                score += 5

    # 4. Rating Bonus (10 Points)
    # rating is usually out of 5.0. scale it to 10 points.
    rating_val = product.rating or 4.0
    score += min(10.0, rating_val * 2.0)

    # 5. Avoid Rules (Hardcoded safety overrides)
    desc_lower = product.description.lower()
    name_lower = product.name.lower()

    # Oily Skin: Avoid Heavy Cream Moisturizers
    if skin_type == 'Oily' and product.category.name.lower() in ['moisturizer', 'night cream']:
        heavy_keywords = ['heavy cream', 'rich cream', 'thick cream', 'ultra rich', 'intense hydration cream', 'dry skin cream']
        if any(kw in desc_lower or kw in name_lower for kw in heavy_keywords):
            score -= 50  # Apply heavy penalty

    # Acne Detected: Avoid Heavy Oil Products
    if acne_detected:
        oil_keywords = ['heavy oil', 'facial oil', 'marula oil', 'coconut oil', 'rich butter', 'pore clogging', 'high oil']
        if any(kw in desc_lower or kw in name_lower for kw in oil_keywords):
            score -= 50  # Apply heavy penalty

    # 6. Apply Dynamic Recommendation Rules from Admin Panel
    if rules:
        for rule in rules:
            # Check if rule matches user skin type
            if rule.skin_type != 'All' and rule.skin_type != skin_type:
                continue
            
            # Check if rule matches concern
            if rule.concern != 'All':
                if rule.concern == 'Acne' and not acne_detected:
                    continue
                if rule.concern == 'Pigmentation' and not pigmentation_detected:
                    continue
                if rule.concern == 'Dark Circles' and not dark_circle_detected:
                    continue
                if rule.concern == 'None' and has_concerns:
                    continue

            # Check if rule targets this category
            if rule.target_category and product.category_id != rule.target_category_id:
                continue
            
            # Check keyword match
            if rule.keyword:
                kw = rule.keyword.lower()
                if kw not in name_lower and kw not in desc_lower:
                    continue
            
            # Rule matches, apply modifier
            score += rule.score_modifier

    # Cap score between 0 and 100
    final_score = max(0, min(100, int(score)))
    return final_score


def generate_product_recommendations(skin_type, skin_tone, acne_detected, acne_severity, dark_circle_detected, pigmentation_detected, rules=None, request=None):
    """
    Queries all active products, runs the matching scoring engine, 
    and groups products by category name in lowercase with match scores.
    """
    # Fetch active products with categories pre-fetched
    products = BeautyProduct.objects.filter(active=True).select_related('category')
    
    # Fetch rules if not passed
    if rules is None:
        rules = RecommendationRule.objects.filter(active=True).select_related('target_category')

    categorized_recommendations = {
        'face_wash': [],
        'moisturizers': [],
        'sunscreens': [],
        'serums': [],
        'acne_treatment': [],
        'dark_circle': [],
    }

    # Map category names in DB to our output keys
    category_mapping = {
        'face wash': 'face_wash',
        'moisturizer': 'moisturizers',
        'sunscreen': 'sunscreens',
        'serum': 'serums',
        'acne treatment': 'acne_treatment',
        'eye care': 'dark_circle',
    }

    serializer_context = {'request': request}

    for product in products:
        score = calculate_match_score(
            product,
            skin_type,
            skin_tone,
            acne_detected,
            acne_severity,
            dark_circle_detected,
            pigmentation_detected,
            rules
        )
        
        # Determine output category key
        db_cat_name = product.category.name.lower().strip()
        out_key = category_mapping.get(db_cat_name)
        
        if not out_key:
            # Fallback fuzzy matching
            if 'wash' in db_cat_name or 'cleanser' in db_cat_name:
                out_key = 'face_wash'
            elif 'moisturizer' in db_cat_name or 'cream' in db_cat_name:
                out_key = 'moisturizers'
            elif 'sunscreen' in db_cat_name or 'spf' in db_cat_name:
                out_key = 'sunscreens'
            elif 'serum' in db_cat_name:
                out_key = 'serums'
            elif 'acne' in db_cat_name or 'spot' in db_cat_name:
                out_key = 'acne_treatment'
            elif 'eye' in db_cat_name or 'dark circle' in db_cat_name:
                out_key = 'dark_circle'
            else:
                out_key = 'serums' # Catch-all fallback
        
        # Serialize product details
        product_data = BeautyProductSerializer(product, context=serializer_context).data
        product_data['match_score'] = score
        
        categorized_recommendations[out_key].append(product_data)

    # Sort each category list by match_score in descending order
    for key in categorized_recommendations:
        categorized_recommendations[key] = sorted(
            categorized_recommendations[key],
            key=lambda x: x['match_score'],
            reverse=True
        )

    return categorized_recommendations
