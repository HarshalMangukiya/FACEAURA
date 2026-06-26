import api from './api';

/**
 * Retrieves the list of active hairstyle assets.
 * Can filter by face_shape and gender.
 * @param {Object} [params] - Optional filters.
 * @param {string} [params.face_shape] - Face shape filter (e.g. 'Oval', 'Round').
 * @param {string} [params.gender] - Gender filter (e.g. 'Male', 'Female').
 * @returns {Promise<Array>} List of hairstyles.
 */
export const getHairstyles = async (params = {}) => {
  const response = await api.get('/api/analysis/virtual-tryon/assets/hairstyles/', { params });
  return response.data;
};

/**
 * Retrieves the list of active beard assets.
 * @returns {Promise<Array>} List of beards.
 */
export const getBeards = async () => {
  const response = await api.get('/api/analysis/virtual-tryon/assets/beards/');
  return response.data;
};

/**
 * Retrieves the list of active glasses assets.
 * @returns {Promise<Array>} List of glasses.
 */
export const getGlasses = async () => {
  const response = await api.get('/api/analysis/virtual-tryon/assets/glasses/');
  return response.data;
};

/**
 * Triggers the virtual try-on image overlay pipeline.
 * @param {Object} params - Try-on parameters.
 * @param {number} params.image_id - The user's uploaded image ID.
 * @param {number} [params.hairstyle_id] - Selected hairstyle asset ID.
 * @param {number} [params.beard_id] - Selected beard asset ID.
 * @param {number} [params.glasses_id] - Selected glasses asset ID.
 * @param {string} [params.hair_color] - Custom hair color tint (e.g., 'golden', 'purple').
 * @returns {Promise<Object>} The generated history log record, including the composite image URL.
 */
export const runVirtualTryOn = async (params) => {
  const response = await api.post('/api/analysis/virtual-tryon/image/', params);
  return response.data;
};

/**
 * Retrieves the complete try-on look history for the authenticated user.
 * @returns {Promise<Array>} List of saved try-on look logs.
 */
export const getTryOnHistory = async () => {
  const response = await api.get('/api/analysis/virtual-tryon/history/');
  return response.data;
};

/**
 * Retrieves details for a specific try-on log entry.
 * @param {number} id - Try-on history ID.
 * @returns {Promise<Object>} Detailed look log.
 */
export const getTryOnDetail = async (id) => {
  const response = await api.get(`/api/analysis/virtual-tryon/history/${id}/`);
  return response.data;
};

/**
 * Deletes a try-on look bookmark.
 * @param {number} id - Try-on history ID.
 * @returns {Promise<Object>} Delete confirmation response.
 */
export const deleteTryOnHistory = async (id) => {
  const response = await api.delete(`/api/analysis/virtual-tryon/history/${id}/`);
  return response.data;
};

/**
 * Toggles the favorite status of a saved try-on look.
 * @param {number} id - Try-on history ID.
 * @param {boolean} isFavorite - Target favorite status.
 * @returns {Promise<Object>} Updated try-on history object.
 */
export const toggleTryOnFavorite = async (id, isFavorite) => {
  const response = await api.patch(`/api/analysis/virtual-tryon/history/${id}/`, { is_favorite: isFavorite });
  return response.data;
};
