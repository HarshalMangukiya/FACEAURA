from rest_framework import serializers
from .models import ProductCategory, BeautyProduct, RecommendationHistory, RecommendationRule
from analysis.serializers import FaceAnalysisSerializer

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ['id', 'name', 'description', 'created_at']


class BeautyProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = BeautyProduct
        fields = [
            'id', 'name', 'brand', 'category', 'category_name', 'description', 
            'image', 'image_url', 'suitable_skin_types', 'suitable_skin_tones', 
            'acne_friendly', 'pigmentation_friendly', 'dark_circle_friendly', 
            'sensitive_skin_safe', 'fragrance_free', 'price_range', 'rating', 'active'
        ]

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class RecommendationHistorySerializer(serializers.ModelSerializer):
    analysis_details = FaceAnalysisSerializer(source='analysis', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = RecommendationHistory
        fields = ['id', 'user', 'username', 'analysis', 'analysis_details', 'recommendations_json', 'created_at']
        read_only_fields = ['user', 'created_at']
