from rest_framework import serializers
from .models import Hairstyle, BeardStyle, EyewearStyle, RecommendationHistory
from analysis.serializers import FaceAnalysisSerializer

class HairstyleSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Hairstyle
        fields = [
            'id', 'name', 'description', 'image', 'image_url',
            'suitable_face_shapes', 'difficulty_level', 'maintenance_level', 'tags'
        ]

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class BeardStyleSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = BeardStyle
        fields = ['id', 'name', 'description', 'image', 'image_url', 'suitable_face_shapes', 'tags']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class EyewearStyleSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = EyewearStyle
        fields = ['id', 'name', 'description', 'image', 'image_url', 'suitable_face_shapes', 'tags']

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
        fields = ['id', 'user', 'username', 'analysis', 'analysis_details', 'recommendations', 'created_at']
        read_only_fields = ['user', 'created_at']
