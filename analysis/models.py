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
