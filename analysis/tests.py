import io
import os
from PIL import Image
from django.urls import reverse
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from .models import UploadedImage

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
