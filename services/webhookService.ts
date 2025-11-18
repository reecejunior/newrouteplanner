
const MAKE_WEBHOOK_URL = import.meta.env.VITE_MAKE_WEBHOOK_URL || 'https://hook.eu1.make.com/6giojng5kgga0pkdv5e74m2epy7o7evh';
const WEBHOOK_TIMEOUT = parseInt(import.meta.env.VITE_WEBHOOK_TIMEOUT || '30000', 10);

export interface WebhookResponse {
  success?: boolean;
  addresses?: string[];
  data?: string[];
  error?: string;
  message?: string;
}

export async function extractAddressesFromWebhook(
  base64Image: string,
  mimeType: string,
  retryCount: number = 0
): Promise<string[]> {
  try {
    const payload = {
      image: {
        data: base64Image,
        mimeType: mimeType,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'route_planner_app',
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle rate limiting (429) with retry
      if (response.status === 429 && retryCount < 2) {
        const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return extractAddressesFromWebhook(base64Image, mimeType, retryCount + 1);
      }
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    const result: WebhookResponse | string[] = await response.json();

    // Handle different response formats from Make.com
    if (Array.isArray(result)) {
      // Direct array response
      const addresses = result.filter(item => typeof item === 'string' && item.trim().length > 0);
      if (addresses.length === 0 && retryCount < 2) {
        // Retry if empty response (might be transient issue)
        await new Promise(resolve => setTimeout(resolve, 1000));
        return extractAddressesFromWebhook(base64Image, mimeType, retryCount + 1);
      }
      return addresses;
    }

    if (typeof result === 'object' && result !== null) {
      // Object response
      if (result.success === false) {
        const errorMsg = result.error || result.message || 'Unknown error from webhook';
        console.warn('Make.com returned error:', errorMsg);
        throw new Error(errorMsg);
      }

      // Support multiple response formats
      let addresses: string[] = [];

      if (result.addresses && Array.isArray(result.addresses)) {
        addresses = result.addresses;
      } else if (result.data && Array.isArray(result.data)) {
        addresses = result.data;
      } else {
        throw new Error('Unexpected response format from webhook');
      }

      // Validate addresses are strings
      if (!addresses.every(item => typeof item === 'string')) {
        throw new Error('Invalid address format in response');
      }

      const validAddresses = addresses.filter(addr => addr.trim().length > 0);
      
      if (validAddresses.length === 0 && retryCount < 2) {
        // Retry if empty response
        await new Promise(resolve => setTimeout(resolve, 1000));
        return extractAddressesFromWebhook(base64Image, mimeType, retryCount + 1);
      }

      return validAddresses;
    }

    throw new Error('Unexpected response format from webhook');

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Webhook took too long to respond');
      }
      if (error.message.includes('fetch')) {
        throw new Error('Network error: Could not connect to webhook');
      }
      throw error;
    }
    console.error('Webhook error:', error);
    throw new Error('Could not extract addresses from image via webhook.');
  }
}

