from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from analysis.models import FaceAnalysis, UploadedImage
from products.models import ProductCategory, BeautyProduct, RecommendationHistory, RecommendationRule
from products.ai.recommendation_engine import calculate_match_score, generate_product_recommendations
from products.ai.routine_generator import generate_routines


class RecommendationEngineTestCase(TestCase):
    def setUp(self):
        # Create categories
        self.face_wash_cat = ProductCategory.objects.create(name="Face Wash", description="Face cleansers")
        self.moisturizer_cat = ProductCategory.objects.create(name="Moisturizer", description="Moisturizers")

        # Create products
        self.gel_moisturizer = BeautyProduct.objects.create(
            name="Hydro Boost Water Gel",
            brand="Neutrogena",
            category=self.moisturizer_cat,
            description="A lightweight gel moisturizer suitable for oily skin.",
            suitable_skin_types=["Oily", "Combination"],
            suitable_skin_tones=["Fair", "Light", "Medium"],
            acne_friendly=True,
            pigmentation_friendly=False,
            dark_circle_friendly=False,
            sensitive_skin_safe=True,
            fragrance_free=True,
            price_range="Midrange",
            rating=4.5,
            active=True
        )

        self.heavy_moisturizer = BeautyProduct.objects.create(
            name="Moisturizing Rich Cream",
            brand="HeavyBrand",
            category=self.moisturizer_cat,
            description="A rich heavy cream moisturizer for dry skin.",
            suitable_skin_types=["Dry"],
            suitable_skin_tones=["Medium", "Tan", "Deep"],
            acne_friendly=False,
            pigmentation_friendly=False,
            dark_circle_friendly=False,
            sensitive_skin_safe=False,
            fragrance_free=False,
            price_range="Premium",
            rating=4.0,
            active=True
        )

    def test_oily_skin_gel_score(self):
        # Oily skin, medium tone, acne detected
        score = calculate_match_score(
            product=self.gel_moisturizer,
            skin_type="Oily",
            skin_tone="Medium",
            acne_detected=True,
            acne_severity="Moderate",
            dark_circle_detected=False,
            pigmentation_detected=False
        )
        
        # Skin type matches Oily (+40)
        # Skin tone matches Medium (+20)
        # Concern matches Acne (product is acne_friendly: True) (+30)
        # Rating is 4.5 -> bonus is 4.5 * 2 = 9 (+9)
        # Total score should be 40 + 20 + 30 + 9 = 99
        self.assertEqual(score, 99)

    def test_oily_skin_heavy_cream_penalty(self):
        # Oily skin should trigger a -50 penalty for moisturizers containing "heavy cream" or "rich cream" in description/name
        score = calculate_match_score(
            product=self.heavy_moisturizer,
            skin_type="Oily",
            skin_tone="Medium",
            acne_detected=False,
            acne_severity="None",
            dark_circle_detected=False,
            pigmentation_detected=False
        )
        
        # Skin type doesn't match: +5
        # Skin tone matches Medium: +20
        # No concerns, but product is not sensitive skin safe or fragrance free: +15
        # Rating 4.0: +8
        # Penalty for heavy cream on oily skin: -50
        # Total before penalty: 5 + 20 + 30 + 8 = 63
        # Total after penalty: 63 - 50 = 13
        self.assertEqual(score, 13)


class ProductAPITestCase(APITestCase):
    def setUp(self):
        # User
        self.user = User.objects.create_user(username="testuser", password="testpassword")
        self.client.force_authenticate(user=self.user)

        # UploadedImage
        self.image = UploadedImage.objects.create(
            user=self.user,
            image="test.jpg",
            status="completed"
        )

        # FaceAnalysis
        self.analysis = FaceAnalysis.objects.create(
            user=self.user,
            image=self.image,
            face_detected=True,
            total_faces=1,
            skin_type="Oily",
            skin_tone="Medium",
            acne_detected=True,
            acne_severity="Moderate",
            dark_circle_detected=False,
            pigmentation_detected=False,
            skin_health_score=75,
            analysis_status="completed"
        )

        # Categories
        self.face_wash_cat = ProductCategory.objects.create(name="Face Wash", description="Cleansers")
        self.moisturizer_cat = ProductCategory.objects.create(name="Moisturizer", description="Moisturizers")
        self.sunscreen_cat = ProductCategory.objects.create(name="Sunscreen", description="SPFs")
        self.serum_cat = ProductCategory.objects.create(name="Serum", description="Active serums")

        # Products
        self.cleanser = BeautyProduct.objects.create(
            name="Foaming Cleanser", brand="CeraVe", category=self.face_wash_cat,
            suitable_skin_types=["Oily"], suitable_skin_tones=["Medium"], active=True
        )
        self.moisturizer = BeautyProduct.objects.create(
            name="Hydro Boost", brand="Neutrogena", category=self.moisturizer_cat,
            suitable_skin_types=["Oily"], suitable_skin_tones=["Medium"], active=True
        )
        self.sunscreen = BeautyProduct.objects.create(
            name="Anthelios", brand="La Roche-Posay", category=self.sunscreen_cat,
            suitable_skin_types=["Oily"], suitable_skin_tones=["Medium"], active=True
        )
        self.serum = BeautyProduct.objects.create(
            name="Niacinamide Serum", brand="The Ordinary", category=self.serum_cat,
            suitable_skin_types=["Oily"], suitable_skin_tones=["Medium"], active=True
        )

    def test_recommend_endpoint_success(self):
        url = reverse('product_recommend')
        data = {"analysis_id": self.analysis.id}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("recommended_products", response.data)
        self.assertIn("morning_routine", response.data)
        self.assertIn("night_routine", response.data)
        self.assertEqual(response.data["skin_type"], "Oily")

        # Verify recommendation history created
        self.assertEqual(RecommendationHistory.objects.filter(user=self.user).count(), 1)

    def test_recommend_endpoint_unauthorized_analysis(self):
        # Create analysis for another user
        other_user = User.objects.create_user(username="otheruser", password="testpassword")
        other_analysis = FaceAnalysis.objects.create(
            user=other_user,
            image=self.image,
            face_detected=True,
            skin_type="Oily",
            skin_tone="Medium",
            analysis_status="completed"
        )
        
        url = reverse('product_recommend')
        data = {"analysis_id": other_analysis.id}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_history_list_endpoint(self):
        # Generate a recommendation history first
        recommended_products = generate_product_recommendations("Oily", "Medium", True, "Moderate", False, False)
        routines = generate_routines(recommended_products, "Oily", "Medium", True, False, False)
        
        RecommendationHistory.objects.create(
            user=self.user,
            analysis=self.analysis,
            recommendations_json={
                "skin_type": "Oily",
                "recommended_products": recommended_products,
                "morning_routine": routines["morning"],
                "night_routine": routines["night"]
            }
        )

        url = reverse('product_recommendation_history')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertIn("recommendations_json", response.data[0])

    def test_history_detail_endpoint(self):
        # Generate a recommendation history first
        recommended_products = generate_product_recommendations("Oily", "Medium", True, "Moderate", False, False)
        routines = generate_routines(recommended_products, "Oily", "Medium", True, False, False)
        
        history = RecommendationHistory.objects.create(
            user=self.user,
            analysis=self.analysis,
            recommendations_json={
                "skin_type": "Oily",
                "recommended_products": recommended_products,
                "morning_routine": routines["morning"],
                "night_routine": routines["night"]
            }
        )

        url = reverse('product_recommendation_detail', kwargs={"pk": history.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], history.id)
        # Check flat fields merge
        self.assertEqual(response.data["skin_type"], "Oily")
        self.assertIn("recommended_products", response.data)
