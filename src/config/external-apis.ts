import env from './env';

/**
 * External API Configuration
 */
export const externalApiConfig = {
  instagram: {
    appId: env.INSTAGRAM_APP_ID,
    appSecret: env.INSTAGRAM_APP_SECRET,
    accessToken: env.INSTAGRAM_ACCESS_TOKEN,
    baseUrl: 'https://graph.instagram.com',
    rateLimit: {
      requestsPerHour: 200, // Instagram Graph API limit
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
  const config = externalApiConfig[apiName];
  
  switch (apiName) {
    case 'instagram':
      return !!(config.appId && config.appSecret);
    case 'apify':
      return !!config.apiToken;
    case 'shazam':
      return !!config.apiKey;
    case 'notegpt':
      return !!config.apiKey;
    case 'openai':
      return !!config.apiKey;
    case 'googleCloud':
      return !!(config.projectId && config.visionApiKey);
    default:
      return false;
  }
}
