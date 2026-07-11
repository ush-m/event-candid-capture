import { useRef, useState, useCallback, useEffect } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  isInitialized: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  initialize: () => Promise<void>;
  switchCamera: () => void;
  takePhoto: () => Promise<Blob | null>;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  isRecording: boolean;
  recordingDuration: number;
}

export function useCamera(maxVideoDuration = 30): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsInitialized(false);
  }, []);

  const initialize = useCallback(async () => {
    try {
      setError(null);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsInitialized(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera access denied';
      setError(message);
      setIsInitialized(false);
    }
  }, [facingMode]);

  const switchCamera = useCallback(() => {
    stopStream();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopStream]);

  useEffect(() => {
    if (!isInitialized && !error) {
      initialize();
    }
  }, [facingMode]);

  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !streamRef.current) return null;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.95
      );
    });
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current || isRecording) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9,opus',
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setIsRecording(true);
    setRecordingDuration(0);

    const startTime = Date.now();
    recordingTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRecordingDuration(elapsed);
      
      if (elapsed >= maxVideoDuration) {
        stopRecording();
      }
    }, 1000);
  }, [isRecording, maxVideoDuration]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || !isRecording) return null;

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];
        resolve(blob);
      };

      recorder.stop();
      setIsRecording(false);
      setRecordingDuration(0);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    });
  }, [isRecording]);

  useEffect(() => {
    return () => {
      stopStream();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [stopStream]);

  return {
    videoRef,
    stream: streamRef.current,
    isInitialized,
    error,
    facingMode,
    initialize,
    switchCamera,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    recordingDuration,
  };
}
