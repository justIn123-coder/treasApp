
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC_1tbB-YFtzoE96DZrhNnLj0NPKZA246Y",
  authDomain: "bseeportal-3521a.firebaseapp.com",
  projectId: "bseeportal-3521a",
  storageBucket: "bseeportal-3521a.firebasestorage.app",
  messagingSenderId: "1060244833164",
  appId: "1:1060244833164:web:a32f91218df4d68f76cca9",
  measurementId: "G-CKXSJF31NG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent cache enabled
// This allows the app to handle "Could not reach backend" errors by working offline.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Optional Analytics support
isSupported().then(yes => {
    if (yes) getAnalytics(app);
});

export default app;
