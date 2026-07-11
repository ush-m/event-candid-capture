import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getReviewSession, finalizeSession } from '../../lib/api';
import { SelectionGrid } from './SelectionGrid';
import { ConfirmationScreen } from './ConfirmationScreen';

interface MediaItem {
  id: string;
  media_type: 'photo' | 'video';
  url: string | null;
  captured_at: string;
}

interface ReviewData {
  session_id: string;
  event_name: string;
  already_completed: boolean;
  media: MediaItem[];
}

export function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReviewData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<{ selectedCount: number; mode: 'save_and_share' | 'share_only' } | null>(null);

  useEffect(() => {
    if (token) loadSession();
  }, [token]);

  const loadSession = async () => {
    if (!token) return;
    try {
      const reviewData = await getReviewSession(token);
      setData(reviewData);
      if (reviewData.already_completed) {
        setCompleted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!data) return;
    setSelectedIds(new Set(data.media.map((m) => m.id)));
  }, [data]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleFinalize = async (mode: 'save_and_share' | 'share_only') => {
    if (!data || selectedIds.size === 0) return;
    
    setSubmitting(true);
    try {
      const response = await finalizeSession(
        data.session_id,
        Array.from(selectedIds),
        mode
      );
      
      setResult({
        selectedCount: response.selected_count,
        mode,
      });
      setCompleted(true);

      // If save_and_share, offer download
      if (mode === 'save_and_share') {
        downloadSelectedMedia();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSelectedMedia = async () => {
    if (!data) return;
    
    // Dynamic import JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const item of data.media) {
      if (!selectedIds.has(item.id) || !item.url) continue;
      
      try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const ext = item.media_type === 'video' ? 'webm' : 'jpg';
        zip.file(`${item.id}.${ext}`, blob);
      } catch (err) {
        console.error(`Failed to download ${item.id}:`, err);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.event_name.replace(/[^a-zA-Z0-9]/g, '_')}_photos.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Loading your photos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <svg className="w-16 h-16 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (completed) {
    return (
      <ConfirmationScreen
        eventName={data.event_name}
        selectedCount={result?.selectedCount || 0}
        mode={result?.mode || 'share_only'}
        alreadyCompleted={data.already_completed}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-semibold">{data.event_name}</h1>
          <p className="text-sm text-gray-400">
            Select photos to share ({selectedIds.size} of {data.media.length} selected)
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg"
            >
              Select None
            </button>
          </div>
        </div>

        {data.media.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">No photos found</p>
          </div>
        ) : (
          <SelectionGrid
            items={data.media}
            selectedIds={selectedIds}
            onToggle={toggleSelection}
          />
        )}

        {selectedIds.size > 0 && (
          <div className="fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-700 p-4">
            <div className="max-w-4xl mx-auto flex gap-3">
              <button
                onClick={() => handleFinalize('save_and_share')}
                disabled={submitting}
                className="flex-1 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Save & Share'}
              </button>
              <button
                onClick={() => handleFinalize('share_only')}
                disabled={submitting}
                className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Share Only'}
              </button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">
              Save &amp; Share: you get a download + organizer gets a copy
            </p>
            <p className="text-center text-xs text-gray-500">
              Share Only: only the organizer receives your selection
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
