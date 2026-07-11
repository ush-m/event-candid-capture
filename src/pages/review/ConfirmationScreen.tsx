interface ConfirmationScreenProps {
  eventName: string;
  selectedCount: number;
  mode: 'save_and_share' | 'share_only';
  alreadyCompleted: boolean;
}

export function ConfirmationScreen({
  eventName,
  selectedCount,
  mode,
  alreadyCompleted,
}: ConfirmationScreenProps) {
  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto bg-green-900/50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Already Submitted</h1>
          <p className="text-gray-400">
            You&apos;ve already shared your photos from <span className="text-white font-medium">{eventName}</span>.
          </p>
          <p className="text-gray-500 text-sm">
            If you need to make changes, please contact the event organizer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 mx-auto bg-green-900/50 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold">Thank You!</h1>
        
        <p className="text-gray-400">
          You shared <span className="text-white font-bold">{selectedCount}</span> photo{selectedCount !== 1 ? 's' : ''} from{' '}
          <span className="text-white font-medium">{eventName}</span>.
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
              {mode === 'save_and_share' ? (
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {mode === 'save_and_share' ? 'Saved & Shared' : 'Shared'}
              </p>
              <p className="text-xs text-gray-500">
                {mode === 'save_and_share'
                  ? 'Your download link is being prepared'
                  : 'Photos sent to event organizer'}
              </p>
            </div>
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          Photos you didn&apos;t select will be permanently deleted within 7 days.
        </p>

        <button
          onClick={() => window.close()}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
