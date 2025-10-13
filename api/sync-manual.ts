import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { SmartSuiteListResponse, SmartSuiteProjectRecord, SmartSuiteVideoRecord } from '../src/types/smartsuite.types';

/**
 * Manual Sync Endpoint
 *
 * Backup option for syncing SmartSuite data
 * Primary sync is via webhooks
 *
 * ARCHITECTURE: Pull-based sync as fallback
 */

// Initialize Supabase with service role
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// SmartSuite configuration - Server-only variables (no VITE_ prefix)
const SMARTSUITE_API_KEY = process.env.SMARTSUITE_API_KEY;
const WORKSPACE_ID = process.env.SMARTSUITE_WORKSPACE_ID;
const PROJECTS_TABLE_ID = process.env.SMARTSUITE_PROJECTS_TABLE;
const VIDEOS_TABLE_ID = process.env.SMARTSUITE_VIDEOS_TABLE;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify user is authenticated with Supabase
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate token with Supabase
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    console.log('Starting manual sync from SmartSuite');

    // Check required environment variables
    if (!SMARTSUITE_API_KEY || !WORKSPACE_ID || !PROJECTS_TABLE_ID || !VIDEOS_TABLE_ID) {
      console.error('Missing required SmartSuite environment variables');
      return res.status(500).json({
        error: 'Server configuration error - missing SmartSuite credentials'
      });
    }

    // Update sync metadata
    await supabase
      .from('sync_metadata')
      .upsert({
        id: 'singleton',
        status: 'running',
        last_sync_started_at: new Date().toISOString()
      });

    // Fetch projects from SmartSuite
    const projectsResponse = await fetch(
      `https://api.smartsuite.com/api/v1/applications/${PROJECTS_TABLE_ID}/records/list/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${SMARTSUITE_API_KEY}`,
          'ACCOUNT-ID': WORKSPACE_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Empty body gets all records
          // Add filters here if needed
        })
      }
    );

    if (!projectsResponse.ok) {
      throw new Error(`SmartSuite API error: ${projectsResponse.status}`);
    }

    const projectsData = await projectsResponse.json();

    // Transform and upsert projects
    const projects = (projectsData as SmartSuiteListResponse<SmartSuiteProjectRecord>).items.map((item) => ({
      id: item.id,
      title: item.title || item.name || 'Untitled',
      eav_code: item.eavcode || '',
      client_filter: item.slabels_c8bebae3c5 || null,
      due_date: item.projdue456?.to_date?.date || null,
      created_at: item.first_created?.on || new Date().toISOString(),
      updated_at: item.last_updated?.on || new Date().toISOString()
    }));

    const { error: projectsError } = await supabase
      .from('projects')
      .upsert(projects, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (projectsError) {
      throw projectsError;
    }

    // Fetch videos from SmartSuite
    const videosResponse = await fetch(
      `https://api.smartsuite.com/api/v1/applications/${VIDEOS_TABLE_ID}/records/list/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${SMARTSUITE_API_KEY}`,
          'ACCOUNT-ID': WORKSPACE_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (!videosResponse.ok) {
      throw new Error(`SmartSuite API error: ${videosResponse.status}`);
    }

    const videosData = await videosResponse.json();

    // Transform and upsert videos
    const videos = (videosData as SmartSuiteListResponse<SmartSuiteVideoRecord>).items.map((item) => {
      // Extract eav_code - it comes as an array from SmartSuite (lookup field)
      let eavCode = null;
      if (Array.isArray(item.eav_code) && item.eav_code.length > 0) {
        eavCode = item.eav_code[0];
      } else if (typeof item.eav_code === 'string') {
        eavCode = item.eav_code;
      } else if (item.s75e825d24) {
        // Fallback: map through project ID if eav_code not available
        const linkedProject = projects.find(p => p.id === item.s75e825d24);
        eavCode = linkedProject?.eav_code || null;
      }

      return {
        id: item.id,
        eav_code: eavCode,
        title: item.title || item.name || 'Untitled',
        production_type: item.production_type || null,
        main_stream_status: item.main_stream_status || null,
        vo_stream_status: item.vo_stream_status || null,
        created_at: item.first_created?.on || new Date().toISOString(),
        updated_at: item.last_updated?.on || new Date().toISOString()
      };
    });

    const { error: videosError } = await supabase
      .from('videos')
      .upsert(videos, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (videosError) {
      throw videosError;
    }

    // Update sync metadata to show success
    await supabase
      .from('sync_metadata')
      .upsert({
        id: 'singleton',
        status: 'idle',
        last_sync_completed_at: new Date().toISOString()
      });

    console.log(`Manual sync completed: ${projects.length} projects, ${videos.length} videos`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: `Synced ${projects.length} projects and ${videos.length} videos`,
      projects: projects.length,
      videos: videos.length
    });

  } catch (error) {
    console.error('Manual sync error:', error);

    // Update sync metadata to show error
    await supabase
      .from('sync_metadata')
      .upsert({
        id: 'singleton',
        status: 'error',
        last_error: error instanceof Error ? error.message : 'Unknown error'
      });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    });
  }
}