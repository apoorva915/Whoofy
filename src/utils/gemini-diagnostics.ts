import logger from './logger';
import env from '@/config/env';

/**
 * Diagnostic utility to check Gemini API key configuration
 */
export function checkGeminiApiKey(): {
  configured: boolean;
  source: 'env' | 'process.env' | 'none';
  keyLength: number;
  keyPrefix: string;
  issues: string[];
} {
  const envKey = env.GEMINI_API_KEY?.trim() || '';
  const processKey = process.env.GEMINI_API_KEY?.trim() || '';
  
  const apiKey = envKey || processKey;
  const source = envKey ? 'env' : (processKey ? 'process.env' : 'none');
  
  const issues: string[] = [];
  
  if (!apiKey) {
    issues.push('GEMINI_API_KEY is not set');
  } else {
    // Check for placeholder values
    if (apiKey.toUpperCase() === 'YOUR_KEY' || 
        apiKey.toUpperCase() === 'YOUR_API_KEY' ||
        apiKey === 'your_gemini_api_key' ||
        apiKey.includes('YOUR') ||
        apiKey.includes('PLACEHOLDER')) {
      issues.push('API key appears to be a placeholder value - replace with your actual Gemini API key');
    }
    if (apiKey.length < 20) {
      issues.push(`API key seems too short (${apiKey.length} chars) - valid keys are ~39 characters`);
    }
    if (!apiKey.startsWith('AIza')) {
      issues.push('API key does not start with "AIza" (unusual format - valid Gemini keys start with "AIza")');
    }
    if (apiKey.includes(' ')) {
      issues.push('API key contains spaces (may need trimming)');
    }
    if (apiKey.startsWith('"') || apiKey.endsWith('"')) {
      issues.push('API key appears to have quotes around it (remove quotes)');
    }
    if (apiKey.startsWith("'") || apiKey.endsWith("'")) {
      issues.push('API key appears to have single quotes around it (remove quotes)');
    }
  }
  
  return {
    configured: !!apiKey && apiKey.length > 0,
    source,
    keyLength: apiKey.length,
    keyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : 'N/A',
    issues,
  };
}

/**
 * Log Gemini API key diagnostic information
 */
export function logGeminiDiagnostics(): void {
  const diagnostics = checkGeminiApiKey();
  
  logger.info({
    configured: diagnostics.configured,
    source: diagnostics.source,
    keyLength: diagnostics.keyLength,
    keyPrefix: diagnostics.keyPrefix,
    issues: diagnostics.issues,
  }, 'Gemini API Key Diagnostics');
  
  if (diagnostics.issues.length > 0) {
    logger.warn({
      issues: diagnostics.issues,
      hint: 'Make sure GEMINI_API_KEY is set in your .env file and restart the dev server',
    }, 'Gemini API key configuration issues detected');
  }
}

