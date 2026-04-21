import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

for (const email of ['admin@example.com', 'admin1@example.com']) {
  try {
    const u = await auth.getUserByEmail(email);
    console.log(`Email: ${u.email}`);
    console.log(`  UID: ${u.uid}`);
    console.log(`  Disabled: ${u.disabled}`);
    console.log(`  Email Verified: ${u.emailVerified}`);
    console.log(`  Provider: ${u.providerData.map(p => p.providerId).join(', ')}`);
    console.log('');
  } catch (err) {
    console.error(`Not found: ${email} — ${err.message}`);
  }
}

process.exit(0);
