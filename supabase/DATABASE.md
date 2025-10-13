# Supabase Database Schema Documentation

## Connection Details
- **Project URL:** `https://zbxvjyrbkycbfhwmmnmy.supabase.co`
- **Database:** PostgreSQL 15
- **Region:** aws-0-eu-west-2

## How to Keep This Updated

### Method 1: Generate TypeScript Types (Recommended)
```bash
# This pulls types directly from your live database
npm run supabase:types

# Or manually:
npx supabase gen types typescript --project-id zbxvjyrbkycbfhwmmnmy > src/types/database.types.ts
```

### Method 2: Pull Schema Migrations
```bash
# First, link your project (one-time setup)
npx supabase link --project-ref zbxvjyrbkycbfhwmmnmy

# Pull the schema
npx supabase db pull

# This creates migration files in supabase/migrations/
```

### Method 3: Export from Dashboard
1. Go to Supabase Dashboard > SQL Editor
2. Run: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`
3. Export table definitions

## Current Schema (Last Updated: 2025-09-26)

### Tables

#### `projects`
Cached SmartSuite projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY, -- SmartSuite record ID
  title TEXT NOT NULL,
  eav_code TEXT NOT NULL,
  client_filter TEXT,
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

#### `videos`
Cached SmartSuite videos
```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY, -- SmartSuite record ID
  project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  production_type TEXT,
  main_stream_status TEXT,
  vo_stream_status TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_videos_project_id ON videos(project_id);
```

#### `scripts`
Primary storage for video scripts
```sql
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT REFERENCES videos(id),
  plain_text TEXT, -- Full script text
  yjs_state TEXT, -- Collaborative editing state (base64)
  component_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scripts_video_id ON scripts(video_id);
```

#### `script_components`
Extracted paragraph components (C1, C2, C3...)
```sql
CREATE TABLE script_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id),
  component_number INTEGER NOT NULL, -- 1, 2, 3...
  content TEXT NOT NULL,
  word_count INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_components_script_id ON script_components(script_id);
CREATE UNIQUE INDEX idx_components_unique ON script_components(script_id, component_number);
```

#### `user_profiles`
User profiles and permissions
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT,
  client_filter TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

#### `sync_metadata`
Track SmartSuite sync operations
```sql
CREATE TABLE sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT,
  sync_count INTEGER DEFAULT 0,
  last_sync_started_at TIMESTAMP,
  last_sync_completed_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

## RLS Policies

### Scripts Table
```sql
-- Users can read their own scripts
CREATE POLICY "Users can read own scripts" ON scripts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own scripts
CREATE POLICY "Users can insert own scripts" ON scripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own scripts
CREATE POLICY "Users can update own scripts" ON scripts
  FOR UPDATE USING (auth.uid() = user_id);
```

### Components Table
```sql
-- Users can manage components for their scripts
CREATE POLICY "Users can manage components" ON components
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scripts
      WHERE scripts.id = components.script_id
      AND scripts.user_id = auth.uid()
    )
  );
```

## Functions & Triggers

### Auto-update timestamps
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_scripts_updated_at
  BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_components_updated_at
  BEFORE UPDATE ON components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Component Extraction
```sql
CREATE OR REPLACE FUNCTION extract_components(script_content JSONB)
RETURNS JSONB[] AS $$
DECLARE
  components JSONB[] := '{}';
  paragraph JSONB;
  component_id TEXT;
  component_index INTEGER := 1;
BEGIN
  -- Extract paragraphs from TipTap content
  FOR paragraph IN
    SELECT jsonb_array_elements(script_content->'content')
    WHERE jsonb_array_elements->>'type' = 'paragraph'
  LOOP
    component_id := 'C' || component_index;
    components := array_append(components, jsonb_build_object(
      'id', component_id,
      'content', paragraph->'content'->0->>'text',
      'sequence', component_index
    ));
    component_index := component_index + 1;
  END LOOP;

  RETURN components;
END;
$$ LANGUAGE plpgsql;
```

## Common Queries

### Get script with components
```sql
SELECT
  s.*,
  array_agg(
    jsonb_build_object(
      'id', c.component_id,
      'content', c.content,
      'sequence', c.sequence
    ) ORDER BY c.sequence
  ) as components
FROM scripts s
LEFT JOIN components c ON c.script_id = s.id
WHERE s.project_id = $1 AND s.video_id = $2
GROUP BY s.id;
```

### Update script and components atomically
```sql
BEGIN;
  UPDATE scripts
  SET content = $1, updated_at = now()
  WHERE id = $2;

  DELETE FROM components WHERE script_id = $2;

  INSERT INTO components (script_id, component_id, content, sequence)
  SELECT $2, value->>'id', value->>'content', (value->>'sequence')::int
  FROM jsonb_array_elements($3);
COMMIT;
```

## Maintenance Commands

### Check table sizes
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Vacuum and analyze
```sql
VACUUM ANALYZE scripts;
VACUUM ANALYZE components;
```

## Notes

- Always use RLS policies for security
- Components are extracted server-side for consistency
- Use transactions for atomic updates
- Monitor table sizes as video count grows
- Consider partitioning if >100k videos