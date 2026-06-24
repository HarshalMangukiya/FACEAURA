import os
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import UploadedImage
from .serializers import UploadedImageSerializer

class ImageUploadView(APIView):
    """
    API View to handle uploading a selfie image.
    Endpoint: POST /api/analysis/upload/
    Authorization: Bearer Token Required
    Request: multipart/form-data with 'image' field.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        image_file = request.FILES.get('image')
        
        # 1. Validation: check if image exists in request
        if not image_file:
            return Response(
                {"error": "No image uploaded. Please provide an image file under the 'image' field."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Validation: check file type (extension)
        ext = os.path.splitext(image_file.name)[1].lower()
        allowed_extensions = ['.jpg', '.jpeg', '.png']
        if ext not in allowed_extensions:
            return Response(
                {"error": f"Invalid file type. Only {', '.join(allowed_extensions).upper()} are allowed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Validation: check file mime content-type
        allowed_content_types = ['image/jpeg', 'image/jpg', 'image/png']
        if image_file.content_type not in allowed_content_types:
            return Response(
                {"error": "Invalid file format. Please upload a valid JPEG or PNG image."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Validation: check size (max 5 MB)
        max_size = 5 * 1024 * 1024  # 5 Megabytes
        if image_file.size > max_size:
            return Response(
                {"error": "Image file is too large. Maximum size allowed is 5 MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save the image via serializer, linking it to the active user
        serializer = UploadedImageSerializer(data=request.data)
        if serializer.is_valid():
            uploaded_image = serializer.save(user=request.user)
            image_url = request.build_absolute_uri(uploaded_image.image.url)
            return Response({
                "message": "Image uploaded successfully",
                "image_id": uploaded_image.id,
                "image_url": image_url
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ImageListView(APIView):
    """
    API View to retrieve list of user's uploaded images.
    Endpoint: GET /api/analysis/images/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        images = UploadedImage.objects.filter(user=request.user).order_by('-uploaded_at')
        serializer = UploadedImageSerializer(images, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ImageDetailDeleteView(APIView):
    """
    API View to retrieve details or delete a specific image.
    Endpoint: GET/DELETE /api/analysis/image/<id>/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            obj = UploadedImage.objects.get(pk=pk)
            # Prevent users from accessing images belonging to other users (raise 404)
            if obj.user != user:
                raise Http404
            return obj
        except UploadedImage.DoesNotExist:
            raise Http404

    def get(self, request, pk, *args, **kwargs):
        obj = self.get_object(pk, request.user)
        serializer = UploadedImageSerializer(obj, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk, *args, **kwargs):
        obj = self.get_object(pk, request.user)
        obj.delete()  # Signal automatically deletes file from storage
        return Response(
            {"message": "Image deleted"},
            status=status.HTTP_200_OK
        )
