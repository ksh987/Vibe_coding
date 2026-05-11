import React, { useState, useRef, useEffect } from 'react';

// --- [Mock Data] ----------------------------------------------------
// 실제 영상과 유사한 분위기를 내기 위해 일본어 텍스트와 임의의 데이터를 사용합니다.
const CARDS_DATA = Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    title: [
        "日本昔ばなし", "雪おんな", "かぐや姫", "浦島太郎",
        "桃太郎", "一寸法師", "さるかに合戦", "鶴の恩返し",
        "おむすびころりん", "金太郎", "花咲か爺さん", "かちかち山"
    ][Math.floor(Math.random() * 12)] + ` Vol.${Math.floor(Math.random() * 10) + 1}`,
    tags: [
        ["神話", "アクション"], ["ドラマ", "悲劇"], ["ファンタジー", "ロマンス"],
        ["コメディ", "日常"], ["ホラー", "サスペンス"], ["歴史", "感動"]
    ][Math.floor(Math.random() * 6)],
    author: ["スタジオジブリ風", "新海誠スタイル", "鳥山明リスペクト", "手塚治虫オマージュ"][Math.floor(Math.random() * 4)],
    color: `hsl(${Math.random() * 360}, 60%, 20%)`,
    // 랜덤 크기를 주어 비대칭 그리드 느낌을 연출
    height: Math.random() > 0.7 ? 'h-96' : 'h-72',
    imageUrl: `https://picsum.photos/seed/${i + 100}/400/600` // Placeholder images
}));

// --- [Components] ---------------------------------------------------

// 1. 개별 카드 컴포넌트 (Mouse-tracking Spotlight 적용)
const Card = ({ data }) => {
    const cardRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // CSS 변수로 마우스 좌표 전달
        cardRef.current.style.setProperty('--mouse-x', `${x}px`);
        cardRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            className={`relative flex flex-col justify-end p-5 rounded-3xl overflow-hidden cursor-pointer group transition-transform duration-300 hover:scale-[1.02] hover:-translate-y-1 ${data.height} w-64 shrink-0`}
            style={{
                backgroundColor: data.color,
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
        >
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-60"
                style={{ backgroundImage: `url(${data.imageUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Hover Spotlight Effect (Pseudo-element 역할) */}
            <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                style={{
                    background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.15), transparent 40%)'
                }}
            />

            {/* Card Content */}
            <div className="relative z-20 text-white flex flex-col gap-2">
                <h3 className="text-xl font-bold leading-tight text-white/90 drop-shadow-md tracking-wide">
                    {data.title}
                </h3>
                <p className="text-xs text-white/60 font-medium">Author: {data.author}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    {data.tags.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-[10px] rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/80">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 2. 메인 애플리케이션 (Infinite Drag Canvas)
export default function App() {
    const containerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // 캔버스 위치 상태 (초기 위치를 살짝 음수로 주어 중앙부터 시작하는 느낌 연출)
    const [position, setPosition] = useState({ x: -400, y: -200 });
    const dragStart = useRef({ x: 0, y: 0 });

    // 드래그 로직 (네이티브 DOM 이벤트를 활용해 부드럽게 처리)
    const handleMouseDown = (e) => {
        // 버튼이나 링크 클릭 시 드래그 방지
        if (e.target.closest('button') || e.target.closest('a')) return;

        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        document.body.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        // RequestAnimationFrame을 사용하면 더 부드럽지만, 리액트 상태 업데이트로도 충분히 훌륭합니다.
        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;

        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = 'default';
    };

    useEffect(() => {
        // 윈도우 밖으로 마우스가 나가도 드래그가 끊기지 않도록 window에 이벤트 추가
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // 그리드를 위한 데이터 분할 (예: 5개씩 묶어서 컬럼 형성)
    const columns = [];
    for (let i = 0; i < CARDS_DATA.length; i += 5) {
        columns.push(CARDS_DATA.slice(i, i + 5));
    }

    return (
        <div
            className="w-screen h-screen overflow-hidden bg-zinc-950 select-none relative font-sans text-zinc-100"
            onMouseDown={handleMouseDown}
        >
            {/* 백그라운드 노이즈/그라데이션 (시각적 깊이감 추가) */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none" />

            {/* Draggable Canvas Area */}
            <div
                ref={containerRef}
                className="absolute top-0 left-0 flex gap-8 p-32 transition-transform duration-75 ease-out"
                style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    willChange: 'transform' // 하드웨어 가속 힌트
                }}
            >
                {/* 중앙에 "Drag to Discover" 안내 문구 배치 */}
                <div className="absolute top-[40%] left-[30%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex flex-col items-center">
                    <svg className="w-16 h-16 text-white/20 animate-bounce mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white/40 to-white/10 tracking-tighter">
                        Drag to<br />Discover
                    </h1>
                </div>

                {/* Staggered Grid Rendering */}
                {columns.map((col, colIdx) => (
                    <div
                        key={colIdx}
                        className="flex flex-col gap-8"
                        // 홀수/짝수 컬럼에 위아래 오프셋을 주어 지그재그(Staggered) 느낌 연출
                        style={{ marginTop: colIdx % 2 === 0 ? '0px' : '100px' }}
                    >
                        {col.map(card => (
                            <Card key={card.id} data={card} />
                        ))}
                    </div>
                ))}
            </div>

            {/* --- Fixed UI Elements --- */}

            {/* Top Left Logo */}
            <div className="fixed top-8 left-8 z-50 pointer-events-none">
                <h1 className="text-3xl font-black tracking-tighter text-white drop-shadow-lg">
                    日本<br />
                    <span className="text-red-500 font-serif">昔ばなし</span>
                </h1>
            </div>

            {/* Top Right Navigation */}
            <nav className="fixed top-8 right-8 z-50 flex gap-6 text-sm font-bold tracking-widest text-white/80">
                <button className="hover:text-white transition-colors uppercase">About</button>
                <button className="hover:text-white transition-colors uppercase">Company</button>
                <button className="hover:text-white transition-colors uppercase">News</button>
                <button className="hover:text-white transition-colors uppercase">Contact</button>
            </nav>

            {/* Bottom Center Glassmorphism Control Bar */}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                <div className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                    <button className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm tracking-wide shadow-lg transition-transform hover:scale-105 active:scale-95">
                        ALL LIST
                    </button>
                    <button className="px-6 py-3 rounded-full text-white/80 hover:bg-white/10 hover:text-white font-medium text-sm transition-all">
                        作品別まとめ (By Work)
                    </button>
                    <button className="px-6 py-3 rounded-full text-white/80 hover:bg-white/10 hover:text-white font-medium text-sm transition-all">
                        ジャンル (Genre)
                    </button>
                </div>
            </div>

        </div>
    );
}