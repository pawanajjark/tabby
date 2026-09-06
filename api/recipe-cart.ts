import { handleInstamartApi } from '../server/instamartApi.js';

export function POST(request: Request): Promise<Response> {
  return handleInstamartApi(request, 'recipe-cart');
}
