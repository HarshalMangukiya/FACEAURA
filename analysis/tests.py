import io
import os
from PIL import Image
from unittest.mock import patch
from django.urls import reverse
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from .models import UploadedImage, FaceAnalysis

class ImageUploadTests(APITestCase):

    def setUp(self):
        # Create users
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="password123")
        self.other_user = User.objects.create_user(username="otheruser", email="other@example.com", password="password123")
        
        # URL paths
        self.upload_url = reverse('image-upload')
        self.list_url = reverse('image-list')
        
        # Get tokens
        token_url = reverse('token_obtain_pair')
        
        response = self.client.post(token_url, {"username": "testuser", "password": "password123"}, format='json')
        self.token = response.data['access']
        
        response = self.client.post(token_url, {"username": "otheruser", "password": "password123"}, format='json')
        self.other_token = response.data['access']

    def generate_image_file(self, filename="selfie.png", size=(100, 100), color="blue", format="PNG"):
        file_obj = io.BytesIO()
        image = Image.new("RGB", size, color)
        image.save(file_obj, format=format)
        file_obj.seek(0)
        content_type = f"image/{format.lower()}"
        if format.lower() == "jpg" or format.lower() == "jpeg":
            content_type = "image/jpeg"
        return SimpleUploadedFile(filename, file_obj.read(), content_type=content_type)

    def test_upload_image_success(self):
        """Test uploading a valid png image succeeds"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        image = self.generate_image_file("selfie.png", format="PNG")
        response = self.client.post(self.upload_url, {"image": image}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("message", response.data)
        self.assertEqual(response.data["message"], "Image uploaded successfully")
        self.assertIn("image_id", response.data)
        self.assertIn("image_url", response.data)
        
        # Verify it exists in db
        self.assertTrue(UploadedImage.objects.filter(id=response.data["image_id"], user=self.user).exists())

    def test_upload_image_unauthorized(self):
        """Test upload is rejected without token"""
        image = self.generate_image_file("selfie.png", format="PNG")
        response = self.client.post(self.upload_url, {"image": image}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_upload_image_invalid_type(self):
        """Test upload is rejected for non-image/unsupported files"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        # PDF or txt file
        text_file = SimpleUploadedFile("selfie.txt", b"not-an-image", content_type="text/plain")
        response = self.client.post(self.upload_url, {"image": text_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_upload_image_too_large(self):
        """Test upload is rejected if file size is > 5MB"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        # Generate a large fake content
        large_content = b"0" * (5 * 1024 * 1024 + 100) # > 5MB
        large_file = SimpleUploadedFile("selfie.png", large_content, content_type="image/png")
        response = self.client.post(self.upload_url, {"image": large_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_list_user_images(self):
        """Test retrieving all uploaded images of the authenticated user"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        # Upload 2 images
        img1 = self.generate_image_file("selfie1.jpg", format="JPEG")
        img2 = self.generate_image_file("selfie2.png", format="PNG")
        self.client.post(self.upload_url, {"image": img1}, format='multipart')
        self.client.post(self.upload_url, {"image": img2}, format='multipart')
        
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["status"], "uploaded")
        self.assertIn("image", response.data[0])

    def test_get_image_detail_success(self):
        """Test retrieving details of user's own image"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        img = self.generate_image_file("selfie.jpg", format="JPEG")
        upload_resp = self.client.post(self.upload_url, {"image": img}, format='multipart')
        image_id = upload_resp.data["image_id"]
        
        detail_url = reverse('image-detail-delete', kwargs={'pk': image_id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], image_id)

    def test_get_image_detail_other_user(self):
        """Test that user cannot retrieve another user's image (returns 404)"""
        # Testuser uploads an image
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        img = self.generate_image_file("selfie.jpg", format="JPEG")
        upload_resp = self.client.post(self.upload_url, {"image": img}, format='multipart')
        image_id = upload_resp.data["image_id"]
        
        # Otheruser tries to fetch details
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        detail_url = reverse('image-detail-delete', kwargs={'pk': image_id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_image_success(self):
        """Test deleting own image successfully deletes DB entry and filesystem file"""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        img = self.generate_image_file("selfie.jpg", format="JPEG")
        upload_resp = self.client.post(self.upload_url, {"image": img}, format='multipart')
        image_id = upload_resp.data["image_id"]
        
        # Verify db item exists
        db_item = UploadedImage.objects.get(id=image_id)
        file_path = db_item.image.path
        self.assertTrue(os.path.exists(file_path))
        
        # Delete image
        detail_url = reverse('image-detail-delete', kwargs={'pk': image_id})
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Image deleted")
        
        # Verify db item is gone
        self.assertFalse(UploadedImage.objects.filter(id=image_id).exists())
        
        # Verify file is deleted from media directory
        self.assertFalse(os.path.exists(file_path))


class SkinAnalysisTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="skinuser", email="skin@example.com", password="password123")
        
        # Get tokens
        token_url = reverse('token_obtain_pair')
        response = self.client.post(token_url, {"username": "skinuser", "password": "password123"}, format='json')
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        
        # Create a dummy image
        file_obj = io.BytesIO()
        image = Image.new("RGB", (100, 100), "blue")
        image.save(file_obj, format="JPEG")
        file_obj.seek(0)
        uploaded_file = SimpleUploadedFile("selfie_skin.jpg", file_obj.read(), content_type="image/jpeg")
        
        self.uploaded_image = UploadedImage.objects.create(
            user=self.user,
            image=uploaded_file,
            status='completed'
        )
        
        # Create landmark list with 468 fake points
        fake_landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(468)]
        
        self.analysis = FaceAnalysis.objects.create(
            user=self.user,
            image=self.uploaded_image,
            face_detected=True,
            total_faces=1,
            confidence=0.95,
            landmarks=fake_landmarks,
            analysis_status='completed'
        )
        
        self.skin_url = reverse('skin-analysis')
        
    def result_url(self, pk):
        return reverse('skin-analysis-result', kwargs={'pk': pk})

    @patch('analysis.views.detect_skin_tone')
    @patch('analysis.views.detect_skin_type')
    @patch('analysis.views.detect_acne')
    @patch('analysis.views.detect_dark_circles')
    @patch('analysis.views.detect_pigmentation')
    @patch('analysis.views.draw_skin_analysis')
    def test_skin_analysis_post_success(self, mock_draw, mock_pigmentation, mock_dark_circles, mock_acne, mock_skin_type, mock_skin_tone):
        mock_skin_tone.return_value = {
            "skin_tone": "Medium", 
            "confidence": 0.91, 
            "average_bgr": [100, 120, 150], 
            "rois": [[10, 10, 20, 20], [30, 30, 40, 40], [50, 50, 60, 60]]
        }
        mock_skin_type.return_value = {
            "skin_type": "Oily", 
            "confidence": 0.88,
            "t_zone_shine": 0.15,
            "u_zone_shine": 0.13
        }
        mock_acne.return_value = {
            "acne_detected": True, 
            "severity": "Moderate", 
            "acne_spots": [{"center": (50, 50), "radius": 5}]
        }
        mock_dark_circles.return_value = {
            "dark_circle_detected": False, 
            "eye_brightness": 70.0, 
            "cheek_brightness": 72.0, 
            "rois": [[10, 10, 20, 20], [30, 30, 40, 40]]
        }
        mock_pigmentation.return_value = {
            "pigmentation_detected": False, 
            "variance_score": 7.75
        }
        mock_draw.return_value = "/media/debug/skin_analysis_1.jpg"
        
        response = self.client.post(self.skin_url, {"image_id": self.uploaded_image.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["skin_tone"], "Medium")
        self.assertEqual(response.data["skin_type"], "Oily")
        self.assertTrue(response.data["acne_detected"])
        self.assertEqual(response.data["acne_severity"], "Moderate")
        self.assertFalse(response.data["dark_circle_detected"])
        self.assertFalse(response.data["pigmentation_detected"])
        self.assertEqual(response.data["skin_health_score"], 82) # 100 - 15 - 3 = 82
        
        # Verify database record updated
        self.analysis.refresh_from_db()
        self.assertEqual(self.analysis.skin_tone, "Medium")
        self.assertEqual(self.analysis.skin_type, "Oily")
        self.assertEqual(self.analysis.skin_health_score, 82)

    def test_skin_analysis_result_get_success(self):
        # Prep database with predefined skin metrics
        self.analysis.skin_tone = "Light"
        self.analysis.skin_type = "Dry"
        self.analysis.acne_detected = False
        self.analysis.acne_severity = "None"
        self.analysis.dark_circle_detected = True
        self.analysis.pigmentation_detected = True
        self.analysis.skin_health_score = 77
        self.analysis.save()
        
        url = self.result_url(self.analysis.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["skin_tone"], "Light")
        self.assertEqual(response.data["skin_type"], "Dry")
        self.assertFalse(response.data["acne_detected"])
        self.assertTrue(response.data["dark_circle_detected"])
        self.assertTrue(response.data["pigmentation_detected"])
        self.assertEqual(response.data["skin_health_score"], 77)

    def test_skin_score_calculator_logic(self):
        from .ai.skin_score_calculator import calculate_skin_health_score
        # All clear
        score = calculate_skin_health_score("None", False, False, 2.0)
        self.assertEqual(score, 100)
        
        # Moderate Acne
        score = calculate_skin_health_score("Moderate", False, False, 3.0)
        self.assertEqual(score, 85)
        
        # Severe Acne + Dark Circles + Pigmentation + rough texture
        score = calculate_skin_health_score("Severe", True, True, 9.0)
        # Severe: 35, Dark circles: 8, Pigmentation: 10, Texture: (9-4)*0.8 = 4 (rounded down)
        # Total penalty = 35 + 8 + 10 + 4 = 57. Score = 100 - 57 = 43.
        self.assertEqual(score, 43)


class VirtualTryOnTests(APITestCase):

    def setUp(self):
        # Create user
        self.user = User.objects.create_user(username="tryonuser", email="tryon@example.com", password="password123")
        
        # Get token
        token_url = reverse('token_obtain_pair')
        response = self.client.post(token_url, {"username": "tryonuser", "password": "password123"}, format='json')
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

        # Generate a mock selfie image
        selfie_file = self.generate_png_file("selfie.png", (200, 200), (255, 255, 255, 255))
        self.uploaded_image = UploadedImage.objects.create(
            user=self.user,
            image=selfie_file,
            status='completed'
        )

        # Create landmarks with some actual geometry to avoid division by zero or errors
        # Left eye (159), Right eye (386), Nose bridge (168), Forehead top (10), Chin (152),
        # Cheekbone left (234), Cheekbone right (454), Jaw left (172), Jaw right (397)
        self.fake_landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(468)]
        # Adjust some landmarks to simulate a proper face
        self.fake_landmarks[159] = {"x": 0.45, "y": 0.45, "z": 0.0} # left eye
        self.fake_landmarks[386] = {"x": 0.55, "y": 0.45, "z": 0.0} # right eye
        self.fake_landmarks[168] = {"x": 0.5, "y": 0.48, "z": 0.0}  # nose bridge
        self.fake_landmarks[10] = {"x": 0.5, "y": 0.35, "z": 0.0}   # forehead top
        self.fake_landmarks[152] = {"x": 0.5, "y": 0.7, "z": 0.0}   # chin
        self.fake_landmarks[234] = {"x": 0.4, "y": 0.5, "z": 0.0}   # cheekbone left
        self.fake_landmarks[454] = {"x": 0.6, "y": 0.5, "z": 0.0}   # cheekbone right
        self.fake_landmarks[172] = {"x": 0.42, "y": 0.65, "z": 0.0} # jaw left
        self.fake_landmarks[397] = {"x": 0.58, "y": 0.65, "z": 0.0} # jaw right

        self.analysis = FaceAnalysis.objects.create(
            user=self.user,
            image=self.uploaded_image,
            face_detected=True,
            total_faces=1,
            confidence=0.98,
            landmarks=self.fake_landmarks,
            analysis_status='completed'
        )

        # Create overlay assets with PNG content
        hs_img = self.generate_png_file("hair.png", (100, 100), (0, 0, 0, 255))
        beard_img = self.generate_png_file("beard.png", (100, 100), (50, 50, 50, 255))
        glasses_img = self.generate_png_file("glasses.png", (100, 50), (10, 10, 10, 255))

        from .models import HairStyleAsset, BeardAsset, GlassesAsset, TryOnHistory
        self.hairstyle = HairStyleAsset.objects.create(
            name="Test Hairstyle",
            face_shape="Oval",
            gender="Male",
            length="Short",
            style="Casual",
            image=hs_img,
            active=True
        )

        self.beard = BeardAsset.objects.create(
            name="Test Beard",
            image=beard_img,
            active=True
        )

        self.glasses = GlassesAsset.objects.create(
            name="Test Glasses",
            image=glasses_img,
            active=True
        )

        # URLs
        self.hs_list_url = reverse('tryon-assets-hairstyles')
        self.beard_list_url = reverse('tryon-assets-beards')
        self.glasses_list_url = reverse('tryon-assets-glasses')
        self.execute_url = reverse('tryon-execute-image')
        self.history_url = reverse('tryon-history')

    def generate_png_file(self, filename, size, color):
        file_obj = io.BytesIO()
        image = Image.new("RGBA", size, color)
        image.save(file_obj, format="PNG")
        file_obj.seek(0)
        return SimpleUploadedFile(filename, file_obj.read(), content_type="image/png")

    def test_face_alignment_calculations(self):
        """Test the face alignment utility directly"""
        from .virtual_tryon.alignment.face_alignment import align_face
        metrics = align_face(self.fake_landmarks, 200, 200)
        
        self.assertEqual(metrics['face_center'], (100, 96))
        self.assertEqual(metrics['forehead_top'], (100, 70))
        self.assertEqual(metrics['chin_base'], (100, 140))
        self.assertAlmostEqual(metrics['rotation_angle'], 0.0)
        self.assertEqual(metrics['eye_distance'], 20.0)
        self.assertEqual(metrics['face_width'], 40.0)
        self.assertEqual(metrics['jaw_width'], 32.0)

    def test_list_assets_api(self):
        """Test retrieving hairstyles, beards, and glasses"""
        # 1. Hairstyles
        response = self.client.get(self.hs_list_url, {"face_shape": "Oval", "gender": "Male"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Test Hairstyle")

        # 2. Beards
        response = self.client.get(self.beard_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Test Beard")

        # 3. Glasses
        response = self.client.get(self.glasses_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Test Glasses")

    def test_execute_try_on_success(self):
        """Test triggering virtual try-on overlay on a static image succeeds"""
        payload = {
            "image_id": self.uploaded_image.id,
            "hairstyle_id": self.hairstyle.id,
            "beard_id": self.beard.id,
            "glasses_id": self.glasses.id,
            "hair_color": "golden"
        }
        response = self.client.post(self.execute_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("generated_image_url", response.data)
        self.assertEqual(response.data["selected_color"], "golden")
        self.assertEqual(response.data["hairstyle_details"]["id"], self.hairstyle.id)
        
        # Verify it created a TryOnHistory entry
        from .models import TryOnHistory
        self.assertTrue(TryOnHistory.objects.filter(user=self.user, selected_color="golden").exists())

    def test_execute_try_on_invalid_image(self):
        """Test requesting try-on for an image without landmarks or missing"""
        payload = {
            "image_id": 99999, # invalid
            "hairstyle_id": self.hairstyle.id
        }
        response = self.client.post(self.execute_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_and_delete_history(self):
        """Test retrieving try-on look history and deleting bookmarks"""
        # Create a history entry manually
        from .models import TryOnHistory
        history_item = TryOnHistory.objects.create(
            user=self.user,
            original_image=self.uploaded_image,
            selected_hairstyle=self.hairstyle,
            selected_color="purple",
            generated_image="tryon_results/test_out.jpg"
        )
        
        # Get history list
        response = self.client.get(self.history_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['selected_color'], "purple")

        # Get detail
        detail_url = reverse('tryon-history-detail', kwargs={'pk': history_item.id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], history_item.id)

        # Delete entry
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(TryOnHistory.objects.filter(id=history_item.id).exists())


