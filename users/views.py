from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from .serializers import RegisterSerializer, UserSerializer

class RegisterView(APIView):
    """
    API View to handle user registration.
    Endpoint: POST /api/users/register/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "User Created Successfully"
            }, status=status.HTTP_201_CREATED)
        
        # Handle field-specific and custom validation errors (duplicate, missing)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    """
    API View to retrieve the current logged-in user profile.
    Endpoint: GET /api/users/profile/
    Authorization: Bearer Token Required
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    API View structure for logout.
    Endpoint: POST /api/users/logout/
    Authorization: Bearer Token Required
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Structure ready for future token blacklisting implementation.
        Currently returns success message.
        """
        # Future: Blacklist refresh token
        # try:
        #     refresh_token = request.data.get("refresh")
        #     token = RefreshToken(refresh_token)
        #     token.blacklist()
        #     return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)
        # except Exception as e:
        #     return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "message": "Logout successful (Structure ready for token blacklisting)"
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """
    API Root View that welcomes users and describes available endpoints.
    Endpoint: GET /
    """
    return Response({
        "name": "FaceAura API",
        "description": "AI-powered beauty and hairstyle recommendation platform backend",
        "endpoints": {
            "registration": "/api/users/register/",
            "login": "/api/token/",
            "token_refresh": "/api/token/refresh/",
            "user_profile": "/api/users/profile/",
            "logout": "/api/users/logout/"
        }
    }, status=status.HTTP_200_OK)