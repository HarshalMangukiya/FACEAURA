from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

class AuthenticationTests(APITestCase):

    def setUp(self):
        # Create a test user for login and duplicate checks
        self.existing_username = "existinguser"
        self.existing_email = "existing@example.com"
        self.existing_password = "password123"
        self.user = User.objects.create_user(
            username=self.existing_username,
            email=self.existing_email,
            password=self.existing_password
        )
        self.register_url = reverse('register')
        self.profile_url = reverse('profile')
        self.token_obtain_url = reverse('token_obtain_pair')
        self.logout_url = reverse('logout')

    def test_registration_success(self):
        """Test successful registration with valid inputs"""
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpassword123"
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], "User Created Successfully")
        
        # Verify user actually exists and password is encrypted
        user_exists = User.objects.filter(username="newuser").exists()
        self.assertTrue(user_exists)
        user = User.objects.get(username="newuser")
        self.assertTrue(user.check_password("newpassword123"))

    def test_registration_missing_fields(self):
        """Test registration errors when fields are missing"""
        data = {
            "username": "",
            "email": "newuser@example.com"
            # password and username missing/empty
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)
        self.assertIn("password", response.data)

    def test_registration_duplicate_username(self):
        """Test registration error when username already exists"""
        data = {
            "username": self.existing_username,
            "email": "another@example.com",
            "password": "password123"
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)
        self.assertEqual(response.data["username"][0], "A user with that username already exists.")

    def test_registration_duplicate_email(self):
        """Test registration error when email already exists"""
        data = {
            "username": "newuniqueuser",
            "email": self.existing_email,
            "password": "password123"
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertEqual(response.data["email"][0], "A user with that email already exists.")

    def test_jwt_login_success(self):
        """Test successful login returns access and refresh tokens"""
        data = {
            "username": self.existing_username,
            "password": self.existing_password
        }
        response = self.client.post(self.token_obtain_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_jwt_login_invalid_credentials(self):
        """Test login with incorrect password or username"""
        data = {
            "username": self.existing_username,
            "password": "wrongpassword"
        }
        response = self.client.post(self.token_obtain_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.data)

    def test_profile_lookup_authorized(self):
        """Test profile access with a valid JWT token"""
        # First login to get token
        login_data = {
            "username": self.existing_username,
            "password": self.existing_password
        }
        login_response = self.client.post(self.token_obtain_url, login_data, format='json')
        access_token = login_response.data["access"]

        # Request profile with token in headers
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.user.id)
        self.assertEqual(response.data["username"], self.existing_username)
        self.assertEqual(response.data["email"], self.existing_email)

    def test_profile_lookup_unauthorized(self):
        """Test profile access is blocked without authorization"""
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout(self):
        """Test logout returns the expected future implementation message"""
        # Set authenticated credential
        login_data = {
            "username": self.existing_username,
            "password": self.existing_password
        }
        login_response = self.client.post(self.token_obtain_url, login_data, format='json')
        access_token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        response = self.client.post(self.logout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(
            response.data["message"],
            "Logout successful (Structure ready for token blacklisting)"
        )
