from django.urls import reverse
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from analysis.models import UploadedImage, FaceAnalysis
from recommendations.models import Hairstyle, BeardStyle, EyewearStyle, RecommendationHistory
from recommendations.ai.recommendation_engine import calculate_match_score, generate_recommendations

class RecommendationEngineTest(TestCase):
    def setUp(self):
        # Create some test styles
        self.hairstyle = Hairstyle.objects.create(
            name="Pompadour",
            description="High volume style.",
            suitable_face_shapes=["Oval", "Square"],
            difficulty_level="Hard",
            maintenance_level="High",
            tags=["trendy"]
        )
        self.beard = BeardStyle.objects.create(
            name="Stubble",
            description="Short growth.",
            suitable_face_shapes=["Oval", "Diamond"],
            tags=["low_maintenance"]
        )
        self.eyewear = EyewearStyle.objects.create(
            name="Wayfarer",
            description="Retro frames.",
            suitable_face_shapes=["Oval"],
            tags=["casual"]
        )

    def test_calculate_match_score(self):
        # Top-ranked item in the list should get high score
        priority_list = ["Pompadour", "Quiff", "Slick Back"]
        score_first = calculate_match_score("Pompadour", priority_list, 1.0)
        self.assertEqual(score_first, 95)

        # Mid/low-ranked item should get slightly lower score
        score_last = calculate_match_score("Slick Back", priority_list, 1.0)
        self.assertEqual(score_last, 75)

        # Unlisted but suitable items should get default base score (70)
        score_unlisted = calculate_match_score("Buzz Cut", priority_list, 1.0)
        self.assertEqual(score_unlisted, 70)


class RecommendationAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="password123")
        self.client.force_authenticate(user=self.user)
        
        self.image = UploadedImage.objects.create(
            user=self.user,
            image="uploads/selfie.jpg",
            status="completed"
        )
        self.analysis = FaceAnalysis.objects.create(
            user=self.user,
            image=self.image,
            face_detected=True,
            total_faces=1,
            confidence=0.95,
            face_shape="Oval",
            face_shape_confidence=0.88,
            analysis_status="completed"
        )
        
        # Add some styles
        Hairstyle.objects.create(
            name="Pompadour",
            description="High volume.",
            suitable_face_shapes=["Oval"],
            tags=["trendy"]
        )

    def test_generate_recommendations_success(self):
        url = reverse('recommendation_generate')
        response = self.client.post(url, {"analysis_id": self.analysis.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("recommendations", response.data)
        self.assertEqual(response.data["recommendations"]["face_shape"], "Oval")
        self.assertTrue(len(response.data["recommendations"]["hairstyles"]) > 0)

    def test_get_recommendation_history(self):
        # Create recommendation history
        RecommendationHistory.objects.create(
            user=self.user,
            analysis=self.analysis,
            recommendations={"face_shape": "Oval", "hairstyles": []}
        )
        url = reverse('recommendation_history')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
