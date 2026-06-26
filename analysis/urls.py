from django.urls import path
from .views import (
    ImageUploadView, 
    ImageListView, 
    ImageDetailDeleteView,
    FaceDetectView,
    FaceAnalysisResultView,
    FaceShapeDetectView,
    FaceShapeResultView,
    SkinAnalysisView,
    SkinAnalysisResultView,
    HairStyleAssetListView,
    BeardAssetListView,
    GlassesAssetListView,
    VirtualTryOnView,
    VirtualTryOnHistoryView,
    VirtualTryOnHistoryDetailView
)

urlpatterns = [
    path('upload/', ImageUploadView.as_view(), name='image-upload'),
    path('images/', ImageListView.as_view(), name='image-list'),
    path('image/<int:pk>/', ImageDetailDeleteView.as_view(), name='image-detail-delete'),
    path('detect-face/', FaceDetectView.as_view(), name='face-detect'),
    path('result/<int:pk>/', FaceAnalysisResultView.as_view(), name='face-analysis-result'),
    path('detect-face-shape/', FaceShapeDetectView.as_view(), name='face-shape-detect'),
    path('face-shape/<int:pk>/', FaceShapeResultView.as_view(), name='face-shape-result'),
    path('skin-analysis/', SkinAnalysisView.as_view(), name='skin-analysis'),
    path('skin-analysis/<int:pk>/', SkinAnalysisResultView.as_view(), name='skin-analysis-result'),
    
    # Virtual Try-On Endpoints
    path('virtual-tryon/assets/hairstyles/', HairStyleAssetListView.as_view(), name='tryon-assets-hairstyles'),
    path('virtual-tryon/assets/beards/', BeardAssetListView.as_view(), name='tryon-assets-beards'),
    path('virtual-tryon/assets/glasses/', GlassesAssetListView.as_view(), name='tryon-assets-glasses'),
    path('virtual-tryon/image/', VirtualTryOnView.as_view(), name='tryon-execute-image'),
    path('virtual-tryon/history/', VirtualTryOnHistoryView.as_view(), name='tryon-history'),
    path('virtual-tryon/history/<int:pk>/', VirtualTryOnHistoryDetailView.as_view(), name='tryon-history-detail'),
]

