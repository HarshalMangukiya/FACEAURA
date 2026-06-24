from rest_framework import serializers
from .models import UploadedImage

class UploadedImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedImage
        fields = ['id', 'image', 'status', 'uploaded_at']
        read_only_fields = ['id', 'status', 'uploaded_at']
