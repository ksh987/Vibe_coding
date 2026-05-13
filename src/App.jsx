import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

// --- [Mock Data & Constants] ---
// 카드 넓이(260)+간격(60) * 5열 = 1600, 카드 높이(360)+간격(60) * 5행 = 2100 (빈틈없는 타일링을 위한 계산)
const CHUNK_WIDTH = 1600;
const CHUNK_HEIGHT = 2100;

const CARDS_DATA = Array.from({ length: 25 }).map((_, i) => {
  return {
    id: i,
    title: ["日本昔ばなし", "雪おんな", "かぐや姫", "浦島太郎", "桃太郎", "さるかに合戦"][Math.floor(Math.random() * 6)] + ` Vol.${i + 1}`,
    tags: ["神話", "アクション", "ファン타지", "로맨스", "코미디", "역사"].slice(0, Math.floor(Math.random() * 2) + 1),
    author: ["スタジオジブリ風", "新海誠スタイル", "鳥山明リスペクト", "手塚治虫オ마쥬"][Math.floor(Math.random() * 4)],
    imageUrl: `https://picsum.photos/seed/${i + 500}/400/600`
  };
});

// 청크 내부의 컬럼 배치 (5열)
const COLUMNS = [[], [], [], [], []];
CARDS_DATA.forEach((card, i) => {
  COLUMNS[i % 5].push(card);
});

// --- [Components] ---

// 1. 개별 카드 컴포넌트 (Neon Border & Surface Glow)
const Card = ({ data }) => {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative p-[1px] rounded-[32px] overflow-hidden cursor-pointer group transition-transform duration-500 ease-out hover:scale-[1.03] hover:-translate-y-2 shrink-0 w-[260px] h-[360px]`}
      style={{ boxShadow: '0 15px 35px -10px rgba(0,0,0,0.6)' }}
    >
      {/* 1. Neon Glow Border Layer */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"
        style={{
          background: 'radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.8), transparent 40%)'
        }}
      />

      {/* 2. Inner Content Wrapper */}
      <div className="relative z-10 w-full h-full bg-[#111113] rounded-[31px] overflow-hidden flex flex-col justify-end p-6">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-50"
          style={{ backgroundImage: `url(${data.imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

        {/* 3. Surface Spotlight */}
        <div 
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
          style={{
            background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.1), transparent 40%)'
          }}
        />
        
        <div className="relative z-20 text-white flex flex-col gap-2">
          <h3 className="text-2xl font-bold leading-tight text-white/95 drop-shadow-md tracking-wide">
            {data.title}
          </h3>
          <p className="text-xs text-white/50 font-medium">Author: {data.author}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.tags.map((tag, idx) => (
              <span key={idx} className="px-3 py-1 text-[11px] font-medium rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/70">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 무한 루프 반복 단위 블록
const BoardChunk = ({ offsetX, offsetY }) => {
  return (
    <div 
      className="absolute top-0 left-0 flex pointer-events-auto gap-[60px]"
      style={{ 
        width: `${CHUNK_WIDTH}px`, height: `${CHUNK_HEIGHT}px`,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    >
      {COLUMNS.map((col, colIdx) => (
        <div 
          key={colIdx} className="flex flex-col gap-[60px]"
          style={{ marginTop: colIdx % 2 === 0 ? '0px' : '150px' }}
        >
          {col.map(card => <Card key={card.id} data={card} />)}
        </div>
      ))}
    </div>
  );
};

// 2. 메인 애플리케이션 (Physics Engine & Infinite Loop)
export default function App() {
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const requestRef = useRef();

  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const mousePos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    mousePos.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - mousePos.current.x;
    const deltaY = e.clientY - mousePos.current.y;
    velocity.current = { x: deltaX, y: deltaY };
    target.current.x += deltaX;
    target.current.y += deltaY;
    mousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  };

  const updatePhysics = () => {
    if (!isDragging.current) {
      target.current.x += velocity.current.x;
      target.current.y += velocity.current.y;
      velocity.current.x *= 0.93; // Friction
      velocity.current.y *= 0.93;
    }

    current.current.x += (target.current.x - current.current.x) * 0.15; // Lerp
    current.current.y += (target.current.y - current.current.y) * 0.15;

    let wrapX = current.current.x % CHUNK_WIDTH;
    let wrapY = current.current.y % CHUNK_HEIGHT;

    if (wrapX > CHUNK_WIDTH / 2) wrapX -= CHUNK_WIDTH;
    if (wrapX < -CHUNK_WIDTH / 2) wrapX += CHUNK_WIDTH;
    if (wrapY > CHUNK_HEIGHT / 2) wrapY -= CHUNK_HEIGHT;
    if (wrapY < -CHUNK_HEIGHT / 2) wrapY += CHUNK_HEIGHT;

    if (current.current.x - wrapX !== 0) target.current.x -= (current.current.x - wrapX);
    if (current.current.y - wrapY !== 0) target.current.y -= (current.current.y - wrapY);
    
    current.current.x = wrapX;
    current.current.y = wrapY;

    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0)`;
    }
    requestRef.current = requestAnimationFrame(updatePhysics);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    requestRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const offsets = [-1, 0, 1];

  return (
    <div className="w-screen h-screen overflow-hidden bg-black select-none relative font-sans text-zinc-100" onMouseDown={handleMouseDown}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black pointer-events-none z-0" />

      {/* Physics Wrapper */}
      <div ref={containerRef} className="absolute top-1/2 left-1/2 will-change-transform z-10">
        <div className="absolute" style={{ transform: `translate(-${CHUNK_WIDTH/2}px, -${CHUNK_HEIGHT/2}px)`}}>
          {offsets.map((y) => (
            offsets.map((x) => (
              <BoardChunk key={`${x}-${y}`} offsetX={x * CHUNK_WIDTH} offsetY={y * CHUNK_HEIGHT} />
            ))
          ))}
        </div>
      </div>

      <div className="fixed top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex flex-col items-center opacity-40">
        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-600 tracking-tighter text-center leading-tight">
          Drag to<br/>Discover
        </h1>
      </div>

      <div className="fixed top-8 left-8 z-50 pointer-events-none">
        <h1 className="text-3xl font-black tracking-tighter text-white drop-shadow-xl">
          日本<br/><span className="text-[#e63946] font-serif">昔ばなし</span>
        </h1>
      </div>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 p-2 bg-[#1a1a1c]/80 backdrop-blur-2xl border border-white/5 rounded-full shadow-2xl">
          <button className="px-8 py-3.5 rounded-full bg-white text-black font-black text-xs tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95">
            ALL LIST
          </button>
          <button className="px-6 py-3.5 rounded-full text-white/60 hover:bg-white/10 hover:text-white font-bold text-xs tracking-widest transition-all">
            作品別 (By Work)
          </button>
        </div>
      </div>
    </div>
  );
}
