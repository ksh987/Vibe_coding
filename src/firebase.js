import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';

/**
 * 🌌 Firebase Configuration System
 * 
 * 보안을 위해 API 키 및 도메인 정보는 프로젝트 루트 디렉토리의 `.env` 파일에 기록하여 
 * 환경 변수로 로드하는 것이 권장됩니다.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- [Services Export] ---
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- [Authentication Providers] ---
export const googleProvider = new GoogleAuthProvider();

// --- [Authentication Helpers] ---
/**
 * 구글 계정으로 로그인 처리
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

/**
 * 이메일과 비밀번호로 회원가입 및 닉네임 프로필 등록
 */
export const signUpWithEmail = async (email, password, nickname) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // 가입 직후 프로필에 사용자 닉네임 등록
    await updateProfile(userCredential.user, {
      displayName: nickname
    });
    return userCredential.user;
  } catch (error) {
    console.error("Email Sign-Up Error:", error);
    throw error;
  }
};

/**
 * 이메일과 비밀번호로 로그인 처리
 */
export const signInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Email Sign-In Error:", error);
    throw error;
  }
};

/**
 * 로그아웃 처리
 */
export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-Out Error:", error);
    throw error;
  }
};

// --- [Firestore Helpers] ---
/**
 * 신규 아카이브 카드를 Firestore 'cards' 컬렉션에 추가합니다.
 * @param {Object} cardData 
 */
export const addCardToFirestore = async (cardData) => {
  try {
    const docRef = await addDoc(collection(db, 'cards'), {
      ...cardData,
      createdAt: new Date().toISOString() // 정렬용 타임스탬프 추가
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding card to Firestore:", error);
    throw error;
  }
};

/**
 * Firestore 'cards' 컬렉션으로부터 모든 카드를 최신 등록 순으로 조회합니다.
 */
export const getCardsFromFirestore = async () => {
  try {
    const q = query(collection(db, 'cards'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const fetchedCards = [];
    querySnapshot.forEach((doc) => {
      fetchedCards.push({ id: doc.id, ...doc.data() });
    });
    return fetchedCards;
  } catch (error) {
    console.error("Error fetching cards from Firestore:", error);
    throw error;
  }
};
