import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

async function check() {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync('firebase-service-account.json', 'utf8'));
    initializeApp({
      credential: cert(serviceAccount)
    });
    const db = getFirestore();
    const snapshot = await db.collection('budgets').get();
    console.log(`Total budgets: ${snapshot.size}`);
    snapshot.docs.forEach(d => {
      const data = d.data();
      console.log(`ID: ${d.id}, Month: ${data.monthStr}, Cat: ${data.category}, Account: ${data.account}, Sub: ${data.subaccount}`);
    });
  } catch (err) {
    console.error(err);
  }
}

check();
