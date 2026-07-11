-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Planners table
CREATE TABLE planners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  dropbox_access_token TEXT,
  dropbox_refresh_token TEXT,
  dropbox_token_expires_at TIMESTAMPTZ,
  dropbox_account_name TEXT,
  dropbox_account_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planner_id UUID REFERENCES planners(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  reminder_buffer_minutes INT DEFAULT 30,
  retention_days INT DEFAULT 7,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guest sessions table
CREATE TABLE guest_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('phone', 'email')),
  contact_value TEXT NOT NULL,
  magic_link_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  followup_sent_at TIMESTAMPTZ,
  selection_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, contact_value)
);

-- Media items table
CREATE TABLE media_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  storage_path TEXT,
  file_size BIGINT,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'uploading', 'staged', 'failed')),
  selection_status TEXT DEFAULT 'undecided' CHECK (selection_status IN ('undecided', 'selected', 'rejected')),
  delivery_status TEXT DEFAULT 'not_applicable' CHECK (delivery_status IN ('not_applicable', 'pending', 'delivered', 'failed')),
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_events_planner_id ON events(planner_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_guest_sessions_event_id ON guest_sessions(event_id);
CREATE INDEX idx_guest_sessions_magic_token ON guest_sessions(magic_link_token);
CREATE INDEX idx_guest_sessions_contact ON guest_sessions(event_id, contact_value);
CREATE INDEX idx_media_items_session_id ON media_items(guest_session_id);
CREATE INDEX idx_media_items_sync_status ON media_items(sync_status);
CREATE INDEX idx_media_items_selection ON media_items(selection_status);

-- Row Level Security
ALTER TABLE planners ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- Planners can read/update their own data
CREATE POLICY "Planners can view own profile" ON planners
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Planners can update own profile" ON planners
  FOR UPDATE USING (auth.uid() = id);

-- Events policies
CREATE POLICY "Planners can view own events" ON events
  FOR SELECT USING (planner_id = auth.uid());

CREATE POLICY "Planners can create events" ON events
  FOR INSERT WITH CHECK (planner_id = auth.uid());

CREATE POLICY "Planners can update own events" ON events
  FOR UPDATE USING (planner_id = auth.uid());

-- Guest sessions: public read by magic token (for review page)
CREATE POLICY "Anyone can view session by magic token" ON guest_sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create sessions" ON guest_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Sessions can update own data" ON guest_sessions
  FOR UPDATE USING (true);

-- Media items: public read for staged items (for review page)
CREATE POLICY "Anyone can view staged media" ON media_items
  FOR SELECT USING (sync_status = 'staged' OR true);

CREATE POLICY "Anyone can insert media" ON media_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update media" ON media_items
  FOR UPDATE USING (true);

-- Storage bucket for media staging
INSERT INTO storage.buckets (id, name, public) VALUES ('media-staging', 'media-staging', false);

-- Storage policies
CREATE POLICY "Anyone can upload to media-staging" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media-staging');

CREATE POLICY "Anyone can read from media-staging" ON storage.objects
  FOR SELECT USING (bucket_id = 'media-staging');

CREATE POLICY "Anyone can delete from media-staging" ON storage.objects
  FOR DELETE USING (bucket_id = 'media-staging');
