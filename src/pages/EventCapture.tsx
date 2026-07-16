import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EntryForm } from '../components/EntryForm';
import { CameraCapture } from '../components/CameraCapture';
import { OfflineBanner } from '../components/OfflineBanner';
import { useMediaStore } from '../hooks/useMediaStore';
import { createSession, fetchSessionMedia } from '../lib/api';
import { ContactMethod } from '../types';
import * as db from '../lib/db';

export function EventCapture() {
  const { eventId } = useParams<{ eventId: string }>();
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [eventName, setEventName] = useState('Event Candid Capture');

  const store = useMediaStore(guestSessionId || '');
  const {
    items,
    capturePhoto,
    captureVideo,
    uploadSelected,
    syncing,
    storageError,
    clearStorageError,
    syncMessage,
    selectedIds,
    selectedCount,
    toggleSelect,
    confirmState,
    resolveConfirm,
    refresh,
  } = store;

  const syncRemoteMedia = async (sessionId: string) => {
    try {
      const remoteItems = await fetchSessionMedia(sessionId);
      if (remoteItems.length === 0) return;

      console.log(`[Sync] Found ${remoteItems.length} remote items, syncing to local...`);
      let synced = 0;

      for (const remote of remoteItems) {
        const existing = await db.getMedia(remote.id);
        if (existing) continue;
        if (!remote.signed_url) continue;

        try {
          const resp = await fetch(remote.signed_url);
          if (!resp.ok) continue;
          const blob = await resp.blob();

          const localItem = {
            id: remote.id,
            guestSessionId: sessionId,
            mediaType: remote.media_type as 'photo' | 'video',
            blob,
            capturedAt: new Date(remote.captured_at).getTime(),
            syncStatus: 'staged' as const,
            retryCount: 0,
            nextRetryAt: 0,
          };

          await db.addMedia(localItem);
          synced++;
        } catch (e) {
          console.warn(`[Sync] Failed to download remote item ${remote.id}:`, e);
        }
      }

      if (synced > 0) {
        console.log(`[Sync] Synced ${synced} remote items to local storage`);
        await refresh();
      }
    } catch (e) {
      console.warn('[Sync] Failed to sync remote media:', e);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    const existingSession = localStorage.getItem(`session_${eventId}`);
    if (existingSession) {
      setGuestSessionId(existingSession);
      syncRemoteMedia(existingSession);
    }
  }, [eventId]);

  useEffect(() => {
    if (guestSessionId) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [guestSessionId]);

  const handleEntrySubmit = async (contactMethod: ContactMethod, contactValue: string) => {
    if (!eventId) return;

    setIsInitializing(true);
    try {
      const result = await createSession(eventId, contactMethod, contactValue);

      localStorage.setItem(`session_${eventId}`, result.session_id);
      setGuestSessionId(result.session_id);
      setEventName(result.event_name);

      if (result.is_existing) {
        syncRemoteMedia(result.session_id);
      }
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
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <OfflineBanner />

      <CameraCapture
        onCapturePhoto={capturePhoto}
        onCaptureVideo={captureVideo}
        onUploadSelected={uploadSelected}
        isSyncing={syncing}
        syncMessage={syncMessage}
        items={items}
        selectedIds={selectedIds}
        selectedCount={selectedCount}
        onToggleSelect={toggleSelect}
        confirmState={confirmState}
        onResolveConfirm={resolveConfirm}
      />

      {storageError && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          background: '#1a1a1a',
          borderTop: '1px solid #333',
          zIndex: 10000,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 14, color: '#facc15' }}>{storageError}</p>
            <button
              onClick={clearStorageError}
              style={{ color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={uploadSelected}
            disabled={syncing}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '8px 0',
              background: '#ca8a04',
              color: '#000',
              fontWeight: 500,
              borderRadius: 8,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {syncing ? 'Uploading...' : 'Upload Now to Free Space'}
          </button>
        </div>
      )}
    </div>
  );
}
