import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EntryForm } from '../components/EntryForm';
import { CameraCapture } from '../components/CameraCapture';
import { ThumbnailStrip } from '../components/ThumbnailStrip';
import { OfflineBanner } from '../components/OfflineBanner';
import { useMediaStore } from '../hooks/useMediaStore';
import { createSession } from '../lib/api';
import { ContactMethod } from '../types';

export function EventCapture() {
  const { eventId } = useParams<{ eventId: string }>();
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [eventName, setEventName] = useState('Event Candid Capture');

  const {
    items,
    capturePhoto,
    captureVideo,
    triggerSync,
    syncing,
    pendingCount,
    storageError,
    clearStorageError,
  } = useMediaStore(guestSessionId || '');

  useEffect(() => {
    if (!eventId) return;
    
    const existingSession = localStorage.getItem(`session_${eventId}`);
    if (existingSession) {
      setGuestSessionId(existingSession);
    }
  }, [eventId]);

  const handleEntrySubmit = async (contactMethod: ContactMethod, contactValue: string) => {
    if (!eventId) return;
    
    setIsInitializing(true);
    try {
      const result = await createSession(eventId, contactMethod, contactValue);
      
      localStorage.setItem(`session_${eventId}`, result.session_id);
      setGuestSessionId(result.session_id);
      setEventName(result.event_name);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert('Failed to connect. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  if (!eventId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Invalid event link.</p>
      </div>
    );
  }

  if (!guestSessionId) {
    return (
      <EntryForm
        eventName={eventName}
        onSubmit={handleEntrySubmit}
        isLoading={isInitializing}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <OfflineBanner />
      <div className="p-3">
        <ThumbnailStrip items={items} />
      </div>

      <CameraCapture
        onCapturePhoto={capturePhoto}
        onCaptureVideo={captureVideo}
        onSyncRequest={triggerSync}
        pendingCount={pendingCount}
        isSyncing={syncing}
      />

      {storageError && (
        <div className="fixed inset-x-0 bottom-0 p-4 bg-gray-900 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-400">{storageError}</p>
            <button
              onClick={clearStorageError}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="mt-2 w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-black font-medium rounded-lg text-sm"
          >
            {syncing ? 'Uploading...' : 'Upload Now to Free Space'}
          </button>
        </div>
      )}
    </div>
  );
}
