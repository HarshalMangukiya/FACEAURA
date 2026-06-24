from django.urls import path
from .views import ImageUploadView, ImageListView, ImageDetailDeleteView

urlpatterns = [
    path('upload/', ImageUploadView.as_view(), name='image-upload'),
    path('images/', ImageListView.as_view(), name='image-list'),
    path('image/<int:pk>/', ImageDetailDeleteView.as_view(), name='image-detail-delete'),
]
