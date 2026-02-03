const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// One-time script to create initial Firebase Auth users
// and corresponding Firestore profile documents for the vet clinic app.
//
// Usage:
//   1. Place serviceAccountKey.json (downloaded from your Firebase project)
//      in this backend folder.
//   2. From the backend folder, run:
//        node seedUsers.js
//
// This script is idempotent: if a user with the same email already exists
// in Firebase Auth, it will re-use that account and just update Firestore.

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

const usersToSeed = [
  {
    name: 'Admin',
    email: 'admin2@vet.com',
    password: 'Admin20@',
    role: 'admin',
  },
  {
    name: 'Staff 1',
    email: 'staff1@vet.com',
    password: 'Staffbaik10_',
    role: 'staff',
  },
  {
    name: 'Staff 2',
    email: 'staff2@vet.com',
    password: 'Staffterbaik20',
    role: 'staff',
  },
  {
    name: 'Siti',
    email: 'siti@vet.com',
    password: 'Match@latte_',
    role: 'client',
  },
  {
    name: 'Adam',
    email: 'adam@vet.com',
    password: 'Hawaku1@',
    role: 'client',
  },
];

async function ensureUserAndProfile(u) {
  let userRecord;

  try {
    userRecord = await auth.createUser({
      email: u.email,
      password: u.password,
      displayName: u.name,
    });
    console.log(`Created auth user for ${u.email} (uid=${userRecord.uid})`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(u.email);
      console.log(`Auth user already exists for ${u.email} (uid=${userRecord.uid}), reusing.`);
    } else {
      console.error(`Failed to create user ${u.email}:`, err);
      throw err;
    }
  }

  const uid = userRecord.uid;

  await db.collection('users').doc(uid).set(
    {
      name: u.name,
      email: u.email,
      phone: '',
      role: u.role,
    },
    { merge: true }
  );

  console.log(`Synced Firestore profile for ${u.email} with role=${u.role}`);
}

async function main() {
  for (const u of usersToSeed) {
    try {
      await ensureUserAndProfile(u);
    } catch (err) {
      console.error('Error while seeding user', u.email, err);
    }
  }

  console.log('Seeding complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in seedUsers.js:', err);
  process.exit(1);
});
