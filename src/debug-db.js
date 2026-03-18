import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCoCv7SlZ95quCGEfxBputIpx65GA_BYNI",
  authDomain: "vecsale-6ff3a.firebaseapp.com",
  projectId: "vecsale-6ff3a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Signed in anonymously", cred.user.uid);
  } catch(e) {
    console.log("Failed to sign in anonymously", e.message);
  }

  try {
    console.log("Fetching merchants...");
    const mSnap = await getDocs(query(collection(db, "merchants"), limit(5)));
    mSnap.forEach(d => console.log("Merchant:", d.id, JSON.stringify(d.data(), null, 2)));
  } catch(e) {
    console.error("error fetching merchants", e.message);
  }

  try {
    console.log("\nFetching deals...");
    const dSnap = await getDocs(query(collection(db, "deals"), limit(5)));
    dSnap.forEach(d => console.log("Deal:", d.id, JSON.stringify(d.data(), null, 2)));
  } catch(e) {
    console.error("error fetching deals", e.message);
  }
  
  process.exit(0);
}

main().catch(console.error);
