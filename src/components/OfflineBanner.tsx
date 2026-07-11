import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOnline, wasOffline, clearOfflineFlag } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-yellow-600 text-black px-4 py-2 text-center text-sm font-medium">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.242 2.829a5 5 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
          </svg>
          You&apos;re offline. Captures are saved locally and will sync when reconnected.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-green-600 text-black px-4 py-2 text-center text-sm font-medium">
      <div className="flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Back online! Syncing your captures...
        <button
          onClick={clearOfflineFlag}
          className="ml-2 underline text-green-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
