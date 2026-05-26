import React, { useState, useRef, useEffect } from 'react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logOut, 
  addCardToFirestore,
  signUpWithEmail,
  signInWithEmail
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// --- [Web Audio API: 맑고 투명한 호버 사운드 생성기] ---
let audioCtx = null;

const playHoverSound = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = 'sine'; 
  osc.frequency.setValueAtTime(1200 + Math.random() * 600, audioCtx.currentTime);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 0.08); 
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.8);
};

// --- [Mock Data & Constants] ---
const CARD_W = 260;
const CARD_H = 360;
const GAP = 12; 
const STAGGER_Y = 100; 

const NEON_COLORS = [
 '#0a84ff', '#64d2ff', '#30d158', '#5e5ce6', '#00cdbc', 
 '#ff453a', '#ff9f0a', '#ffd60a', '#ff375f', '#bf5af2'  
];

const INITIAL_COLS = 6; 
const INITIAL_ROWS = 5;

const CARDS_DATA = [];
for (let i = 0; i < INITIAL_COLS * INITIAL_ROWS; i++) {
 const col = i % INITIAL_COLS;
 const row = Math.floor(i / INITIAL_COLS);
 const forbiddenColors = new Set();
 if (col > 0) forbiddenColors.add(CARDS_DATA[i - 1]?.neonColor); 
 if (row > 0) forbiddenColors.add(CARDS_DATA[i - INITIAL_COLS]?.neonColor); 
 const availableColors = NEON_COLORS.filter(color => !forbiddenColors.has(color));
 const selectedColor = availableColors[Math.floor(Math.random() * availableColors.length)];

 CARDS_DATA.push({
   id: `mock-${i}`,
   title: ["日本昔ばなし", "雪おんな", "かぐ야姫", "浦島太郎", "桃太郎", "さるかに合戦"][Math.floor(Math.random() * 6)] + ` Vol.${i + 1}`,
   tags: ["神화", "액션", "판타지", "로맨스", "코미디"].slice(0, Math.floor(Math.random() * 2) + 1),
   author: ["スタジオジブリ風", "新海誠スタイル", "鳥山明リسپек트", "手塚治虫오마쥬"][Math.floor(Math.random() * 4)],
   imageUrl: `https://picsum.photos/seed/${i + 800}/400/600`,
   neonColor: selectedColor
 });
}

// --- [Components] ---

const Card = ({ data, onClick }) => {
 const cardRef = useRef(null);
 const handleMouseMove = (e) => {
   if (!cardRef.current) return;
   const rect = cardRef.current.getBoundingClientRect();
   cardRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
   cardRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
 };

 return (
   <div
     ref={cardRef} 
     onMouseMove={handleMouseMove} 
     onMouseEnter={playHoverSound}
     onClick={() => onClick(data)}
     className={`relative rounded-[32px] overflow-hidden group transition-transform duration-500 ease-out hover:scale-[1.04] hover:-translate-y-2 shrink-0`}
     style={{ width: `${CARD_W}px`, height: `${CARD_H}px`, boxShadow: `0 0 40px -5px ${data.neonColor}50, 0 15px 35px -10px rgba(0,0,0,0.8)` }}
   >
     <div className="relative z-10 w-full h-full bg-[#111113] overflow-hidden flex flex-col justify-end p-6">
       <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-60" style={{ backgroundImage: `url(${data.imageUrl})` }} />
       <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
       <div className="absolute inset-0 pointer-events-none rounded-[32px] z-10 mix-blend-screen" style={{ border: `2px solid ${data.neonColor}60`, boxShadow: `inset 0 0 80px 5px ${data.neonColor}70, inset 0 0 20px 2px ${data.neonColor}90` }} />
       <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 mix-blend-overlay" style={{ background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.3), transparent 40%)' }} />
       <div className="relative z-20 text-white flex flex-col gap-2 drop-shadow-lg pointer-events-none">
         <h3 className="text-2xl font-bold leading-tight text-white/95 tracking-wide">{data.title}</h3>
         <p className="text-xs text-white/60 font-medium">Author: {data.author}</p>
         <div className="flex flex-wrap gap-2 mt-2">
           {data.tags.map((tag, idx) => (
             <span key={idx} className="px-3 py-1 text-[11px] font-medium rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/80">{tag}</span>
           ))}
         </div>
       </div>
     </div>
   </div>
 );
};

