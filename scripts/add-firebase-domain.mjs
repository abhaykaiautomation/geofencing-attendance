import { initializeApp, cert } from 'firebase-admin/app';
import { createRequire } from 'module';
import https from 'https';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

const app = initializeApp({ credential: cert(serviceAccount) });
const token = await app.options.credential.getAccessToken();
const projectId = serviceAccount.project_id;

const baseUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(path, 'https://identitytoolkit.googleapis.com');
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Get current config
const getRes = await apiRequest('GET', `/admin/v2/projects/${projectId}/config`);
if (getRes.status !== 200) {
  console.error('Failed to get config:', getRes.body);
  process.exit(1);
}

const currentDomains = getRes.body.authorizedDomains || [];
console.log('Current authorized domains:', currentDomains);

const domainsToAdd = [
  'geofencing-psi.vercel.app',
  'geofencing-abhaykaiautomation-6017s-projects.vercel.app',
  'geofencing-git-main-abhaykaiautomation-6017s-projects.vercel.app',
];

const newDomains = [...new Set([...currentDomains, ...domainsToAdd])];

// Update config with new domains
const patchRes = await apiRequest(
  'PATCH',
  `/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
  { authorizedDomains: newDomains }
);

if (patchRes.status === 200) {
  console.log('\n✓ Updated authorized domains:');
  patchRes.body.authorizedDomains.forEach(d => console.log(' ', d));
} else {
  console.error('Failed to update:', patchRes.status, JSON.stringify(patchRes.body, null, 2));
}

process.exit(0);
