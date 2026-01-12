import env from './env';

/**
 * External API Configuration
 */
export const externalApiConfig = {
  instagram: {
    apiKey: env.INSTAGRAM_RAPIDAPI_KEY,
    apiHost: env.INSTAGRAM_RAPIDAPI_HOST,
    baseUrl: `https://${env.INSTAGRAM_RAPIDAPI_HOST}`,
    rateLimit: {
      requestsPerMinute: 10, // RapidAPI free tier limit
    },
  },
  
  apify: {
    apiToken: env.APIFY_API_TOKEN,
    baseUrl: 'https://api.apify.com/v2',
    rateLimit: {
      requestsPerMinute: 30,
    },
  },
  
  shazam: {
    apiKey: env.SHAZAM_API_KEY,
    apiHost: env.SHAZAM_API_HOST,
    baseUrl: `https://${env.SHAZAM_API_HOST}`,
    rateLimit: {
      requestsPerDay: 1000,
    },
  },
  
  notegpt: {
    apiKey: env.NOTEGPT_API_KEY,
    baseUrl: env.NOTEGPT_API_URL || 'https://api.notegpt.io',
    rateLimit: {
      requestsPerMinute: 10,
    },
  },
  
  openai: {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 90000,
    },
  },
  
  gemini: {
    apiKey: env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com',
  },
  
  googleCloud: {
    projectId: env.GOOGLE_CLOUD_PROJECT_ID,
    visionApiKey: env.GOOGLE_CLOUD_VISION_API_KEY,
    baseUrl: 'https://vision.googleapis.com/v1',
  },
};

/**
 * Check if external API is configured
 */
export function isApiConfigured(apiName: keyof typeof externalApiConfig): boolean {
  switch (apiName) {
    case 'instagram':
      return !!externalApiConfig.instagram.apiKey;
    case 'apify':
      return !!externalApiConfig.apify.apiToken;
    case 'shazam':
      return !!externalApiConfig.shazam.apiKey;
    case 'notegpt':
      return !!externalApiConfig.notegpt.apiKey;
    case 'openai':
      return !!externalApiConfig.openai.apiKey;
    case 'gemini':
      return !!externalApiConfig.gemini.apiKey;
    case 'googleCloud':
      return !!(externalApiConfig.googleCloud.projectId && externalApiConfig.googleCloud.visionApiKey);
    default:
      return false;
  }
}