const BoardChunk = ({ cards, cols, chunkWidth, chunkHeight, offsetX, offsetY, onCardClick }) => {
 return (
   <div className="absolute top-0 left-0 pointer-events-auto" style={{ width: `${chunkWidth}px`, height: `${chunkHeight}px`, transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` }}>
     {cards.map((card, index) => {
       const col = index % cols;
       const row = Math.floor(index / cols);
       const x = col * (CARD_W + GAP);
       const stagger = col % 2 !== 0 ? STAGGER_Y : 0;
       const y = row * (CARD_H + GAP) + stagger;
       return (
         <div key={card.id} className="absolute top-0 left-0" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
           <Card data={card} onClick={onCardClick} />
         </div>
       );
     })}
   </div>
 );
};

const ListView = ({ data, isVisible, onCardClick }) => {
 const categories = ['ALL', '공주', '따뜻한 이야기', '나카지마', '이상한', 'etc...'];
 return (
   <div className={`absolute inset-0 bg-[#0a0a0a] overflow-y-auto pb-32 pt-40 px-10 z-20 pointer-events-auto transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex gap-4 mb-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
          {categories.map((tag, idx) => (
            <button key={tag} className={`px-6 py-3 rounded-full border ${idx === 0 ? 'bg-white text-black border-white font-bold' : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'} whitespace-nowrap text-sm font-medium transition-colors cursor-none`}>{tag}</button>
          ))}
        </div>
        {data.map(item => (
           <div key={item.id} onMouseEnter={playHoverSound} onClick={() => onCardClick(item)} className="flex gap-6 p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-3xl hover:bg-white transition-colors duration-300 group cursor-pointer">
             <div className="w-28 h-28 rounded-full overflow-hidden shrink-0 border-[3px] shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ borderColor: item.neonColor }}>
               <img src={item.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
             </div>
             <div className="flex flex-col justify-center flex-1 py-2 pointer-events-none">
               <h2 className="text-2xl font-bold text-white/95 mb-2 group-hover:text-black transition-colors duration-300">{item.title}</h2>
               <div className="flex gap-2 mb-3">
                 {item.tags.map((tag, idx) => (
                   <span key={idx} className="px-2.5 py-1 text-[10px] font-bold bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700 group-hover:bg-white group-hover:text-black group-hover:border-zinc-500 transition-colors duration-300">{tag}</span>
                 ))}
                 <span className="px-2.5 py-1 text-[10px] font-bold bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700 group-hover:bg-white group-hover:text-black group-hover:border-zinc-500 transition-colors duration-300">Author: {item.author}</span>
               </div>
               <p className="text-zinc-500 text-sm line-clamp-2 pr-10 font-medium group-hover:text-zinc-800 transition-colors duration-300">
                 {item.description || `${item.title}를 중심으로 펼쳐지는 환상적인 이야기. 예로부터 전해져 내려오는 민담을 현대적인 감각으로 재해석하여, 남녀노소 누구나 즐길 수 있는 감동적인 서사를 담아냈습니다.`}
               </p>
             </div>
             <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
               <span className="font-black text-[11px] tracking-widest text-white group-hover:text-black flex items-center gap-2 transition-colors duration-300">
                 VIEW MORE
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
               </span>
             </div>
           </div>
        ))}
      </div>
   </div>
 )
};

export default function App() {
  const [introStep, setIntroStep] = useState(0);
  const audioRef = useRef(null);
  // --- [Firebase States] ---
  const [user, setUser] = useState(null);
  const [firestoreCards, setFirestoreCards] = useState([]);

  const [viewMode, setViewMode] = useState('grid');
  const viewModeRef = useRef(viewMode);
  const [activeCard, setActiveCard] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // --- [Direct Email/Password Authentication States] ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authError, setAuthError] = useState('');
  
  // --- [Secret Owner/Admin Security System] ---
  const [isAdminMode, setIsAdminMode] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(null);
  
  // Card Creation Form States
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newColor, setNewColor] = useState(NEON_COLORS[0]);
  const [newImageType, setNewImageType] = useState('seed'); // 'seed' or 'url'
  const [newImageSeed, setNewImageSeed] = useState('custom-seed');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);

  // --- [Reactive Hybrid Cards System] ---
  // Firestore 실제 등록 카드 + 자리가 남을 시 기본 mock 카드를 병합하여 화면 풍성도 유지
  const cards = firestoreCards.length > 0
    ? [...firestoreCards, ...CARDS_DATA.slice(0, Math.max(0, INITIAL_COLS * INITIAL_ROWS - firestoreCards.length))]
    : CARDS_DATA;
  // Infinite grid layouts calculation based on reactive cards count
  const dynamicCols = 6;
  const dynamicRows = Math.ceil(cards.length / dynamicCols) || 1;
  const dynamicChunkWidth = dynamicCols * (CARD_W + GAP);
  const dynamicChunkHeight = dynamicRows * (CARD_H + GAP);

  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const requestRef = useRef();
  const dragDistance = useRef(0);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const mousePos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });

  const cursorRef = useRef(null);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const globalMousePos = useRef({ 
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 
  });
  const cursorCurrent = useRef({ 
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 
  });

  const handleIntroSelection = (playAudio) => {
    // 오디오 컨텍스트 초기화 및 재개
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (playAudio && audioRef.current) {
      audioRef.current.play().catch(err => console.log("Audio playback failed:", err));
    }
    
    // 크리스마스 스플래시 이미지 단계(Step 1)를 건너뛰고 메인 화면(Step 2)으로 바로 진입
    setIntroStep(2);
  };

  const chunkWidthRef = useRef(dynamicChunkWidth);
  const chunkHeightRef = useRef(dynamicChunkHeight);

  // --- [Firebase Observers & Listeners] ---
  useEffect(() => {
    // 1. 관찰자 설정: 로그인 상태 추적
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // 2. 리스너 설정: Firestore 'cards' 실시간 동기화
    const q = query(collection(db, 'cards'), orderBy('createdAt', 'desc'));
    const unsubscribeDb = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setFirestoreCards(fetched);
    }, (error) => {
      console.warn("Firestore listener not ready or has config issue:", error);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, []);

  // Sync refs with dynamic computations for updates in updatePhysics loop
  useEffect(() => {
    chunkWidthRef.current = dynamicChunkWidth;
    chunkHeightRef.current = dynamicChunkHeight;
  }, [dynamicChunkWidth, dynamicChunkHeight]);

  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const openModal = (card) => {
    setActiveCard(card);
    setTimeout(() => setIsModalOpen(true), 10);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setActiveCard(null), 700);
  };

  const handleCardClick = (card) => {
    if (dragDistance.current > 10) return;
    openModal(card);
  };

  const handleMouseDown = (e) => {
    if (introStep < 2 || viewMode !== 'grid') return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('form') || e.target.closest('input') || e.target.closest('textarea')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    mousePos.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };
    dragDistance.current = 0;
  };

  const handleMouseMove = (e) => {
    globalMousePos.current = { x: e.clientX, y: e.clientY };

    if (!isDragging.current || viewMode !== 'grid' || introStep < 2) return;
    const deltaX = e.clientX - mousePos.current.x;
    const deltaY = e.clientY - mousePos.current.y;
    velocity.current = { x: deltaX, y: deltaY };
    target.current.x += deltaX;
    target.current.y += deltaY;
    dragDistance.current += Math.abs(deltaX) + Math.abs(deltaY);
    mousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => { isDragging.current = false; };

  const updatePhysics = () => {
    const prevX = cursorCurrent.current.x;
    const prevY = cursorCurrent.current.y;

    cursorCurrent.current.x = globalMousePos.current.x;
    cursorCurrent.current.y = globalMousePos.current.y;
    
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${cursorCurrent.current.x}px, ${cursorCurrent.current.y}px, 0)`;
    }

    const speed = Math.sqrt(Math.pow(cursorCurrent.current.x - prevX, 2) + Math.pow(cursorCurrent.current.y - prevY, 2));
    const canvas = canvasRef.current;
    
    if (canvas && introStep === 2) { 
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ringCenterX = cursorCurrent.current.x + 40 * 1.05;
      const ringCenterY = cursorCurrent.current.y + 12 * 1.05;
      const ringRadius = 10 * 1.05; 

      if (speed > 0.5) {
        const particleCount = Math.min(Math.floor(speed / 4) + 1, 3);
        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = ringRadius + 4 + Math.random() * 8; 
          particlesRef.current.push({
            x: ringCenterX + Math.cos(angle) * distance,
            y: ringCenterY + Math.sin(angle) * distance,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            life: Math.random() * 0.5 + 0.6, 
            size: Math.random() * 1.5 + 0.5  
          });
        }
      }

      particlesRef.current.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.015; });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      particlesRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.9})`; 
        ctx.shadowBlur = 12; 
        ctx.shadowColor = `rgba(34, 211, 238, ${p.life})`; 
        ctx.fill();
      });
    }

    if (viewModeRef.current === 'list' || introStep < 2) {
      requestRef.current = requestAnimationFrame(updatePhysics);
      return;
    }

    if (!isDragging.current) {
      target.current.x += velocity.current.x;
      target.current.y += velocity.current.y;
      velocity.current.x *= 0.93; 
      velocity.current.y *= 0.93;
    }

    current.current.x += (target.current.x - current.current.x) * 0.15; 
    current.current.y += (target.current.y - current.current.y) * 0.15;

    // Use dynamic refs inside physics animation loop
    let wrapX = current.current.x % chunkWidthRef.current;
    let wrapY = current.current.y % chunkHeightRef.current;

    if (wrapX > chunkWidthRef.current / 2) wrapX -= chunkWidthRef.current;
    if (wrapX < -chunkWidthRef.current / 2) wrapX += chunkWidthRef.current;
    if (wrapY > chunkHeightRef.current / 2) wrapY -= chunkHeightRef.current;
    if (wrapY < -chunkHeightRef.current / 2) wrapY += chunkHeightRef.current;

    if (current.current.x - wrapX !== 0) target.current.x -= (current.current.x - wrapX);
    if (current.current.y - wrapY !== 0) target.current.y -= (current.current.y - wrapY);
    
    current.current.x = wrapX;
    current.current.y = wrapY;

    if (containerRef.current) containerRef.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0)`;
    
    requestRef.current = requestAnimationFrame(updatePhysics);
  };

  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    requestRef.current = requestAnimationFrame(updatePhysics);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(requestRef.current);
    };
  }, [introStep]);

  // --- [Secret Keyboard Shortcut Listener] ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Secret Admin Hotkey: Ctrl + Shift + A (Admin Mode)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAdminMode(prev => {
          const next = !prev;
          playHoverSound();
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- [Login / Logout / SignUp Handlers] ---
  const handleEmailAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    if (authMode === 'signup' && !authNickname.trim()) {
      setAuthError("사용할 닉네임을 입력해주세요.");
      return;
    }

    try {
      if (authMode === 'signup') {
        // Direct signup with Email and Password, and setting the display name
        const registeredUser = await signUpWithEmail(authEmail, authPassword, authNickname);
        setUser(registeredUser);
        alert(`🎉 회원가입 성공!\n안녕하세요, ${authNickname}님! 비ショジョ 아카이브에 오신 것을 환영합니다.`);
      } else {
        // Direct login
        const loggedInUser = await signInWithEmail(authEmail, authPassword);
        setUser(loggedInUser);
      }
      
      // Success: reset form and close auth modal
      setAuthEmail('');
      setAuthPassword('');
      setAuthNickname('');
      setAuthError('');
      setIsAuthModalOpen(false);
      playHoverSound();
    } catch (err) {
      console.error("Authentication Error Details:", err);
      
      // Parse Firebase Auth Error messages nicely in Korean
      if (err.code === 'auth/email-already-in-use') {
        setAuthError("🔒 이미 사용 중인 이메일 주소입니다.");
      } else if (err.code === 'auth/weak-password') {
        setAuthError("🔑 비밀번호는 최소 6자 이상이어야 합니다.");
      } else if (err.code === 'auth/invalid-email') {
        setAuthError("✉️ 이메일 형식이 올바르지 않습니다.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError("❌ 이메일 또는 비밀번호가 일치하지 않습니다.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError("🔒 파이어베이스 콘솔에서 '이메일/비밀번호' 로그인 방식이 활성화되어 있지 않습니다.\n[해결 방법]\n콘솔 > Authentication > Sign-in method > 이메일/비밀번호를 '사용 설정'으로 켜주세요.");
      } else {
        setAuthError(`❌ 오류가 발생했습니다: ${err.code || err.message}`);
      }
    }
  };

  const handleLoginClick = () => {
    setAuthMode('signin');
    setAuthError('');
    setIsAuthModalOpen(true);
    playHoverSound();
  };

  const handleLogoutClick = async () => {
    try {
      await logOut();
      setUser(null);
      playHoverSound();
    } catch (err) {
      console.log("Logout failed:", err);
    }
  };

  const handleCreateClick = () => {
    if (!user) {
      const confirmLogin = confirm("새 카드를 아카이브에 영구 등록하려면 계정 로그인이 필요합니다.\n로그인 및 계정 생성 화면으로 이동하시겠습니까?");
      if (confirmLogin) {
        setAuthMode('signin');
        setAuthError('');
        setIsAuthModalOpen(true);
        playHoverSound();
      }
    } else {
      setIsCreateModalOpen(true);
    }
  };

  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 1500);

    if (logoClickCount.current >= 3) {
      setIsAdminMode(prev => {
        const next = !prev;
        playHoverSound();
        return next;
      });
      logoClickCount.current = 0;
    }
  };


  const handleCloseAndApply = () => {
    if (isSaveSuccess) {
      // Reset Form (Only on success!)
      setNewTitle('');
      setNewAuthor('');
      setNewTags('');
      setNewColor(NEON_COLORS[0]);
      setNewImageType('seed');
      setNewImageSeed(Math.random().toString(36).substring(7));
      setNewImageUrl('');
      setNewDescription('');
      setIsSaveSuccess(false);
    }
    // Close Modal and play success sound
    setIsCreateModalOpen(false);
    playHoverSound();

    // Re-center target coordinates slightly to highlight the new card
    target.current = { x: 0, y: 0 };
  };

  const handleRegisterCard = async (e) => {
    e.preventDefault();
    if (isRegistering) return;

    if (!newTitle.trim()) {
      alert("카드 제목을 입력해주세요!");
      return;
    }

    const newCardObj = {
      title: newTitle,
      author: newAuthor || '작가 미상',
      tags: newTags ? newTags.split(/[\s,]+/).filter(Boolean) : ['기타'],
      imageUrl: newImageType === 'seed' 
        ? `https://picsum.photos/seed/${newImageSeed || Date.now()}/400/600` 
        : (newImageUrl || `https://picsum.photos/seed/${Date.now()}/400/600`),
      neonColor: newColor,
      height: Math.random() > 0.7 ? 'h-96' : 'h-72',
      description: newDescription,
      creatorUid: user ? user.uid : 'anonymous',
      creatorName: user ? user.displayName : '익명'
    };

    try {
      setIsRegistering(true);
      setIsSaveSuccess(false);
      // 파이어베이스 Firestore DB에 즉시 영구 저장!
      await addCardToFirestore(newCardObj);
      setIsSaveSuccess(true);
      playHoverSound();
    } catch (error) {
      console.error("Firestore Save Error:", error);
      alert("파이어베이스 실시간 데이터베이스 저장에 실패했습니다.\n\n[상세 에러 내용]\n" + error.message + "\n\n(파이어베이스 Firestore DB가 미생성 상태이거나 보안 규칙(Rules) 문제일 수 있습니다. 콘솔 설정을 확인해주세요.)");
    } finally {
      setIsRegistering(false);
    }
  };

  const previewCardData = {
    id: 'preview',
    title: newTitle || '아름다운 새 카드 제목',
    author: newAuthor || '원화 작가 스타일',
    tags: newTags ? newTags.split(/[\s,]+/).filter(Boolean) : ['신화', '로맨스'],
    imageUrl: newImageType === 'seed' 
      ? `https://picsum.photos/seed/${newImageSeed || 'preview'}/400/600` 
      : (newImageUrl || 'https://picsum.photos/seed/preview/400/600'),
    neonColor: newColor,
    height: 'h-96'
  };

  const offsets = [-1, 0, 1];

  return (
    <div className={`w-screen h-screen overflow-hidden bg-[#0a0a0a] select-none relative font-sans text-zinc-100 ${introStep === 2 && !isCreateModalOpen && !isModalOpen && !isAuthModalOpen ? 'cursor-none' : 'cursor-auto'}`} onMouseDown={handleMouseDown}>
      
      {/* ⚠️ 에셋 매핑 위치 (오디오) */}
      <audio ref={audioRef} src="/assets/Slow_Coffee_Mornings.mp3" loop />

      {/* --- ✨ Intro Sequence Overlay ✨ --- */}
      <div className={`fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0a] transition-opacity duration-1000 ${introStep < 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Step 0: Music Prompt */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${introStep === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none scale-150">
            <h1 className="text-[12rem] font-black text-white whitespace-nowrap">日本昔ばなし</h1>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-12">
            <div className="text-center flex flex-col gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">이 사이트에서는 음악이 흐릅니다. 재생하시겠습니까?</h2>
              <p className="text-sm text-zinc-400">This site includes background music. Would you like to play it?</p>
            </div>
            <div className="flex gap-8">
              <button onClick={() => handleIntroSelection(true)} className="flex flex-col items-center gap-3 group">
                <div className="w-20 h-20 rounded-full border border-zinc-700 flex items-center justify-center group-hover:bg-white group-hover:text-black group-hover:border-white transition-all duration-300 text-zinc-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10v4a2 2 0 002 2h2.236l5 3V5l-5 3H7a2 2 0 00-2 2z" /></svg>
                </div>
                <span className="text-sm font-bold text-zinc-500 group-hover:text-white transition-colors">ON</span>
              </button>
              <button onClick={() => handleIntroSelection(false)} className="flex flex-col items-center gap-3 group">
                <div className="w-20 h-20 rounded-full border border-zinc-700 flex items-center justify-center group-hover:bg-white group-hover:text-black group-hover:border-white transition-all duration-300 text-zinc-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h2.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                </div>
                <span className="text-sm font-bold text-zinc-500 group-hover:text-white transition-colors">OFF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#0a0a0a] to-[#0a0a0a] pointer-events-none z-0" />
      <canvas ref={canvasRef} className={`fixed top-0 left-0 w-full h-full pointer-events-none z-[105] transition-opacity duration-1000 ${introStep === 2 ? 'opacity-100' : 'opacity-0'}`} />

      {/* ✨ 마우스 추적 커스텀 커서 ✨ */}
      <div ref={cursorRef} className={`fixed top-0 left-0 pointer-events-none z-[110] transition-opacity duration-1000 ${introStep === 2 && viewMode === 'grid' && !isCreateModalOpen && !isModalOpen && !isAuthModalOpen ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative origin-top-left scale-[1.05] drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="50%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#0891b2" /></linearGradient>
              <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e2e8f0" /></linearGradient>
            </defs>
            <g className="animate-spin" style={{ transformOrigin: '40px 12px', animationDuration: '3s' }}>
              <circle cx="40" cy="12" r="10" fill="none" stroke="url(#ringGrad)" strokeWidth="4" filter="url(#cyanGlow)" />
              <circle cx="40" cy="12" r="10" fill="none" stroke="#cffafe" strokeWidth="1" strokeDasharray="3 3" />
            </g>
            <path d="M0 0 L0 25.5 L6 19.5 L12 33 L16.5 31.5 L10.5 18 L18 18 Z" fill="white" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M2 3.5 L2 21.5 L6.5 17 L12.5 29.5 L14 29 L8 16.5 L14.5 16.5 Z" fill="url(#pointerGrad)" />
          </svg>
        </div>
      </div>

      {/* --- GRID VIEW --- */}
      <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${viewMode === 'grid' ? 'opacity-100' : 'opacity-0'}`}>
        <div ref={containerRef} className="absolute top-1/2 left-1/2 will-change-transform z-10">
          <div className="absolute" style={{ transform: `translate(-${dynamicChunkWidth/2}px, -${dynamicChunkHeight/2}px)`}}>
            {offsets.map((y) => (
              offsets.map((x) => (
                <BoardChunk 
                  key={`${x}-${y}`} 
                  cards={cards}
                  cols={dynamicCols}
                  chunkWidth={dynamicChunkWidth}
                  chunkHeight={dynamicChunkHeight}
                  offsetX={x * dynamicChunkWidth} 
                  offsetY={y * dynamicChunkHeight} 
                  onCardClick={handleCardClick} 
                />
              ))
            ))}
          </div>
        </div>
        <div className={`fixed top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex flex-col items-center opacity-30 transition-opacity duration-500`}>
          <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-700 tracking-tighter text-center leading-tight mix-blend-overlay">Drag to<br/>Discover</h1>
        </div>
      </div>

      {/* --- LIST VIEW --- */}
      <ListView data={cards} isVisible={viewMode === 'list'} onCardClick={openModal} />

      {/* --- UI OVERLAYS --- */}
      <div className={`transition-opacity duration-1000 ${introStep === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Logo */}
        <div 
          onClick={handleLogoClick}
          className="fixed top-8 left-10 z-[70] pointer-events-auto select-none flex flex-col items-start transform -skew-x-[12deg] drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all cursor-none"
        >
          <div className="relative z-10 w-fit">
            <h1 className="text-6xl font-black tracking-tighter absolute top-[4px] left-[4px] text-slate-900 whitespace-nowrap z-10" style={{ WebkitTextStroke: '12px #0f172a' }}>ビショジョ</h1>
            <h1 className="text-6xl font-black tracking-tighter relative bg-gradient-to-b from-white via-cyan-300 to-blue-600 bg-clip-text text-transparent whitespace-nowrap z-20" style={{ WebkitTextStroke: '2px #cffafe' }}>ビショジョ</h1>
          </div>
          <div className="relative z-20 ml-12 -mt-3 w-fit">
            <h1 className="text-5xl font-black tracking-tighter absolute top-[4px] left-[4px] text-slate-900 whitespace-nowrap" style={{ WebkitTextStroke: '10px #0f172a' }}>アーカイブ</h1>
            <h1 className="text-5xl font-black tracking-tighter relative bg-gradient-to-b from-blue-100 via-indigo-400 to-purple-600 bg-clip-text text-transparent whitespace-nowrap" style={{ WebkitTextStroke: '2px #e0e7ff' }}>アーカイブ</h1>
          </div>
        </div>

        {/* Nav / Google Authentication Interface */}
        <div className="fixed top-8 right-8 z-[70] flex items-center gap-6 text-[13px] font-bold tracking-widest">
          <button onMouseEnter={playHoverSound} className="text-white/60 hover:text-white transition-colors uppercase cursor-none">About</button>
          <button onMouseEnter={playHoverSound} className="text-white/60 hover:text-white transition-colors uppercase cursor-none">Company</button>
          
          {isAdminMode && (
            user ? (
              <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md py-1.5 pl-2.5 pr-4 rounded-full border border-white/10 select-none transition-all duration-300">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full border border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                ) : (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-cyan-600 shadow-[0_0_8px_rgba(34,211,238,0.5)] border border-cyan-400/30 select-none">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="text-white/80 font-bold text-xs tracking-wider">{user.displayName || 'User'}</span>
                <button 
                  onMouseEnter={playHoverSound} 
                  onClick={handleLogoutClick} 
                  className="cursor-none text-zinc-500 hover:text-red-400 text-[10px] uppercase font-bold ml-2 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onMouseEnter={playHoverSound} 
                onClick={handleLoginClick} 
                className="cursor-none px-5 py-2 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 font-bold text-[11px] uppercase tracking-wider transition-all"
              >
                Sign In
              </button>
            )
          )}
        </div>

        {/* Control Bar */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-8">
          <button onMouseEnter={playHoverSound} onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')} className="cursor-none flex items-center justify-center text-white font-black text-sm tracking-widest transition-transform hover:scale-105 active:scale-95 drop-shadow-md">
            {viewMode === 'grid' ? (
              <><svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>ALL LIST</>
            ) : (
              <><svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>VIEW GRID</>
            )}
          </button>
          
          {/* ✨ Glowing + CREATE CARD Button */}
          {isAdminMode && (
            <button 
              onMouseEnter={playHoverSound} 
              onClick={handleCreateClick} 
              className="cursor-none px-6 py-3 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-500 text-white font-black text-sm tracking-widest shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-transform hover:scale-105 active:scale-95 drop-shadow-md"
            >
              + CREATE CARD
            </button>
          )}
          
          <div className="flex items-center gap-3 p-2 pl-8 bg-gradient-to-r from-zinc-800/90 to-[#1a1a1c]/90 backdrop-blur-2xl border border-white/20 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <span className="text-white/80 font-bold text-sm tracking-widest mr-2">絞り込み</span>
            <button onMouseEnter={playHoverSound} className="cursor-none px-6 py-2.5 rounded-full bg-white text-black font-black text-sm tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95">게임</button>
            <button onMouseEnter={playHoverSound} className="cursor-none px-6 py-2.5 rounded-full bg-white text-black font-black text-sm tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95">애니</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <div className={`fixed inset-x-0 bottom-0 top-20 bg-white rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[100] transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${isModalOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        {activeCard && (
          <>
            <div className="flex justify-end p-6 pb-0">
              <button onClick={closeModal} className="cursor-none flex items-center gap-2 text-zinc-400 hover:text-black font-bold text-sm transition-colors px-4 py-2">
                닫기 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-12 p-10 pt-4 flex-1 overflow-y-auto cursor-none">
              <div className="w-full md:w-1/3 shrink-0">
                <div className="rounded-3xl overflow-hidden border-4 shadow-2xl" style={{ borderColor: activeCard.neonColor }}>
                  <img src={activeCard.imageUrl} alt={activeCard.title} className="w-full h-auto object-cover pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col text-black py-4 pointer-events-none">
                <h2 className="text-5xl font-black mb-6 tracking-tight">{activeCard.title}</h2>
                <div className="flex flex-wrap gap-2 mb-8">
                  {activeCard.tags.map((tag, idx) => (
                    <span key={idx} className="px-4 py-2 text-sm font-bold bg-zinc-100 rounded-xl text-zinc-600 border border-zinc-200">{tag}</span>
                  ))}
                  <span className="px-4 py-2 text-sm font-bold bg-zinc-100 rounded-xl text-zinc-600 border border-zinc-200">Author: {activeCard.author}</span>
                </div>
                <div className="text-zinc-600 leading-relaxed font-medium text-lg space-y-4">
                  {activeCard.description ? (
                    <p className="whitespace-pre-wrap">{activeCard.description}</p>
                  ) : (
                    <>
                      <p>{activeCard.title}를 중심으로 펼쳐지는 환상적인 이야기. 예로부터 전해져 내려오는 민담을 현대적인 감각으로 재해석하여, 남녀노소 누구나 즐길 수 있는 감동적인 서사를 담아냈습니다.</p>
                      <p>이 작품은 특히 색채와 연출 면에서 돋보이며, 캐릭터들의 세밀한 감정선이 깊은 여운을 남깁니다. 잃어버린 동심을 자극하는 아름다운 세계관에 푹 빠져보세요.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dynamic Card Creator Modal */}
      <div 
        className={`fixed inset-0 bg-[#0a0a0af2] backdrop-blur-3xl z-[150] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${isCreateModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex justify-between items-center px-10 py-6 border-b border-zinc-800/50">
          <h2 className="text-2xl font-black bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent tracking-widest uppercase">
            ARCHIVE CARD CREATOR
          </h2>
          <button 
            onClick={handleCloseAndApply} 
            className="cursor-pointer flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors px-4 py-2"
          >
            닫기 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 px-10 py-8 flex-1 overflow-y-auto cursor-auto">
          {/* Left Column: Live Card Preview */}
          <div className="w-full lg:w-[35%] flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-zinc-800/50 pb-8 lg:pb-0 lg:pr-8">
            <span className="text-xs font-black tracking-widest text-zinc-500 mb-6 uppercase">
              LIVE PREVIEW (Hover or Move Mouse over Card)
            </span>
            <div className="transform scale-[1.05] drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              <Card data={previewCardData} onClick={() => {}} />
            </div>
          </div>

          {/* Right Column: Creation Form */}
          <form onSubmit={handleRegisterCard} className="flex-1 flex flex-col gap-6 max-w-4xl pb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  카드 제목 (Title) *
                </label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  placeholder="예: かぐ야姫 (카구야 공주)" 
                  required
                  className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-600 outline-none transition-colors cursor-auto"
                />
              </div>

              {/* Author */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  원화가 / 일러스트 스타일 (Author)
                </label>
                <input 
                  type="text" 
                  value={newAuthor} 
                  onChange={(e) => setNewAuthor(e.target.value)} 
                  placeholder="예: 新海誠スタイル (신카이 마코토 스타일)" 
                  className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-600 outline-none transition-colors cursor-auto"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tags */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  태그 목록 (Tags, 띄어쓰기 또는 쉼표 구분)
                </label>
                <input 
                  type="text" 
                  value={newTags} 
                  onChange={(e) => setNewTags(e.target.value)} 
                  placeholder="예: 신화 로맨스 판타지" 
                  className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-600 outline-none transition-colors cursor-auto"
                />
              </div>

              {/* Neon Theme Color */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  카드 테마 컬러 (Neon Glow Color)
                </label>
                <div className="flex flex-wrap gap-3 p-3 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl justify-start items-center">
                  {NEON_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className="w-8 h-8 rounded-full cursor-pointer relative transition-transform duration-300 hover:scale-110 active:scale-95"
                      style={{
                         backgroundColor: color,
                         boxShadow: newColor === color ? `0 0 16px ${color}, inset 0 0 0 2px white` : `0 0 4px ${color}80`,
                         border: '2px solid transparent'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Image Setup */}
            <div className="flex flex-col gap-4 p-5 bg-zinc-900/20 border border-zinc-800/40 rounded-3xl">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                카드 대표 이미지 설정 (Card Cover Image)
              </label>
              
              <div className="flex bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setNewImageType('seed')}
                  className={`flex-1 cursor-pointer py-2 rounded-lg font-bold text-xs tracking-wider transition-all ${newImageType === 'seed' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  랜덤 고화질 일러스트 생성 (Seed 방식)
                </button>
                <button
                  type="button"
                  onClick={() => setNewImageType('url')}
                  className={`flex-1 cursor-pointer py-2 rounded-lg font-bold text-xs tracking-wider transition-all ${newImageType === 'url' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  외부 이미지 URL 직접 주소 입력
                </button>
              </div>

              {newImageType === 'seed' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    이미지 생성 키워드 / Seed 값 (아무 영어 키워드나 입력하세요)
                  </label>
                  <input 
                    type="text" 
                    value={newImageSeed} 
                    onChange={(e) => setNewImageSeed(e.target.value)} 
                    placeholder="예: cyber, fantasy, princess" 
                    className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-600 outline-none transition-colors cursor-auto"
                  />
                  <p className="text-[10px] text-zinc-500">
                    * 이 값을 변경하면 고유한 시드 기반의 고품질 고화질 이미지가 랜덤하게 자동 생성됩니다.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    일러스트 이미지 URL 주소
                  </label>
                  <input 
                    type="url" 
                    value={newImageUrl} 
                    onChange={(e) => setNewImageUrl(e.target.value)} 
                    placeholder="https://example.com/path-to-image.jpg" 
                    className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-600 outline-none transition-colors cursor-auto"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                작품 상세 설명 및 스토리 (Story Description)
              </label>
              <textarea 
                value={newDescription} 
                onChange={(e) => setNewDescription(e.target.value)} 
                rows="4"
                placeholder="카드를 클릭했을 때 상세 모달에 나타날 아름다운 스토리나 설명을 입력하세요..." 
                className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-600 outline-none transition-colors resize-none cursor-auto"
              />
            </div>

            {/* Submit Button */}
            <button
              type={isSaveSuccess ? "button" : "submit"}
              disabled={isRegistering}
              onClick={(e) => {
                if (isSaveSuccess) {
                  e.preventDefault();
                  handleCloseAndApply();
                }
              }}
              className={`mt-4 w-full py-5 rounded-2xl text-white font-black text-base tracking-widest transition-all duration-300 active:scale-95 ${
                isRegistering 
                  ? 'bg-zinc-800 border border-zinc-700 cursor-not-allowed opacity-50' 
                  : isSaveSuccess
                    ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-600 shadow-[0_8px_30px_rgba(16,185,129,0.35)] hover:scale-[1.01] hover:brightness-110 cursor-pointer'
                    : 'cursor-pointer bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_8px_30px_rgba(6,182,212,0.3)] hover:scale-[1.01] hover:brightness-110'
              }`}
            >
              {isRegistering 
                ? '아카이브 카드를 실시간 저장 중...' 
                : isSaveSuccess
                  ? '🎉 저장 완료! (클릭하여 적용된 화면 확인하기)'
                  : '카드로 아카이브 신규 등록하기 (Register Card)'}
            </button>
          </form>
        </div>
      </div>

      {/* --- Sleek Direct Email/Password Authentication Modal --- */}
      <div 
        className={`fixed inset-0 bg-[#0a0a0af5] backdrop-blur-3xl z-[180] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center ${isAuthModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="w-[430px] bg-[#121214]/80 border border-zinc-800 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-6 cursor-auto">
          
          {/* Close Button */}
          <button 
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute top-6 right-6 cursor-pointer text-zinc-500 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          {/* Heading */}
          <div className="text-center mt-2 select-none">
            <h3 className="text-2xl font-black bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent tracking-widest uppercase">
              {authMode === 'signin' ? 'MEMBER LOGIN' : 'CREATE ACCOUNT'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
              {authMode === 'signin' ? '비쇼조 아카이브 회원 로그인' : '새로운 아카이브 계정 생성'}
            </p>
          </div>

          {/* Error Message Box */}
          {authError && (
            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/50 text-red-400 text-xs font-semibold leading-relaxed select-none">
              {authError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuthSubmit} className="flex flex-col gap-4">
            
            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest select-none">
                이메일 주소 (Email)
              </label>
              <input 
                type="email" 
                required
                value={authEmail} 
                onChange={(e) => setAuthEmail(e.target.value)} 
                placeholder="example@email.com" 
                className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-700 outline-none transition-colors cursor-auto text-sm font-medium"
              />
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest select-none">
                비밀번호 (Password)
              </label>
              <input 
                type="password" 
                required
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)} 
                placeholder="최소 6자 이상" 
                className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-700 outline-none transition-colors cursor-auto text-sm font-medium"
              />
            </div>

            {/* Nickname Input (Only in signup mode) */}
            {authMode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest select-none">
                  사용할 닉네임 (Nickname)
                </label>
                <input 
                  type="text" 
                  required
                  value={authNickname} 
                  onChange={(e) => setAuthNickname(e.target.value)} 
                  placeholder="예: 아카이브마스터" 
                  className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500 rounded-2xl p-4 text-white placeholder-zinc-700 outline-none transition-colors cursor-auto text-sm font-medium"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="cursor-pointer mt-3 w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-black text-sm tracking-widest shadow-[0_4px_20px_rgba(6,182,212,0.25)] transition-all duration-300 hover:brightness-110 active:scale-98"
            >
              {authMode === 'signin' ? '로그인 (LOGIN)' : '가입하기 (SIGN UP)'}
            </button>
          </form>

          {/* Toggle Tab Footer */}
          <div className="text-center text-xs mt-2 border-t border-zinc-800/50 pt-4 select-none">
            {authMode === 'signin' ? (
              <p className="text-zinc-500 font-medium">
                아직 계정이 없으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className="cursor-pointer text-cyan-400 font-bold hover:underline ml-1"
                >
                  회원가입하기
                </button>
              </p>
            ) : (
              <p className="text-zinc-500 font-medium">
                이미 가입된 계정이 있으신가요?{' '}
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                  className="cursor-pointer text-cyan-400 font-bold hover:underline ml-1"
                >
                  로그인하기
                </button>
              </p>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
