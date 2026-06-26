from django.db import models
from django.contrib.auth.models import User
from analysis.models import FaceAnalysis

class ProductCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Product Category"
        verbose_name_plural = "Product Categories"

    def __str__(self):
        return self.name


class BeautyProduct(models.Model):
    PRICE_RANGE_CHOICES = [
        ('Budget', 'Budget'),
        ('Midrange', 'Midrange'),
        ('Premium', 'Premium'),
    ]

    name = models.CharField(max_length=200)
    brand = models.CharField(max_length=100)
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, related_name='products')
    description = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    
    # Store multiple matching categories
    suitable_skin_types = models.JSONField(default=list, help_text="List of skin types, e.g., ['Oily', 'Dry']")
    suitable_skin_tones = models.JSONField(default=list, help_text="List of skin tones, e.g., ['Fair', 'Medium']")
    
    # Concern flags
    acne_friendly = models.BooleanField(default=False)
    pigmentation_friendly = models.BooleanField(default=False)
    dark_circle_friendly = models.BooleanField(default=False)
    sensitive_skin_safe = models.BooleanField(default=False)
    fragrance_free = models.BooleanField(default=False)
    
    # Metadata
    price_range = models.CharField(max_length=20, choices=PRICE_RANGE_CHOICES, default='Midrange')
    rating = models.FloatField(default=4.0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['brand', 'name']

    def __str__(self):
        return f"{self.brand} - {self.name} ({self.category.name})"


class RecommendationHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='product_recommendations')
    analysis = models.ForeignKey(FaceAnalysis, on_delete=models.CASCADE, related_name='product_recommendations')
    recommendations_json = models.JSONField(help_text="Detailed routine steps and category matching items")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Recommendation History"
        verbose_name_plural = "Recommendation Histories"

    def __str__(self):
        return f"Product Recommendation #{self.id} for {self.user.username} (Analysis #{self.analysis.id})"


class RecommendationRule(models.Model):
    SKIN_TYPE_CHOICES = [
        ('Oily', 'Oily'),
        ('Dry', 'Dry'),
        ('Normal', 'Normal'),
        ('Combination', 'Combination'),
        ('All', 'All'),
    ]
    
    CONCERN_CHOICES = [
        ('Acne', 'Acne'),
        ('Pigmentation', 'Pigmentation'),
        ('Dark Circles', 'Dark Circles'),
        ('None', 'None'),
        ('All', 'All'),
    ]

    RULE_TYPE_CHOICES = [
        ('recommend', 'Recommend / Boost'),
        ('avoid', 'Avoid / Penalize'),
    ]

    name = models.CharField(max_length=150)
    skin_type = models.CharField(max_length=20, choices=SKIN_TYPE_CHOICES, default='All')
    concern = models.CharField(max_length=50, choices=CONCERN_CHOICES, default='All')
    rule_type = models.CharField(max_length=20, choices=RULE_TYPE_CHOICES, default='recommend')
    target_category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, null=True, blank=True, related_name='rules')
    keyword = models.CharField(max_length=100, blank=True, help_text="Keyword in product name or description to match (case insensitive)")
    score_modifier = models.IntegerField(default=0, help_text="Points to add or subtract (e.g. +10, -50)")
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.rule_type})"
