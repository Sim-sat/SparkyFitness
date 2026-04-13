import { auth } from '../auth.js';

type ApiEndpoint = {
  path: string;
  method: string;
};

function isApiEndpoint(value: unknown): value is ApiEndpoint {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.path === 'string' && typeof v.method === 'string';
}

async function checkRoutes() {
  console.log('Checking deleteAllExpiredApiKeys path...');
  const maybeApi = auth.api as Record<string, unknown>;
  const endpoint = maybeApi.deleteAllExpiredApiKeys;
  if (endpoint) {
    console.log('Endpoint found.');
    if (!isApiEndpoint(endpoint)) {
      console.log('Endpoint found, but shape was unexpected.');
      return;
    }
    console.log(`Path: ${endpoint.path}`);
    console.log(`Method: ${endpoint.method}`);
  } else {
    console.log('Endpoint not found in auth.api');
  }
}
checkRoutes().catch(console.error);
