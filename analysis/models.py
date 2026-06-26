import os
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver

class UploadedImage(models.Model):
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_images')
    image = models.ImageField(upload_to='uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploaded'
    )

    def __str__(self):
        return f"Image {self.id} (User: {self.user.username}, Status: {self.status})"


@receiver(post_delete, sender=UploadedImage)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    """
    Deletes image file from filesystem
    when corresponding UploadedImage object is deleted.
    """
    if instance.image:
        if os.path.isfile(instance.image.path):
            try:
                os.remove(instance.image.path)
            except Exception:
                pass


class FaceAnalysis(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='face_analyses')
    image = models.ForeignKey(UploadedImage, on_delete=models.CASCADE, related_name='face_analyses')
    face_detected = models.BooleanField(default=False)
    total_faces = models.IntegerField(default=0)
    confidence = models.FloatField(null=True, blank=True)
    landmarks = models.JSONField(null=True, blank=True)  # Store 468 landmark coordinates [{"x": 0.52, "y": 0.33, "z": -0.02}]
    face_shape = models.CharField(max_length=25, null=True, blank=True)
    face_shape_confidence = models.FloatField(null=True, blank=True)
    
    # Skin Analysis Fields
    skin_tone = models.CharField(max_length=20, null=True, blank=True)
    skin_type = models.CharField(max_length=20, null=True, blank=True)
    acne_detected = models.BooleanField(default=False)
    acne_severity = models.CharField(max_length=20, default='None', null=True, blank=True)
    dark_circle_detected = models.BooleanField(default=False)
    pigmentation_detected = models.BooleanField(default=False)
    skin_health_score = models.IntegerField(null=True, blank=True)
    
    analysis_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis {self.id} for User: {self.user.username} (Status: {self.analysis_status})"


class HairStyleAsset(models.Model):
    name = models.CharField(max_length=100)
    face_shape = models.CharField(max_length=50, default='All')  # Round, Oval, Square, Heart, Diamond, Rectangle, All
    gender = models.CharField(max_length=20, default='Unisex')  # Male, Female, Unisex
    length = models.CharField(max_length=50, default='Medium')  # Short, Medium, Long
    style = models.CharField(max_length=50, default='Casual')  # Professional, Casual, Trendy, Sporty
    image = models.ImageField(upload_to='assets/hairstyles/')
    thumbnail = models.ImageField(upload_to='assets/hairstyles/thumbnails/', null=True, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.face_shape} - {self.gender})"


class BeardAsset(models.Model):
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='assets/beards/')
    thumbnail = models.ImageField(upload_to='assets/beards/thumbnails/', null=True, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class GlassesAsset(models.Model):
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='assets/glasses/')
    thumbnail = models.ImageField(upload_to='assets/glasses/thumbnails/', null=True, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class TryOnHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tryon_histories')
    original_image = models.ForeignKey(UploadedImage, on_delete=models.CASCADE, related_name='tryon_histories')
    selected_hairstyle = models.ForeignKey(HairStyleAsset, on_delete=models.SET_NULL, null=True, blank=True)
    selected_beard = models.ForeignKey(BeardAsset, on_delete=models.SET_NULL, null=True, blank=True)
    selected_glasses = models.ForeignKey(GlassesAsset, on_delete=models.SET_NULL, null=True, blank=True)
    selected_color = models.CharField(max_length=50, null=True, blank=True)
    generated_image = models.ImageField(upload_to='tryon_results/')
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Try-On History"
        verbose_name_plural = "Try-On Histories"

    def __str__(self):
        return f"Try-On History {self.id} for {self.user.username} at {self.created_at}"


