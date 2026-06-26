from django.shortcuts import render
from django.http import Http404
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from analysis.models import FaceAnalysis
from .models import RecommendationHistory, BeautyProduct, RecommendationRule
from .serializers import RecommendationHistorySerializer
from .ai.recommendation_engine import generate_product_recommendations
from .ai.routine_generator import generate_routines


class RecommendationView(APIView):
    """
    API View to generate skincare and beauty product recommendations.
    Endpoint: POST /api/products/recommend/
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

        # Check if skin analysis is completed
        if not analysis.skin_type or not analysis.skin_tone:
            return Response(
                {"error": "Skin analysis is not completed yet on this scan. Please run skin diagnostics first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Gather input variables
        skin_type = analysis.skin_type
        skin_tone = analysis.skin_tone
        acne_detected = analysis.acne_detected
        acne_severity = analysis.acne_severity or 'None'
        dark_circle_detected = analysis.dark_circle_detected
        pigmentation_detected = analysis.pigmentation_detected
        skin_health_score = analysis.skin_health_score or 70

        # Generate recommendation matching
        try:
            rules = RecommendationRule.objects.filter(active=True).select_related('target_category')
            recommended_products = generate_product_recommendations(
                skin_type=skin_type,
                skin_tone=skin_tone,
                acne_detected=acne_detected,
                acne_severity=acne_severity,
                dark_circle_detected=dark_circle_detected,
                pigmentation_detected=pigmentation_detected,
                rules=rules,
                request=request
            )
            
            # Generate morning and night routines
            routines = generate_routines(
                recommended_products=recommended_products,
                skin_type=skin_type,
                skin_tone=skin_tone,
                acne_detected=acne_detected,
                dark_circle_detected=dark_circle_detected,
                pigmentation_detected=pigmentation_detected
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to calculate recommendations: {str(e)}"},
                status=status.HTTP_550_INTERNAL_SERVER_ERROR if hasattr(status, 'HTTP_550_INTERNAL_SERVER_ERROR') else status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Formulate JSON to store
        recommendations_json = {
            "skin_type": skin_type,
            "skin_tone": skin_tone,
            "skin_health_score": skin_health_score,
            "recommended_products": recommended_products,
            "morning_routine": routines['morning'],
            "night_routine": routines['night']
        }

        # Save to database
        history = RecommendationHistory.objects.create(
            user=request.user,
            analysis=analysis,
            recommendations_json=recommendations_json
        )

        # Construct exact requested success response format
        response_data = {
            "id": history.id,
            "skin_type": skin_type,
            "skin_tone": skin_tone,
            "skin_health_score": skin_health_score,
            "recommended_products": recommended_products,
            "morning_routine": routines['morning'],
            "night_routine": routines['night'],
            "created_at": history.created_at
        }

        return Response(response_data, status=status.HTTP_201_CREATED)


class RecommendationHistoryListView(APIView):
    """
    API View to retrieve list of beauty product recommendations history.
    Endpoint: GET /api/products/history/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        history_items = RecommendationHistory.objects.filter(user=request.user)
        serializer = RecommendationHistorySerializer(history_items, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class RecommendationHistoryDetailView(APIView):
    """
    API View to retrieve specific beauty product recommendations detail.
    Endpoint: GET /api/products/recommendation/<id>/
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
        
        # Flatten for convenience while keeping full serialization
        data = serializer.data
        rec_json = data.get('recommendations_json', {})
        
        # Merge key fields at the root of the data if they are not already there
        if rec_json:
            for key in ['skin_type', 'skin_tone', 'skin_health_score', 'recommended_products', 'morning_routine', 'night_routine']:
                if key in rec_json:
                    data[key] = rec_json[key]
                    
        return Response(data, status=status.HTTP_200_OK)
