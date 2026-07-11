import { useState } from 'react';

interface MediaItem {
  id: string;
  media_type: 'photo' | 'video';
  url: string | null;
  captured_at: string;
}

interface SelectionGridProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function SelectionGrid({ items, selectedIds, onToggle }: SelectionGridProps) {
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 pb-24">
        {items.map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                isSelected ? 'border-white' : 'border-transparent'
              }`}
              onClick={() => onToggle(item.id)}
            >
              {item.url ? (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {item.media_type === 'video' && (
                <div className="absolute bottom-2 left-2">
                  <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewItem(item);
                }}
                className="absolute bottom-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setPreviewItem(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {previewItem.url && (
            <img
              src={previewItem.url}
              alt=""
              className="max-w-full max-h-[80vh] object-contain"
            />
          )}

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(previewItem.id);
              }}
              className={`px-6 py-3 rounded-lg font-medium ${
                selectedIds.has(previewItem.id)
                  ? 'bg-white text-black'
                  : 'bg-gray-700 text-white'
              }`}
            >
              {selectedIds.has(previewItem.id) ? 'Selected' : 'Select'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
