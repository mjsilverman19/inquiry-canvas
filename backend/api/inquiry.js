import { getVercelOidcToken } from '@vercel/oidc';
import { checkRateLimit } from '@vercel/firewall';
import { createHandler } from '../server/inquiry.js';
export default {
  fetch(request) {
    const env = process.env;
    return createHandler({ env, credential: () => env.AI_GATEWAY_API_KEY || getVercelOidcToken(), rateLimit: checkRateLimit })(request);
  },
};
