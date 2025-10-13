# Supabase Database Quick Reference

## 🚀 Quick Commands

```bash
# Get latest types from your live database
npm run supabase:types

# Pull schema changes from dashboard
npm run supabase:pull

# Do both at once (recommended after dashboard changes)
npm run db:update

# Link to your project (one-time setup)
npm run supabase:link
```

## 📊 Current Tables

Based on the generated types, your database has:

1. **projects** - SmartSuite project records
   - `id`: SmartSuite record ID
   - `title`: Project name
   - `eav_code`: Project code
   - `client_filter`: Client info
   - `due_date`: Deadline

2. **scripts** - Video scripts
   - `id`: UUID
   - `video_id`: Link to SmartSuite video
   - `plain_text`: Full script text
   - `yjs_state`: Collaborative state (base64)
   - `component_count`: Number of components

3. **script_components** - Extracted components (C1, C2...)
   - `id`: UUID
   - `script_id`: Parent script
   - `component_number`: Sequence (1, 2, 3...)
   - `content`: Component text
   - `word_count`: Word count

4. **videos** - SmartSuite video records
   - `id`: SmartSuite record ID
   - `project_id`: Parent project
   - `title`: Video name
   - `type`: Video type/category

## 🔄 Workflow

When you make changes in Supabase Dashboard:

1. **Add/modify tables in Dashboard**
2. **Run:** `npm run db:update`
3. **TypeScript types auto-update** in `src/types/database.types.ts`
4. **Use types in your code:**

```typescript
import { Database } from '@/types/database.types';

type Script = Database['public']['Tables']['scripts']['Row'];
type NewScript = Database['public']['Tables']['scripts']['Insert'];
```

## 🔐 RLS Policies

Check these are enabled in Dashboard:
- Scripts: User can CRUD their own
- Components: User can manage via script ownership
- Projects/Videos: Public read (cached from SmartSuite)

## 📝 Notes

- Types are auto-generated - never edit `database.types.ts` directly
- After schema changes, restart your dev server
- Check `supabase/migrations/` for migration history
- Use Dashboard SQL editor for complex queries/functions