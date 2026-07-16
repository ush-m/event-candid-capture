import { useCamera } from '../hooks/useCamera';
import { ThumbnailStrip } from './ThumbnailStrip';
import { LocalMediaItem } from '../types';
import { ConfirmState } from '../hooks/useMediaStore';

interface CameraCaptureProps {
  onCapturePhoto: (blob: Blob) => Promise<boolean>;
  onCaptureVideo: (blob: Blob) => Promise<boolean>;
  onUploadSelected: () => void;
  isSyncing: boolean;
  syncMessage: string | null;
  items: LocalMediaItem[];
  selectedIds: Set<string>;
  selectedCount: number;
  onToggleSelect: (id: string) => void;
  confirmState: ConfirmState | null;
  onResolveConfirm: (value: boolean) => void;
}

export function CameraCapture({
  onCapturePhoto,
  onCaptureVideo,
  onUploadSelected,
  isSyncing,
  syncMessage,
  items,
  selectedIds,
  selectedCount,
  onToggleSelect,
  confirmState,
  onResolveConfirm,
}: CameraCaptureProps) {
  const {
    videoRef,
    isInitialized,
    error,
    switchCamera,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    recordingDuration,
    facingMode,
  } = useCamera();

  const handlePhoto = async () => {
    const blob = await takePhoto();
    if (blob) {
      await onCapturePhoto(blob);
    }
  };

  const handleVideoToggle = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        await onCaptureVideo(blob);
      }
    } else {
      startRecording();
    }
  };

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Camera Access Required</h2>
          <p style={{ color: '#999', maxWidth: 300, margin: '0 auto 16px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', background: '#fff', color: '#000', borderRadius: 8, fontWeight: 500, border: 'none', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', color: '#fff', zIndex: 9999, overflow: 'hidden' }}>
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* Loading overlay */}
      {!isInitialized && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ color: '#999' }}>Initializing camera...</p>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: '#dc2626', padding: '4px 12px', borderRadius: 20, zIndex: 15 }}>
          <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{recordingDuration}s</span>
        </div>
      )}

      {/* Switch camera button - top right */}
      <button
        onClick={switchCamera}
        disabled={isRecording}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          zIndex: 14,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          border: 'none',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* Sync status toast */}
      {syncMessage && (
        <div style={{
          position: 'absolute',
          top: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '8px 20px',
          borderRadius: 20,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 20,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {syncMessage}
        </div>
      )}

      {/* Bottom controls */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        paddingTop: 24,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          {/* Stacked thumbnail bundle */}
          <ThumbnailStrip
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onUploadSelected={onUploadSelected}
            isSyncing={isSyncing}
            selectedCount={selectedCount}
          />

          {/* Upload selected button */}
          <button
            onClick={() => {
              console.log('[CameraCapture] Upload selected clicked, count:', selectedCount, 'isSyncing:', isSyncing);
              onUploadSelected();
            }}
            disabled={isSyncing || selectedCount === 0}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: selectedCount > 0 && !isSyncing ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSyncing ? 'wait' : 'pointer',
              position: 'relative',
              opacity: isSyncing ? 0.6 : selectedCount === 0 ? 0.4 : 1,
            }}
          >
            {isSyncing ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {selectedCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, background: '#eab308', color: '#000', fontSize: 11, fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedCount > 99 ? '99+' : selectedCount}
              </span>
            )}
          </button>

          {/* PHOTO BUTTON */}
          <button
            onClick={handlePhoto}
            disabled={!isInitialized || isRecording}
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: '#fff',
              border: '4px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0,0,0,0.5)',
              opacity: (!isInitialized || isRecording) ? 0.5 : 1,
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid #000' }} />
          </button>

          {/* VIDEO BUTTON */}
          <button
            onClick={handleVideoToggle}
            disabled={!isInitialized}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: isRecording ? '#dc2626' : 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: !isInitialized ? 0.5 : 1,
            }}
          >
            {isRecording ? (
              <div style={{ width: 18, height: 18, background: '#fff', borderRadius: 3 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid #ef4444' }} />
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Confirm modal */}
      {confirmState && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 24,
        }}>
          <div style={{
            background: '#1a1a1a', borderRadius: 16, padding: 24,
            maxWidth: 320, width: '100%', textAlign: 'center',
            border: '1px solid #333',
          }}>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 500, marginBottom: 20, lineHeight: 1.4 }}>
              {confirmState.message}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => onResolveConfirm(false)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => onResolveConfirm(true)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10,
                  background: '#eab308', border: 'none',
                  color: '#000', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Yes, Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
