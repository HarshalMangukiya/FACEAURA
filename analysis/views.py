import os
import cv2
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import UploadedImage, FaceAnalysis, HairStyleAsset, BeardAsset, GlassesAsset, TryOnHistory
from .serializers import (
    UploadedImageSerializer, FaceAnalysisSerializer,
    HairStyleAssetSerializer, BeardAssetSerializer, GlassesAssetSerializer, TryOnHistorySerializer
)
from .ai.face_detector import detect_face
from .ai.landmark_detector import extract_landmarks
from .ai.utils import draw_face_landmarks, draw_shape_analysis
from .ai.measurement_calculator import calculate_face_measurements
from .ai.face_shape_detector import detect_face_shape
from .ai.skin_tone_detector import detect_skin_tone
from .ai.skin_type_detector import detect_skin_type
from .ai.acne_detector import detect_acne
from .ai.dark_circle_detector import detect_dark_circles
from .ai.pigmentation_detector import detect_pigmentation
from .ai.skin_score_calculator import calculate_skin_health_score
from .ai.utils import draw_face_landmarks, draw_shape_analysis, draw_skin_analysis
import logging

logger = logging.getLogger('analysis')


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


class FaceDetectView(APIView):
    """
    API View to run face detection and landmark extraction.
    Endpoint: POST /api/analysis/detect-face/
    Authorization: Bearer Token Required
    Request: {"image_id": 1}
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        image_id = request.data.get('image_id')
        if not image_id:
            logger.error(f"User {request.user.id}: Face detection request missing image_id")
            return Response(
                {"error": "image_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            image_obj = UploadedImage.objects.get(pk=image_id)
            if image_obj.user != request.user:
                logger.warning(f"User {request.user.id} unauthorized access attempt to image {image_id}")
                return Response(
                    {"error": "Image not found or unauthorized."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except UploadedImage.DoesNotExist:
            logger.error(f"User {request.user.id}: Image {image_id} not found")
            return Response(
                {"error": "Image not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        logger.info(f"User {request.user.id}: Initiating face detection on image {image_id}")

        image_obj.status = 'processing'
        image_obj.save()

        image_path = image_obj.image.path
        if not os.path.exists(image_path):
            image_obj.status = 'failed'
            image_obj.save()
            logger.error(f"User {request.user.id}: Image path {image_path} does not exist")
            return Response(
                {"status": "failed", "message": "Image file not found on disk"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            detection_res = detect_face(image_path)
        except Exception as e:
            image_obj.status = 'failed'
            image_obj.save()
            
            FaceAnalysis.objects.create(
                user=request.user,
                image=image_obj,
                face_detected=False,
                total_faces=0,
                confidence=0.0,
                analysis_status='failed'
            )
            
            logger.error(f"User {request.user.id}: Face detection exception: {str(e)}")
            return Response(
                {"status": "failed", "message": "Corrupted or invalid image"},
                status=status.HTTP_400_BAD_REQUEST
            )

        face_detected = detection_res["face_detected"]
        total_faces = detection_res["total_faces"]
        confidence = detection_res["confidence"]

        if not face_detected or total_faces == 0:
            image_obj.status = 'failed'
            image_obj.save()
            
            FaceAnalysis.objects.create(
                user=request.user,
                image=image_obj,
                face_detected=False,
                total_faces=0,
                confidence=0.0,
                analysis_status='failed'
            )
            
            logger.warning(f"User {request.user.id}: Detection failed - No face detected")
            return Response(
                {"status": "failed", "message": "No face detected"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        elif total_faces > 1:
            image_obj.status = 'failed'
            image_obj.save()
            
            FaceAnalysis.objects.create(
                user=request.user,
                image=image_obj,
                face_detected=True,
                total_faces=total_faces,
                confidence=confidence,
                analysis_status='failed'
            )
            
            logger.warning(f"User {request.user.id}: Detection failed - Multiple faces ({total_faces})")
            return Response(
                {"status": "failed", "message": "Multiple faces detected"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract landmarks
        try:
            landmarks = extract_landmarks(image_path)
            if not landmarks:
                raise ValueError("Landmarks extraction returned empty")
        except Exception as e:
            image_obj.status = 'failed'
            image_obj.save()
            
            FaceAnalysis.objects.create(
                user=request.user,
                image=image_obj,
                face_detected=True,
                total_faces=1,
                confidence=confidence,
                analysis_status='failed'
            )
            
            logger.error(f"User {request.user.id}: Landmark extraction exception: {str(e)}")
            return Response(
                {"status": "failed", "message": "Failed to extract landmarks"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save successful analysis
        analysis = FaceAnalysis.objects.create(
            user=request.user,
            image=image_obj,
            face_detected=True,
            total_faces=1,
            confidence=confidence,
            landmarks=landmarks,
            analysis_status='completed'
        )

        image_obj.status = 'completed'
        image_obj.save()

        # Visual debug mode
        try:
            draw_face_landmarks(image_path, landmarks, image_obj.id)
            logger.info(f"User {request.user.id}: Visual debug image created for image {image_obj.id}")
        except Exception as draw_err:
            logger.error(f"User {request.user.id}: Failed to generate visual debug: {draw_err}")

        logger.info(f"User {request.user.id}: Face analysis successful for image {image_id}")
        return Response({
            "face_detected": True,
            "total_faces": 1,
            "confidence": confidence,
            "landmarks_detected": True
        }, status=status.HTTP_201_CREATED)


class FaceAnalysisResultView(APIView):
    """
    API View to retrieve face analysis results.
    Endpoint: GET /api/analysis/result/<id>/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        # We allow looking up by either FaceAnalysis ID or by UploadedImage ID
        try:
            analysis = FaceAnalysis.objects.get(pk=pk)
            if analysis.user != request.user:
                raise Http404
            serializer = FaceAnalysisSerializer(analysis, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except FaceAnalysis.DoesNotExist:
            try:
                analysis = FaceAnalysis.objects.filter(image_id=pk, user=request.user).latest('created_at')
                serializer = FaceAnalysisSerializer(analysis, context={'request': request})
                return Response(serializer.data, status=status.HTTP_200_OK)
            except FaceAnalysis.DoesNotExist:
                raise Http404


class FaceShapeDetectView(APIView):
    """
    API View to run face shape detection on landmarks.
    Endpoint: POST /api/analysis/detect-face-shape/
    Authorization: Bearer Token Required
    Request: {"image_id": 1}
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        image_id = request.data.get('image_id')
        if not image_id:
            logger.error(f"User {request.user.id}: Face shape detection request missing image_id")
            return Response(
                {"error": "image_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            image_obj = UploadedImage.objects.get(pk=image_id)
            if image_obj.user != request.user:
                logger.warning(f"User {request.user.id} unauthorized access attempt to image {image_id}")
                return Response(
                    {"error": "Image not found or unauthorized."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except UploadedImage.DoesNotExist:
            logger.error(f"User {request.user.id}: Image {image_id} not found")
            return Response(
                {"error": "Image not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Retrieve or run FaceAnalysis landmarks
        try:
            analysis_obj = FaceAnalysis.objects.filter(image=image_obj, user=request.user).latest('created_at')
            if analysis_obj.analysis_status != 'completed' or not analysis_obj.landmarks:
                raise FaceAnalysis.DoesNotExist
        except FaceAnalysis.DoesNotExist:
            # Run Face detection + Landmark extraction dynamically if not completed yet
            image_obj.status = 'processing'
            image_obj.save()
            
            image_path = image_obj.image.path
            if not os.path.exists(image_path):
                image_obj.status = 'failed'
                image_obj.save()
                return Response(
                    {"status": "failed", "message": "Image file not found on disk"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            try:
                detection_res = detect_face(image_path)
            except Exception as e:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=False,
                    total_faces=0,
                    confidence=0.0,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "Corrupted or invalid image"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            face_detected = detection_res["face_detected"]
            total_faces = detection_res["total_faces"]
            confidence = detection_res["confidence"]
            
            if not face_detected or total_faces == 0:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=False,
                    total_faces=0,
                    confidence=0.0,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "No face detected"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif total_faces > 1:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=True,
                    total_faces=total_faces,
                    confidence=confidence,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "Multiple faces detected"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            try:
                landmarks = extract_landmarks(image_path)
                if not landmarks:
                    raise ValueError("Failed to extract landmarks")
            except Exception as e:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=True,
                    total_faces=1,
                    confidence=confidence,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "Failed to extract landmarks"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            analysis_obj = FaceAnalysis.objects.create(
                user=request.user,
                image=image_obj,
                face_detected=True,
                total_faces=1,
                confidence=confidence,
                landmarks=landmarks,
                analysis_status='completed'
            )
            image_obj.status = 'completed'
            image_obj.save()
            
            # Also draw standard landmarks mesh
            try:
                draw_face_landmarks(image_path, landmarks, image_obj.id)
            except Exception:
                pass

        image_path = image_obj.image.path
        img = cv2.imread(image_path)
        if img is None:
            return Response(
                {"status": "failed", "message": "Corrupted or invalid image"},
                status=status.HTTP_400_BAD_REQUEST
            )
        img_h, img_w, _ = img.shape
        
        # Calculate Measurements
        landmarks = analysis_obj.landmarks
        measurements = calculate_face_measurements(landmarks, img_w, img_h)
        
        # Calculate Face Shape & Confidence
        shape_res = detect_face_shape(measurements)
        face_shape = shape_res["face_shape"]
        face_shape_confidence = shape_res["confidence"]
        
        # Save to database
        analysis_obj.face_shape = face_shape
        analysis_obj.face_shape_confidence = face_shape_confidence
        analysis_obj.save()
        
        # Generate HUD/Biometric measurement debug image
        try:
            draw_shape_analysis(image_path, landmarks, measurements, face_shape, face_shape_confidence, image_obj.id)
            logger.info(f"User {request.user.id}: Visual shape analysis debug image created for image {image_obj.id}")
        except Exception as draw_err:
            logger.error(f"User {request.user.id}: Failed to generate shape visual debug: {draw_err}")
            
        return Response({
            "face_shape": face_shape,
            "confidence": face_shape_confidence,
            "measurements": measurements
        }, status=status.HTTP_200_OK)


class FaceShapeResultView(APIView):
    """
    API View to retrieve face shape analysis result.
    Endpoint: GET /api/analysis/face-shape/<id>/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        try:
            analysis = FaceAnalysis.objects.get(pk=pk)
            if analysis.user != request.user:
                raise Http404
        except FaceAnalysis.DoesNotExist:
            try:
                analysis = FaceAnalysis.objects.filter(image_id=pk, user=request.user).latest('created_at')
            except FaceAnalysis.DoesNotExist:
                raise Http404

        if not analysis.face_shape:
            raise Http404

        return Response({
            "face_shape": analysis.face_shape,
            "confidence": analysis.face_shape_confidence
        }, status=status.HTTP_200_OK)


class SkinAnalysisView(APIView):
    """
    API View to run skin tone, skin type, acne, dark circles, and pigmentation detection.
    Endpoint: POST /api/analysis/skin-analysis/
    Authorization: Bearer Token Required
    Request: {"image_id": 1}
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        image_id = request.data.get('image_id')
        if not image_id:
            logger.error(f"User {request.user.id}: Skin analysis request missing image_id")
            return Response(
                {"error": "image_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            image_obj = UploadedImage.objects.get(pk=image_id)
            if image_obj.user != request.user:
                logger.warning(f"User {request.user.id} unauthorized access attempt to image {image_id}")
                return Response(
                    {"error": "Image not found or unauthorized."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except UploadedImage.DoesNotExist:
            logger.error(f"User {request.user.id}: Image {image_id} not found")
            return Response(
                {"error": "Image not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Retrieve or run FaceAnalysis landmarks
        try:
            analysis_obj = FaceAnalysis.objects.filter(image=image_obj, user=request.user).latest('created_at')
            if analysis_obj.analysis_status != 'completed' or not analysis_obj.landmarks:
                raise FaceAnalysis.DoesNotExist
        except FaceAnalysis.DoesNotExist:
            # Run Face detection + Landmark extraction dynamically if not completed yet
            image_obj.status = 'processing'
            image_obj.save()
            
            image_path = image_obj.image.path
            if not os.path.exists(image_path):
                image_obj.status = 'failed'
                image_obj.save()
                return Response(
                    {"status": "failed", "message": "Image file not found on disk"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            try:
                detection_res = detect_face(image_path)
            except Exception as e:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=False,
                    total_faces=0,
                    confidence=0.0,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "Corrupted or invalid image"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            face_detected = detection_res["face_detected"]
            total_faces = detection_res["total_faces"]
            confidence = detection_res["confidence"]
            
            if not face_detected or total_faces == 0:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=False,
                    total_faces=0,
                    confidence=0.0,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "No face detected"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif total_faces > 1:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=True,
                    total_faces=total_faces,
                    confidence=confidence,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "Multiple faces detected"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            try:
                landmarks = extract_landmarks(image_path)
                if not landmarks:
                    raise ValueError("Failed to extract landmarks")
            except Exception as e:
                image_obj.status = 'failed'
                image_obj.save()
                FaceAnalysis.objects.create(
                    user=request.user,
                    image=image_obj,
                    face_detected=True,
                    total_faces=1,
                    confidence=confidence,
                    analysis_status='failed'
                )
                return Response(
                    {"status": "failed", "message": "Failed to extract landmarks"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            analysis_obj = FaceAnalysis.objects.create(
                user=request.user,
                image=image_obj,
                face_detected=True,
                total_faces=1,
                confidence=confidence,
                landmarks=landmarks,
                analysis_status='completed'
            )
            image_obj.status = 'completed'
            image_obj.save()
            
            # Also draw standard landmarks mesh
            try:
                draw_face_landmarks(image_path, landmarks, image_obj.id)
            except Exception:
                pass

        image_path = image_obj.image.path
        img = cv2.imread(image_path)
        if img is None:
            return Response(
                {"status": "failed", "message": "Corrupted or invalid image"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        landmarks = analysis_obj.landmarks
        
        # Run skin analysis pipeline
        try:
            tone_res = detect_skin_tone(img, landmarks)
            type_res = detect_skin_type(img, landmarks)
            acne_res = detect_acne(img, landmarks)
            dark_circle_res = detect_dark_circles(img, landmarks)
            pigmentation_res = detect_pigmentation(img, landmarks)
            
            score = calculate_skin_health_score(
                acne_res["severity"],
                dark_circle_res["dark_circle_detected"],
                pigmentation_res["pigmentation_detected"],
                pigmentation_res["variance_score"]
            )
            
            # Update FaceAnalysis object
            analysis_obj.skin_tone = tone_res["skin_tone"]
            analysis_obj.skin_type = type_res["skin_type"]
            analysis_obj.acne_detected = acne_res["acne_detected"]
            analysis_obj.acne_severity = acne_res["severity"]
            analysis_obj.dark_circle_detected = dark_circle_res["dark_circle_detected"]
            analysis_obj.pigmentation_detected = pigmentation_res["pigmentation_detected"]
            analysis_obj.skin_health_score = score
            analysis_obj.save()
            
            # Generate visual debug overlay
            try:
                draw_skin_analysis(
                    image_path, 
                    landmarks, 
                    acne_res["acne_spots"], 
                    tone_res["rois"], 
                    dark_circle_res["rois"], 
                    image_obj.id
                )
                logger.info(f"User {request.user.id}: Visual skin analysis debug image created for image {image_obj.id}")
            except Exception as draw_err:
                logger.error(f"User {request.user.id}: Failed to generate skin visual debug: {draw_err}")
                
            return Response({
                "id": analysis_obj.id,
                "analysis_status": "completed",
                "skin_tone": tone_res["skin_tone"],
                "skin_type": type_res["skin_type"],
                "acne_detected": acne_res["acne_detected"],
                "acne_severity": acne_res["severity"],
                "dark_circle_detected": dark_circle_res["dark_circle_detected"],
                "pigmentation_detected": pigmentation_res["pigmentation_detected"],
                "skin_health_score": score
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"User {request.user.id}: Skin analysis pipeline exception: {str(e)}")
            return Response(
                {"status": "failed", "message": f"Error running skin analysis: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SkinAnalysisResultView(APIView):
    """
    API View to retrieve stored skin analysis results.
    Endpoint: GET /api/analysis/skin-analysis/<id>/
    Authorization: Bearer Token Required
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        try:
            analysis = FaceAnalysis.objects.get(pk=pk)
            if analysis.user != request.user:
                raise Http404
        except FaceAnalysis.DoesNotExist:
            try:
                analysis = FaceAnalysis.objects.filter(image_id=pk, user=request.user).latest('created_at')
            except FaceAnalysis.DoesNotExist:
                raise Http404

        if not analysis.skin_tone:
            raise Http404

        return Response({
            "id": analysis.id,
            "analysis_status": analysis.analysis_status,
            "skin_tone": analysis.skin_tone,
            "skin_type": analysis.skin_type,
            "acne_detected": analysis.acne_detected,
            "acne_severity": analysis.acne_severity,
            "dark_circle_detected": analysis.dark_circle_detected,
            "pigmentation_detected": analysis.pigmentation_detected,
            "skin_health_score": analysis.skin_health_score
        }, status=status.HTTP_200_OK)


class HairStyleAssetListView(APIView):
    """
    API View to list available hairstyle assets.
    Supports filtering by face_shape and gender in query parameters.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        face_shape = request.query_params.get('face_shape')
        gender = request.query_params.get('gender')
        
        queryset = HairStyleAsset.objects.filter(active=True)
        if face_shape:
            from django.db.models import Q
            # Allow items marked specifically for this shape, or marked as 'All'
            queryset = queryset.filter(Q(face_shape__iexact=face_shape) | Q(face_shape__iexact='All'))
        if gender:
            queryset = queryset.filter(gender__iexact=gender)

        serializer = HairStyleAssetSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class BeardAssetListView(APIView):
    """
    API View to list available beard assets.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = BeardAsset.objects.filter(active=True)
        serializer = BeardAssetSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class GlassesAssetListView(APIView):
    """
    API View to list available glasses assets.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = GlassesAsset.objects.filter(active=True)
        serializer = GlassesAssetSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class VirtualTryOnView(APIView):
    """
    API View to execute alignment and blending overlays on a selfie.
    Endpoint: POST /api/analysis/virtual-tryon/image/ (mapped dynamically)
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        image_id = request.data.get('image_id')
        hairstyle_id = request.data.get('hairstyle_id')
        beard_id = request.data.get('beard_id')
        glasses_id = request.data.get('glasses_id')
        hair_color = request.data.get('hair_color')

        if not image_id:
            return Response(
                {"error": "image_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Fetch UploadedImage
        try:
            image_obj = UploadedImage.objects.get(pk=image_id)
            if image_obj.user != user:
                return Response(
                    {"error": "Image record not found or unauthorized."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except UploadedImage.DoesNotExist:
            return Response(
                {"error": "Image not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Fetch FaceAnalysis for landmarks
        try:
            analysis_obj = FaceAnalysis.objects.filter(image=image_obj, user=user).latest('created_at')
            if not analysis_obj.face_detected or not analysis_obj.landmarks:
                return Response(
                    {"error": "Face shape analysis must be run first on this selfie to align assets."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except FaceAnalysis.DoesNotExist:
            return Response(
                {"error": "Run face landmarks analysis first before triggering try-on overlays."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Retrieve assets paths on disk
        hairstyle = None
        hairstyle_path = None
        if hairstyle_id:
            try:
                hairstyle = HairStyleAsset.objects.get(pk=hairstyle_id, active=True)
                if hairstyle.image:
                    hairstyle_path = hairstyle.image.path
            except HairStyleAsset.DoesNotExist:
                return Response(
                    {"error": f"Hairstyle with id {hairstyle_id} does not exist or is inactive."},
                    status=status.HTTP_404_NOT_FOUND
                )

        beard = None
        beard_path = None
        if beard_id:
            try:
                beard = BeardAsset.objects.get(pk=beard_id, active=True)
                if beard.image:
                    beard_path = beard.image.path
            except BeardAsset.DoesNotExist:
                return Response(
                    {"error": f"Beard with id {beard_id} does not exist or is inactive."},
                    status=status.HTTP_404_NOT_FOUND
                )

        glasses = None
        glasses_path = None
        if glasses_id:
            try:
                glasses = GlassesAsset.objects.get(pk=glasses_id, active=True)
                if glasses.image:
                    glasses_path = glasses.image.path
            except GlassesAsset.DoesNotExist:
                return Response(
                    {"error": f"Glasses with id {glasses_id} does not exist or is inactive."},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 4. Generate composite render
        try:
            import time
            from django.conf import settings
            from .virtual_tryon.renderer.image_renderer import render_image

            original_image_path = image_obj.image.path
            if not os.path.exists(original_image_path):
                return Response(
                    {"error": "Original photo file missing from disk."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Process composition
            composite = render_image(
                image_path=original_image_path,
                landmarks=analysis_obj.landmarks,
                hairstyle_path=hairstyle_path,
                beard_path=beard_path,
                glasses_path=glasses_path,
                color_name=hair_color
            )

            # Ensure media folder
            tryon_dir = os.path.join(settings.MEDIA_ROOT, 'tryon_results')
            if not os.path.exists(tryon_dir):
                os.makedirs(tryon_dir)

            # Save generated file
            filename = f"tryon_{user.id}_{int(time.time())}.jpg"
            file_path = os.path.join(tryon_dir, filename)
            cv2.imwrite(file_path, composite)

            # Log Try-On look to database
            history_item = TryOnHistory.objects.create(
                user=user,
                original_image=image_obj,
                selected_hairstyle=hairstyle,
                selected_beard=beard,
                selected_glasses=glasses,
                selected_color=hair_color or 'Original',
                generated_image=f"tryon_results/{filename}"
            )

            serializer = TryOnHistorySerializer(history_item, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"User {user.id}: Virtual Try-On failed: {str(e)}")
            return Response(
                {"error": f"Overlay rendering failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VirtualTryOnHistoryView(APIView):
    """
    API View to list all saved try-on looks for the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = TryOnHistory.objects.filter(user=request.user).order_by('-created_at')
        serializer = TryOnHistorySerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class VirtualTryOnHistoryDetailView(APIView):
    """
    API View to retrieve or delete a specific try-on log look.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            obj = TryOnHistory.objects.get(pk=pk)
            if obj.user != user:
                raise Http404
            return obj
        except TryOnHistory.DoesNotExist:
            raise Http404

    def get(self, request, pk, *args, **kwargs):
        obj = self.get_object(pk, request.user)
        serializer = TryOnHistorySerializer(obj, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk, *args, **kwargs):
        obj = self.get_object(pk, request.user)
        is_favorite = request.data.get('is_favorite')
        if is_favorite is not None:
            obj.is_favorite = bool(is_favorite)
            obj.save()
            serializer = TryOnHistorySerializer(obj, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response({"error": "is_favorite field is required"}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, *args, **kwargs):
        obj = self.get_object(pk, request.user)
        # Delete generated file from media folder
        if obj.generated_image:
            if os.path.isfile(obj.generated_image.path):
                try:
                    os.remove(obj.generated_image.path)
                except Exception:
                    pass
        obj.delete()
        return Response(
            {"message": "Look deleted from bookmarks successfully."},
            status=status.HTTP_200_OK
        )
