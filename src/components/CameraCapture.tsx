import { useCamera } from '../hooks/useCamera';

interface CameraCaptureProps {
  onCapturePhoto: (blob: Blob) => Promise<boolean>;
  onCaptureVideo: (blob: Blob) => Promise<boolean>;
  onSyncRequest: () => void;
  pendingCount: number;
  isSyncing: boolean;
}

export function CameraCapture({
  onCapturePhoto,
  onCaptureVideo,
  onSyncRequest,
  pendingCount,
  isSyncing,
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
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <svg className="w-16 h-16 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h2 className="text-xl font-semibold">Camera Access Required</h2>
          <p className="text-gray-400 max-w-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white text-black rounded-lg font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400">Initializing camera...</p>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">{recordingDuration}s</span>
          </div>
        )}
      </div>

      <div className="bg-black p-4 flex items-center justify-between">
        <button
          onClick={switchCamera}
          className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
          disabled={isRecording}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePhoto}
            className="w-16 h-16 rounded-full bg-white hover:bg-gray-200 transition-colors flex items-center justify-center"
            disabled={!isInitialized || isRecording}
          >
            <div className="w-14 h-14 rounded-full border-4 border-black" />
          </button>

          <button
            onClick={handleVideoToggle}
            className={`w-14 h-14 rounded-full transition-colors flex items-center justify-center ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            disabled={!isInitialized}
          >
            {isRecording ? (
              <div className="w-5 h-5 bg-white rounded-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full border-4 border-red-500" />
            )}
          </button>
        </div>

        <button
          onClick={onSyncRequest}
          className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors relative"
          disabled={isSyncing}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
