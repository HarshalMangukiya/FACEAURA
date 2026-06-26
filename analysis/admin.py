from django.contrib import admin
from .models import UploadedImage, FaceAnalysis, HairStyleAsset, BeardAsset, GlassesAsset, TryOnHistory

@admin.register(UploadedImage)
class UploadedImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'uploaded_at')
    list_filter = ('status', 'uploaded_at')
    search_fields = ('user__username',)

@admin.register(FaceAnalysis)
class FaceAnalysisAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'face_detected', 'face_shape', 'skin_type', 'skin_tone', 'analysis_status', 'created_at')
    list_filter = ('face_detected', 'face_shape', 'skin_type', 'analysis_status')
    search_fields = ('user__username',)

@admin.register(HairStyleAsset)
class HairStyleAssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'face_shape', 'gender', 'length', 'style', 'active')
    list_filter = ('face_shape', 'gender', 'length', 'style', 'active')
    search_fields = ('name',)

@admin.register(BeardAsset)
class BeardAssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(GlassesAsset)
class GlassesAssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(TryOnHistory)
class TryOnHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'selected_hairstyle', 'selected_beard', 'selected_glasses', 'selected_color', 'created_at')
    list_filter = ('selected_color', 'created_at')
    search_fields = ('user__username',)

