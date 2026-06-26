from django.urls import path
from .views import RecommendationView, RecommendationHistoryListView, RecommendationHistoryDetailView

urlpatterns = [
    path('recommend/', RecommendationView.as_view(), name='product_recommend'),
    path('history/', RecommendationHistoryListView.as_view(), name='product_recommendation_history'),
    path('recommendation/<int:pk>/', RecommendationHistoryDetailView.as_view(), name='product_recommendation_detail'),
]
