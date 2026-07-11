import { useState } from 'react';
import { ContactMethod } from '../types';
import { ConsentNotice } from './ConsentNotice';

interface EntryFormProps {
  eventName: string;
  onSubmit: (contactMethod: ContactMethod, contactValue: string) => void;
  isLoading?: boolean;
}

export function EntryForm({ eventName, onSubmit, isLoading }: EntryFormProps) {
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone');
  const [contactValue, setContactValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = contactValue.trim();
    if (!trimmed) {
      setError('Please enter your contact info.');
      return;
    }

    if (contactMethod === 'phone') {
      const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;
      if (!phoneRegex.test(trimmed)) {
        setError('Please enter a valid phone number.');
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    onSubmit(contactMethod, trimmed);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{eventName}</h1>
          <p className="text-gray-400">Scan, capture, share your candid moments.</p>
        </div>

        <ConsentNotice eventName={eventName} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setContactMethod('phone')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                contactMethod === 'phone'
                  ? 'bg-white text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Phone
            </button>
            <button
              type="button"
              onClick={() => setContactMethod('email')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                contactMethod === 'email'
                  ? 'bg-white text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Email
            </button>
          </div>

          <input
            type={contactMethod === 'phone' ? 'tel' : 'email'}
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            placeholder={contactMethod === 'phone' ? '+1 (555) 123-4567' : 'you@example.com'}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
            autoComplete={contactMethod === 'phone' ? 'tel' : 'email'}
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Start Capturing'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Your contact info is used only to send you the post-event review link.
        </p>
      </div>
    </div>
  );
}
