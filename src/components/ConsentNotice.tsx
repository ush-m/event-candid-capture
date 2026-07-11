interface ConsentNoticeProps {
  eventName?: string;
}

export function ConsentNotice({ eventName = 'this event' }: ConsentNoticeProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-300 space-y-2">
      <h3 className="text-white font-semibold text-base">How your photos work</h3>
      <ul className="space-y-1.5 list-disc list-inside">
        <li>Your photos are captured directly in your browser — nothing leaves your device until you choose to share.</li>
        <li>After <span className="text-white font-medium">{eventName}</span> ends, you&apos;ll receive a link to review your photos.</li>
        <li>You decide which photos to share. Nothing is shared without your explicit permission.</li>
        <li>Photos you don&apos;t select will be permanently deleted within 7 days.</li>
        <li>Your contact info is only used to send you the review link and will be deleted after.</li>
      </ul>
    </div>
  );
}
