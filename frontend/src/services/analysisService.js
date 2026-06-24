import api from './api';

/**
 * Uploads a selfie image to the backend server.
 * @param {File} imageFile - The file object to upload.
 * @param {Function} onUploadProgress - Callback to receive upload progress events.
 * @returns {Promise<Object>} The API response with message, image_id, and image_url.
 */
export const uploadImage = async (imageFile, onUploadProgress) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await api.post('/api/analysis/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percentCompleted);
      }
    },
  });
  return response.data;
};

/**
 * Retrieves the list of uploaded images for the authenticated user.
 * @returns {Promise<Array>} List of user images.
 */
export const getImages = async () => {
  const response = await api.get('/api/analysis/images/');
  return response.data;
};

/**
 * Deletes a specific uploaded image.
 * @param {number} id - The ID of the image to delete.
 * @returns {Promise<Object>} Success message.
 */
export const deleteImage = async (id) => {
  const response = await api.delete(`/api/analysis/image/${id}/`);
  return response.data;
};
