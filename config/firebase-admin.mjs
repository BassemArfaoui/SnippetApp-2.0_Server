import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config()



const decodedJsonString = Buffer.from( process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedJsonString);  

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log('Firebase Admin SDK initialized');


export default admin