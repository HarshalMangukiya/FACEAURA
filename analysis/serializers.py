from rest_framework import serializers
from .models import UploadedImage, FaceAnalysis, HairStyleAsset, BeardAsset, GlassesAsset, TryOnHistory

class UploadedImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedImage
        fields = ['id', 'image', 'status', 'uploaded_at']
        read_only_fields = ['id', 'status', 'uploaded_at']


class FaceAnalysisSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    measurements = serializers.SerializerMethodField()

    class Meta:
        model = FaceAnalysis
        fields = [
            'id', 'face_detected', 'total_faces', 'confidence', 'landmarks',
            'face_shape', 'face_shape_confidence', 
            'skin_tone', 'skin_type', 'acne_detected', 'acne_severity',
            'dark_circle_detected', 'pigmentation_detected', 'skin_health_score',
            'analysis_status', 'created_at', 'image_url', 'measurements'
        ]
        read_only_fields = [
            'id', 'face_detected', 'total_faces', 'confidence', 'landmarks',
            'face_shape', 'face_shape_confidence', 
            'skin_tone', 'skin_type', 'acne_detected', 'acne_severity',
            'dark_circle_detected', 'pigmentation_detected', 'skin_health_score',
            'analysis_status', 'created_at', 'image_url', 'measurements'
        ]

    def get_image_url(self, obj):
        if obj.image and obj.image.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.image.url)
            return obj.image.image.url
        return None

    def get_measurements(self, obj):
        if obj.face_detected and obj.landmarks and obj.image:
            import cv2
            import os
            from .ai.measurement_calculator import calculate_face_measurements
            try:
                image_path = obj.image.image.path
                if os.path.exists(image_path):
                    img = cv2.imread(image_path)
                    if img is not None:
                        h, w, _ = img.shape
                        return calculate_face_measurements(obj.landmarks, w, h)
            except Exception:
                pass
        return None


class HairStyleAssetSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = HairStyleAsset
        fields = ['id', 'name', 'face_shape', 'gender', 'length', 'style', 'image', 'image_url', 'thumbnail', 'thumbnail_url', 'active']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail:
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        elif obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class BeardAssetSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = BeardAsset
        fields = ['id', 'name', 'image', 'image_url', 'thumbnail', 'thumbnail_url', 'active']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail:
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        elif obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class GlassesAssetSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = GlassesAsset
        fields = ['id', 'name', 'image', 'image_url', 'thumbnail', 'thumbnail_url', 'active']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail:
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        elif obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class TryOnHistorySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    original_image_url = serializers.SerializerMethodField()
    generated_image_url = serializers.SerializerMethodField()
    
    hairstyle_details = HairStyleAssetSerializer(source='selected_hairstyle', read_only=True)
    beard_details = BeardAssetSerializer(source='selected_beard', read_only=True)
    glasses_details = GlassesAssetSerializer(source='selected_glasses', read_only=True)

    class Meta:
        model = TryOnHistory
        fields = [
            'id', 'user', 'username', 'original_image', 'original_image_url',
            'selected_hairstyle', 'hairstyle_details',
            'selected_beard', 'beard_details',
            'selected_glasses', 'glasses_details',
            'selected_color', 'generated_image', 'generated_image_url', 'is_favorite', 'created_at'
        ]
        read_only_fields = ['user', 'created_at']

    def get_original_image_url(self, obj):
        request = self.context.get('request')
        if obj.original_image and obj.original_image.image:
            if request:
                return request.build_absolute_uri(obj.original_image.image.url)
            return obj.original_image.image.url
        return None

    def get_generated_image_url(self, obj):
        request = self.context.get('request')
        if obj.generated_image:
            if request:
                return request.build_absolute_uri(obj.generated_image.url)
            return obj.generated_image.url
        return None
