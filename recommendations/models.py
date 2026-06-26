from django.db import models
from django.contrib.auth.models import User
from analysis.models import FaceAnalysis

class Hairstyle(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    image = models.ImageField(upload_to='hairstyles/', null=True, blank=True)
    suitable_face_shapes = models.JSONField(default=list)  # list of face shape strings: ["Oval", "Square"]
    difficulty_level = models.CharField(max_length=50, default='Medium')  # Easy, Medium, Hard
    maintenance_level = models.CharField(max_length=50, default='Medium')  # Low, Medium, High
    tags = models.JSONField(default=list, blank=True)  # list of tag strings: ["professional", "casual", "trendy"]

    def __str__(self):
        return self.name


class BeardStyle(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    image = models.ImageField(upload_to='beards/', null=True, blank=True)
    suitable_face_shapes = models.JSONField(default=list)  # list of face shape strings: ["Oval", "Rectangle"]
    tags = models.JSONField(default=list, blank=True)  # list of tag strings: ["professional", "casual", "trendy"]

    def __str__(self):
        return self.name


class EyewearStyle(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    image = models.ImageField(upload_to='eyewear/', null=True, blank=True)
    suitable_face_shapes = models.JSONField(default=list)  # list of face shape strings: ["Square"]
    tags = models.JSONField(default=list, blank=True)  # list of tag strings: ["professional", "casual", "trendy"]

    def __str__(self):
        return self.name


class RecommendationHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recommendations')
    analysis = models.ForeignKey(FaceAnalysis, on_delete=models.CASCADE, related_name='recommendations')
    recommendations = models.JSONField()  # Full dictionary containing styles and confidence scores
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Recommendation {self.id} for {self.user.username} on {self.created_at.strftime('%Y-%m-%d %H:%M')}"
