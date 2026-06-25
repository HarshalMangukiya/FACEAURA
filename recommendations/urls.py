from django.urls import path
from .views import RecommendationGenerateView, RecommendationHistoryView, RecommendationDetailView

urlpatterns = [
    path('generate/', RecommendationGenerateView.as_view(), name='recommendation_generate'),
    path('history/', RecommendationHistoryView.as_view(), name='recommendation_history'),
    path('<int:pk>/', RecommendationDetailView.as_view(), name='recommendation_detail'),
]
