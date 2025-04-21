import axios from 'axios';

export const createAuthConfig = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const makeAuthRequest = async (method, url, data = null, token) => {
  try {
    const config = createAuthConfig(token);
    const response = await axios({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'An error occurred';
    throw new Error(errorMessage);
  }
}; 