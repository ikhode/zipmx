import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCyozL1Uiye6qlWAduj5xjsKylyVow3IsM",
  authDomain: "zipp-mx.firebaseapp.com",
  projectId: "zipp-mx",
  storageBucket: "zipp-mx.firebasestorage.app",
  messagingSenderId: "1002593274399",
  appId: "1:1002593274399:web:8e75034ae5bbfaddf6632a",
  measurementId: "G-63999NC1KT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);

// Analytics is only supported in browser-like environments
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

export default app;
