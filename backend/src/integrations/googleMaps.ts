import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

const MAPS_API_BASE = 'https://maps.googleapis.com/maps/api';

let apiClient: AxiosInstance;

function getClient(): AxiosInstance {
  if (apiClient) return apiClient;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new AppError(500, 'GOOGLE_CONFIG_ERROR', 'Google Maps API key not configured', 'Ufunguo wa Google Maps haujasanidiwa');
  }

  apiClient = axios.create({
    baseURL: MAPS_API_BASE,
    timeout: 10000,
    params: {
      key: apiKey,
    },
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        throw new AppError(504, 'GOOGLE_TIMEOUT', 'Google Maps API timed out', 'Muda wa Google Maps umeisha');
      }
      if (!error.response) {
        throw new AppError(502, 'GOOGLE_NETWORK', 'Google Maps API unavailable', 'Google Maps API haipatikani');
      }
      const apiError = error.response.data?.error_message || error.response.data?.status;
      if (error.response.data?.status === 'REQUEST_DENIED') {
        throw new AppError(403, 'GOOGLE_DENIED', 'Google Maps API request denied. Check API key permissions.', 'Ombi la Google Maps limekataliwa. Angalia ruhusa za ufunguo.');
      }
      if (error.response.data?.status === 'OVER_QUERY_LIMIT') {
        throw new AppError(429, 'GOOGLE_QUOTA', 'Google Maps API quota exceeded', 'Kikomo cha Google Maps kimezidiwa');
      }
      logger.error('Google Maps API error', { status: error.response.status, error: apiError });
      throw error;
    }
  );

  return apiClient;
}

export async function geocode(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  try {
    const client = getClient();

    const response = await client.get('/geocode/json', {
      params: { address },
    });

    const result = response.data?.results?.[0];
    if (!result) {
      throw new AppError(404, 'GEOCODE_NOT_FOUND', `Address not found: ${address}`, 'Anwani haikupatikana');
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Geocode failed', { error, address });
    throw new AppError(502, 'GEOCODE_FAILED', 'Failed to geocode address', 'Imeshindwa kutafuta anwani');
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ address: string }> {
  try {
    const client = getClient();

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw AppError.validation('Invalid coordinates', 'Kuratibu batili');
    }

    const response = await client.get('/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
      },
    });

    const result = response.data?.results?.[0];
    if (!result) {
      throw new AppError(404, 'REVERSE_GEOCODE_NOT_FOUND', 'Location not found', 'Mahali haikupatikana');
    }

    return { address: result.formatted_address };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Reverse geocode failed', { error, lat, lng });
    throw new AppError(502, 'REVERSE_GEOCODE_FAILED', 'Failed to reverse geocode', 'Imeshindwa kutafuta mahali');
  }
}

export async function autocomplete(
  input: string
): Promise<Array<{ placeId: string; description: string }>> {
  try {
    const client = getClient();

    if (!input || input.length < 2) {
      return [];
    }

    const response = await client.get('/place/autocomplete/json', {
      params: {
        input,
        types: 'address|establishment',
        components: 'country:ke',
      },
    });

    const predictions = response.data?.predictions || [];

    return predictions.map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Autocomplete failed', { error, input });
    throw new AppError(502, 'AUTOCOMPLETE_FAILED', 'Failed to autocomplete address', 'Imeshindwa kukamilisha anwani');
  }
}

export async function getPlaceDetails(
  placeId: string
): Promise<{
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  rating?: number;
}> {
  try {
    const client = getClient();

    if (!placeId) {
      throw AppError.validation('Place ID is required', 'Kitambulisho cha mahali kinahitajika');
    }

    const response = await client.get('/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,geometry,international_phone_number,website,rating,url',
      },
    });

    const result = response.data?.result;
    if (!result) {
      throw new AppError(404, 'PLACE_NOT_FOUND', 'Place not found', 'Mahali haikupatikana');
    }

    return {
      name: result.name || '',
      address: result.formatted_address || '',
      lat: result.geometry?.location?.lat || 0,
      lng: result.geometry?.location?.lng || 0,
      phone: result.international_phone_number || undefined,
      website: result.website || undefined,
      rating: result.rating || undefined,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Place details failed', { error, placeId });
    throw new AppError(502, 'PLACE_DETAILS_FAILED', 'Failed to get place details', 'Imeshindwa kupata maelezo ya mahali');
  }
}

export async function getDistanceMatrix(
  origins: Array<{ lat: number; lng: number } | string>,
  destinations: Array<{ lat: number; lng: number } | string>,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): Promise<Array<{ distance: string; duration: string; distanceValue: number; durationValue: number }>> {
  try {
    const client = getClient();

    const formatLocations = (locs: Array<any>) =>
      locs.map((l) => (typeof l === 'string' ? l : `${l.lat},${l.lng}`)).join('|');

    const response = await client.get('/distancematrix/json', {
      params: {
        origins: formatLocations(origins),
        destinations: formatLocations(destinations),
        mode,
        units: 'metric',
      },
    });

    const rows = response.data?.rows || [];
    if (!rows.length) return [];

    const elements = rows[0]?.elements || [];
    return elements.map((e: any) => ({
      distance: e.distance?.text || '',
      duration: e.duration?.text || '',
      distanceValue: e.distance?.value || 0,
      durationValue: e.duration?.value || 0,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Distance matrix failed', { error });
    throw new AppError(502, 'DISTANCE_MATRIX_FAILED', 'Failed to get distance matrix', 'Imeshindwa kupata umbali');
  }
}

export default {
  geocode,
  reverseGeocode,
  autocomplete,
  getPlaceDetails,
  getDistanceMatrix,
};
