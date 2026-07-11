export type SyncStatus = 'pending' | 'uploading' | 'staged' | 'failed';
export type SelectionStatus = 'undecided' | 'selected' | 'rejected';
export type DeliveryStatus = 'not_applicable' | 'pending' | 'delivered' | 'failed';
export type MediaType = 'photo' | 'video';
export type ContactMethod = 'phone' | 'email';

export interface LocalMediaItem {
  id: string;
  guestSessionId: string;
  mediaType: MediaType;
  blob: Blob;
  thumbnail?: Blob;
  capturedAt: number;
  syncStatus: SyncStatus;
  remotePath?: string;
  retryCount: number;
  nextRetryAt: number;
}

export interface GuestSession {
  id: string;
  eventId: string;
  contactMethod: ContactMethod;
  contactValue: string;
}

export interface EventInfo {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}
