import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

const accounts = [
  { email: 'admin@example.com',  newPassword: 'Admin@1234' },
  { email: 'admin1@example.com', newPassword: 'Admin@1234' },
];

for (const { email, newPassword } of accounts) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    console.log(`✓ Reset password for ${email} (uid: ${user.uid})`);
  } catch (err) {
    console.error(`✗ Failed for ${email}:`, err.message);
  }
}

process.exit(0);
