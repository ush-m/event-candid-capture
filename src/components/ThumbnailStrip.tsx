import { SyncStatus } from '../types';

interface ThumbnailStripProps {
  items: {
    id: string;
    mediaType: 'photo' | 'video';
    thumbnail?: Blob;
    blob: Blob;
    syncStatus: SyncStatus;
    capturedAt: number;
  }[];
}

const statusColors: Record<SyncStatus, string> = {
  pending: 'bg-yellow-500',
  uploading: 'bg-blue-500',
  staged: 'bg-green-500',
  failed: 'bg-red-500',
};

const statusLabels: Record<SyncStatus, string> = {
  pending: 'Waiting to upload',
  uploading: 'Uploading...',
  staged: 'Uploaded',
  failed: 'Upload failed',
};

export function ThumbnailStrip({ items }: ThumbnailStripProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin">
      {items.map((item) => {
        const thumbnailUrl = item.thumbnail
          ? URL.createObjectURL(item.thumbnail)
          : item.mediaType === 'photo'
          ? URL.createObjectURL(item.blob)
          : undefined;

        return (
          <div
            key={item.id}
            className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-800"
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onLoad={() => {
                  if (item.thumbnail) URL.revokeObjectURL(thumbnailUrl);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            
            <div
              className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ${statusColors[item.syncStatus]}`}
              title={statusLabels[item.syncStatus]}
            />
            
            {item.mediaType === 'video' && (
              <div className="absolute top-1 left-1">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
