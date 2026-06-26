from django.contrib import admin
from .models import Hairstyle, BeardStyle, EyewearStyle, RecommendationHistory

@admin.register(Hairstyle)
class HairstyleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'difficulty_level', 'maintenance_level', 'suitable_face_shapes')
    search_fields = ('name', 'description')
    list_filter = ('difficulty_level', 'maintenance_level')


@admin.register(BeardStyle)
class BeardStyleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'suitable_face_shapes')
    search_fields = ('name', 'description')


@admin.register(EyewearStyle)
class EyewearStyleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'suitable_face_shapes')
    search_fields = ('name', 'description')


@admin.register(RecommendationHistory)
class RecommendationHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'analysis', 'created_at')
    list_filter = ('created_at', 'user')
    ordering = ('-created_at',)