import { useState, useMemo, useEffect, useRef } from 'react';
import { SyncStatus } from '../types';

interface ThumbnailItem {
  id: string;
  mediaType: 'photo' | 'video';
  thumbnail?: Blob;
  blob: Blob;
  syncStatus: SyncStatus;
  capturedAt: number;
}

interface ThumbnailStripProps {
  items: ThumbnailItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onUploadSelected?: () => void;
  isSyncing?: boolean;
  selectedCount?: number;
}

function useBlobUrls(items: ThumbnailItem[]) {
  const cacheRef = useRef<Map<string, string>>(new Map());

  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const existing = cacheRef.current.get(item.id);
      if (existing) {
        map.set(item.id, existing);
      } else {
        const blob = item.thumbnail || item.blob;
        if (blob) {
          map.set(item.id, URL.createObjectURL(blob));
        }
      }
    }
    for (const [id, url] of cacheRef.current) {
      if (!map.has(id)) URL.revokeObjectURL(url);
    }
    cacheRef.current = map;
    return map;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    };
  }, []);

  return urls;
}

type ViewMode = 'collapsed' | 'grid' | 'viewer';

export function ThumbnailStrip({ items, selectedIds, onToggleSelect, onUploadSelected, isSyncing, selectedCount: propSelectedCount }: ThumbnailStripProps) {
  const [mode, setMode] = useState<ViewMode>('collapsed');
  const [viewerIndex, setViewerIndex] = useState(0);
  const urlMap = useBlobUrls(items);

  useEffect(() => {
    if (mode !== 'viewer') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setViewerIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setViewerIndex(i => Math.min(items.length - 1, i + 1));
      if (e.key === 'Escape') setMode('grid');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, items.length]);

  if (items.length === 0) return null;

  const selectedCount = propSelectedCount ?? items.filter(i => selectedIds.has(i.id)).length;

  // Collapsed: stacked card pile
  if (mode === 'collapsed') {
    const topItems = items.slice(-3).reverse();
    return (
      <button
        onClick={() => setMode('grid')}
        style={{
          position: 'relative',
          width: 64,
          height: 64,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
          flexShrink: 0,
        }}
      >
        {topItems.map((item, i) => {
          const url = urlMap.get(item.id);
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                bottom: i * 3,
                left: i * 2,
                width: 56 - i * 4,
                height: 56 - i * 4,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#1a1a1a',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                zIndex: i,
              }}
            >
              {url ? (
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
        <div style={{
          position: 'absolute', top: -4, right: -4,
          minWidth: 22, height: 22, borderRadius: 11,
          background: '#eab308', color: '#000', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', zIndex: 10,
        }}>
          {items.length}
        </div>
        {selectedCount > 0 && selectedCount < items.length && (
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            minWidth: 22, height: 22, borderRadius: 11,
            background: '#fff', color: '#000', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', zIndex: 10,
          }}>
            {selectedCount}
          </div>
        )}
      </button>
    );
  }

  // Full-screen viewer
  if (mode === 'viewer') {
    return (
      <PhotoViewer
        items={items}
        currentIndex={viewerIndex}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onIndexChange={setViewerIndex}
        onClose={() => setMode('grid')}
      />
    );
  }

  // Grid gallery
  return (
    <>
      <div onClick={() => setMode('collapsed')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50 }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '75vh',
        background: '#111', borderTopLeftRadius: 16, borderTopRightRadius: 16,
        zIndex: 55, display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid #222',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
              {items.length} photo{items.length !== 1 ? 's' : ''}
            </span>
            {selectedCount > 0 && (
              <span style={{ fontSize: 13, color: '#eab308' }}>
                {selectedCount} selected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedCount > 0 && onUploadSelected && (
              <button
                onClick={() => {
                  onUploadSelected();
                  setMode('collapsed');
                }}
                disabled={isSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 20,
                  background: '#eab308', border: 'none',
                  color: '#000', fontSize: 14, fontWeight: 600,
                  cursor: isSyncing ? 'wait' : 'pointer',
                  opacity: isSyncing ? 0.6 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isSyncing ? 'Uploading...' : `Upload ${selectedCount}`}
              </button>
            )}
            <button
              onClick={() => setMode('collapsed')}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer', padding: '4px 8px' }}
            >
              Done
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {items.map((item) => {
              const url = urlMap.get(item.id);
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(item.id);
                  }}
                >
                  {url ? (
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  <div
                    style={{
                      position: 'absolute', top: 6, left: 6,
                      width: 32, height: 32, borderRadius: '50%',
                      border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.8)',
                      background: isSelected ? '#eab308' : 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none', zIndex: 2,
                    }}
                  >
                    {isSelected && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {item.mediaType === 'video' && (
                    <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, pointerEvents: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  )}

                  <div style={{
                    position: 'absolute', bottom: 6, right: 6,
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: item.syncStatus === 'staged' ? '#22c55e' : item.syncStatus === 'uploading' ? '#3b82f6' : item.syncStatus === 'failed' ? '#ef4444' : '#eab308',
                    border: '2px solid rgba(0,0,0,0.5)', zIndex: 2,
                    pointerEvents: 'none',
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

interface PhotoViewerProps {
  items: ThumbnailItem[];
  currentIndex: number;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

function PhotoViewer({ items, currentIndex, selectedIds, onToggleSelect, onIndexChange, onClose }: PhotoViewerProps) {
  const currentItem = items[currentIndex];
  const isSelected = selectedIds.has(currentItem.id);

  const fullUrl = useMemo(() => {
    return currentItem.blob ? URL.createObjectURL(currentItem.blob) : undefined;
  }, [currentItem]);

  useEffect(() => {
    return () => { if (fullUrl) URL.revokeObjectURL(fullUrl); };
  }, [fullUrl]);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
      setSwipeOffset(0);
    };

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStart.current.x;
      const dy = e.touches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        e.preventDefault();
        setSwipeOffset(dx);
      }
    };

    const onEnd = () => {
      const elapsed = Date.now() - touchStart.current.time;
      setSwipeOffset(prev => {
        if (Math.abs(prev) > 60 || (Math.abs(prev) > 30 && elapsed < 200)) {
          if (prev < 0 && currentIndex < items.length - 1) {
            setTimeout(() => onIndexChange(currentIndex + 1), 0);
          } else if (prev > 0 && currentIndex > 0) {
            setTimeout(() => onIndexChange(currentIndex - 1), 0);
          }
        }
        return 0;
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [currentIndex, items.length, onIndexChange]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 70,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        paddingBottom: 8, paddingLeft: 16, paddingRight: 16,
        background: 'linear-gradient(rgba(0,0,0,0.7), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 5,
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
          width: 36, height: 36, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500 }}>
          {currentIndex + 1} of {items.length}
        </span>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          touchAction: 'pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {fullUrl ? (
          <img
            src={fullUrl}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }}
            draggable={false}
          />
        ) : (
          <div style={{ color: '#666', fontSize: 16 }}>Loading...</div>
        )}
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        paddingTop: 16, paddingLeft: 16, paddingRight: 16,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
        zIndex: 5,
      }}>
        <button
          onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentIndex === 0 ? 'default' : 'pointer',
            opacity: currentIndex === 0 ? 0.3 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => onToggleSelect(currentItem.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 24,
            background: isSelected ? '#eab308' : 'rgba(255,255,255,0.15)',
            color: isSelected ? '#000' : '#fff',
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isSelected ? '#000' : 'none'} stroke={isSelected ? '#000' : '#fff'} strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {isSelected ? 'Selected' : 'Select'}
        </button>

        {currentItem.syncStatus === 'staged' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 16,
            background: 'rgba(74,222,128,0.15)', color: '#4ade80',
            fontSize: 12, fontWeight: 500,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Uploaded
          </div>
        )}

        <button
          onClick={() => onIndexChange(Math.min(items.length - 1, currentIndex + 1))}
          disabled={currentIndex === items.length - 1}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentIndex === items.length - 1 ? 'default' : 'pointer',
            opacity: currentIndex === items.length - 1 ? 0.3 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
