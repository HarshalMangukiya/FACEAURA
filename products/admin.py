from django.contrib import admin
from .models import ProductCategory, BeautyProduct, RecommendationHistory, RecommendationRule

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description', 'created_at')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(BeautyProduct)
class BeautyProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'brand', 'category', 'price_range', 'rating', 'active')
    list_filter = ('category', 'price_range', 'active', 'acne_friendly', 'pigmentation_friendly', 'dark_circle_friendly', 'sensitive_skin_safe', 'fragrance_free')
    search_fields = ('name', 'brand', 'description')
    ordering = ('brand', 'name')
    list_editable = ('active', 'price_range', 'rating')


@admin.register(RecommendationHistory)
class RecommendationHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'analysis', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'analysis__id')
    ordering = ('-created_at',)
    readonly_fields = ('user', 'analysis', 'recommendations_json', 'created_at')


@admin.register(RecommendationRule)
class RecommendationRuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'skin_type', 'concern', 'rule_type', 'target_category', 'score_modifier', 'active')
    list_filter = ('skin_type', 'concern', 'rule_type', 'active')
    search_fields = ('name', 'keyword')
    list_editable = ('score_modifier', 'active')
    ordering = ('name',)
