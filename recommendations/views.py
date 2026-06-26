from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from analysis.models import FaceAnalysis
from .models import RecommendationHistory
from .serializers import RecommendationHistorySerializer
from .ai.recommendation_engine import generate_recommendations

class RecommendationGenerateView(APIView):
    """
    API View to generate style recommendations based on a FaceAnalysis shape.
    Endpoint: POST /api/recommendations/generate/
    Authorization: Bearer Token Required
    Request Body: {"analysis_id": 1}
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        analysis_id = request.data.get('analysis_id')
        if not analysis_id:
            return Response(
                {"error": "analysis_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Retrieve FaceAnalysis object and verify it belongs to user
        try:
            analysis = FaceAnalysis.objects.get(pk=analysis_id)
            if analysis.user != request.user:
                return Response(
                    {"error": "Analysis record not found or unauthorized."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except FaceAnalysis.DoesNotExist:
            return Response(
                {"error": "Analysis record not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if face shape has been detected
        if not analysis.face_shape:
            return Response(
                {"error": "Face shape analysis has not been completed on this scan. Please analyze the face shape first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate recommendation dict using the AI engine
        try:
            recommendation_data = generate_recommendations(
                face_shape=analysis.face_shape,
                face_shape_confidence=analysis.face_shape_confidence,
                request=request
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to generate recommendations: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Create or update history log
        history_item = RecommendationHistory.objects.create(
            user=request.user,
            analysis=analysis,
            recommendations=recommendation_data
        )

        serializer = RecommendationHistorySerializer(history_item, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RecommendationHistoryView(APIView):
    """
    API View to list all previous recommendations generated for the authenticated user.
    Endpoint: GET /api/recommendations/history/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        history = RecommendationHistory.objects.filter(user=request.user)
        serializer = RecommendationHistorySerializer(history, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class RecommendationDetailView(APIView):
    """
    API View to retrieve a specific recommendation details by record ID.
    Endpoint: GET /api/recommendations/<id>/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            obj = RecommendationHistory.objects.get(pk=pk)
            if obj.user != user:
                raise Http404
            return obj
        except RecommendationHistory.DoesNotExist:
            raise Http404

    def get(self, request, pk, *args, **kwargs):
        obj = self.get_object(pk, request.user)
        serializer = RecommendationHistorySerializer(obj, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)