import React, { useState, useRef, useEffect } from 'react';

// --- [Mock Data] ----------------------------------------------------
const CARDS_DATA = Array.from({ length: 40 }).map((_, i) => ({
  id: i,
  title: [
    "日本昔ばなし", "雪おんな", "かぐや姫", "浦島太郎",
    "桃太郎", "一寸法師", "さるかに合戦", "鶴の恩返し",
    "おむすびころりん", "金太郎", "花咲か爺さん", "かちかち山"
  ][i % 12] + ` Vol.${(i % 10) + 1}`,
  tags: [
    ["神話", "アクション"], ["ドラマ", "悲劇"], ["ファンタジー", "ロマンス"],
    ["コメディ", "日常"], ["ホラー", "サスペンス"], ["歴史", "感動"]
  ][i % 6],
  author: ["スタジオジブリ風", "新海誠スタイル", "鳥山明リスペクト", "手塚治虫オマージュ"][i % 4],
  color: `hsl(${(i * 37) % 360}, 60%, 15%)`,
  tall: i % 3 === 0,
  imageUrl: `https://picsum.photos/seed/${i + 100}/400/600`
}));

// --- [Components] ---------------------------------------------------

// 1. 개별 카드 컴포넌트 (Mouse-tracking Spotlight)
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
      className="card-wrapper"
      style={{
        backgroundColor: data.color,
        height: data.tall ? '24rem' : '18rem',
      }}
    >
      {/* Background Image */}
      <div
        className="card-bg"
        style={{ backgroundImage: `url(${data.imageUrl})` }}
      />
      {/* Gradient overlay */}
      <div className="card-overlay" />
      {/* Spotlight effect */}
      <div className="card-spotlight" />
      {/* Card Content */}
      <div className="card-content">
        <h3 className="card-title">{data.title}</h3>
        <p className="card-author">Author: {data.author}</p>
        <div className="card-tags">
          {data.tags.map((tag, idx) => (
            <span key={idx} className="card-tag">{tag}</span>
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
  const [position, setPosition] = useState({ x: -400, y: -200 });
  const dragStart = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: -400, y: -200 });

  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      posRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY });
    };
    const onUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // 5개씩 컬럼 분할
  const columns = [];
  for (let i = 0; i < CARDS_DATA.length; i += 5) {
    columns.push(CARDS_DATA.slice(i, i + 5));
  }

  return (
    <div className="canvas-root" onMouseDown={handleMouseDown}>
      {/* Background radial gradient */}
      <div className="canvas-bg" />

      {/* Draggable Canvas */}
      <div
        ref={containerRef}
        className="canvas-inner"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          willChange: 'transform',
        }}
      >
        {/* Drag to Discover 안내 */}
        <div className="discover-hint">
          <svg className="discover-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span className="discover-text">Drag to<br />Discover</span>
        </div>

        {/* Staggered Grid */}
        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            className="canvas-column"
            style={{ marginTop: colIdx % 2 === 0 ? '0px' : '100px' }}
          >
            {col.map(card => (
              <Card key={card.id} data={card} />
            ))}
          </div>
        ))}
      </div>

      {/* Fixed UI: Top Left Logo */}
      <div className="ui-logo">
        <span className="ui-logo-jp">日本</span>
        <span className="ui-logo-red">昔ばなし</span>
      </div>

      {/* Fixed UI: Top Right Nav */}
      <nav className="ui-nav">
        {['About', 'Company', 'News', 'Contact'].map(item => (
          <button key={item} className="ui-nav-btn">{item}</button>
        ))}
      </nav>

      {/* Fixed UI: Bottom Glassmorphism Bar */}
      <div className="ui-bar-wrapper">
        <div className="ui-bar">
          <button className="ui-bar-btn-active">ALL LIST</button>
          <button className="ui-bar-btn">作品別まとめ (By Work)</button>
          <button className="ui-bar-btn">ジャンル (Genre)</button>
        </div>
      </div>
    </div>
  );
}
