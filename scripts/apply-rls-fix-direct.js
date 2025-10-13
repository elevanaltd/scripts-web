#!/usr/bin/env node

/**
 * Apply RLS Fix Migration - Direct Approach
 * Apply the comments RLS fix to prevent client inserts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

async function applyRLSFix() {
  console.log('🔧 Applying RLS fix for comments table...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  // Execute each policy separately using direct database operations
  const policies = [
    {
      name: 'Drop old client policy',
      sql: `DROP POLICY IF EXISTS "comments_client_read" ON public.comments`
    },
    {
      name: 'Create client read-only policy',
      sql: `CREATE POLICY "comments_client_read_only" ON public.comments
        FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'client'
            )
            AND
            EXISTS (
                SELECT 1
                FROM public.scripts s
                JOIN public.videos v ON v.id = s.video_id
                JOIN public.projects p ON p.eav_code = v.eav_code
                JOIN public.user_clients uc ON uc.client_filter = p.client_filter
                WHERE s.id = comments.script_id
                AND uc.user_id = auth.uid()
            )
        )`
    },
    {
      name: 'Block client INSERT',
      sql: `CREATE POLICY "comments_client_no_insert" ON public.comments
        FOR INSERT
        TO authenticated
        WITH CHECK (
            NOT EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'client'
            )
        )`
    },
    {
      name: 'Block client UPDATE',
      sql: `CREATE POLICY "comments_client_no_update" ON public.comments
        FOR UPDATE
        TO authenticated
        USING (
            NOT EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'client'
            )
        )
        WITH CHECK (
            NOT EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'client'
            )
        )`
    },
    {
      name: 'Block client DELETE',
      sql: `CREATE POLICY "comments_client_no_delete" ON public.comments
        FOR DELETE
        TO authenticated
        USING (
            NOT EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'client'
            )
        )`
    },
    {
      name: 'Block unauthorized users',
      sql: `CREATE POLICY "comments_unauthorized_no_access" ON public.comments
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE user_profiles.id = auth.uid()
            )
        )`
    }
  ];

  for (const policy of policies) {
    console.log(`🔧 ${policy.name}...`);

    // Since we can't use rpc, we'll try using a direct approach
    // This may not work in all cases, but let's try
    try {
      // For policies, we need to use the REST API directly
      // This is a workaround since Supabase client doesn't expose direct SQL execution
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
          'apikey': SUPABASE_SECRET_KEY
        },
        body: JSON.stringify({ sql: policy.sql })
      });

      if (response.ok) {
        console.log(`✅ ${policy.name} applied successfully`);
      } else {
        const error = await response.text();
        console.log(`❌ ${policy.name} failed: ${error}`);
      }
    } catch (error) {
      console.log(`❌ ${policy.name} failed: ${error.message}`);
    }
  }

  console.log('\n🎉 RLS fix application complete!');
  console.log('💡 Test client permissions to verify the fix');
}

applyRLSFix().catch(console.error);