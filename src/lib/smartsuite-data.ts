/**
 * SmartSuite Data Access Layer
 *
 * ARCHITECTURE: Frontend reads from Supabase only
 * SmartSuite syncs to Supabase via webhooks
 * This file provides typed access to synced data
 */

import { supabase } from './supabase';
import type { Tables } from '../types/database.types';

export class SmartSuiteData {
  /**
   * Fetch all projects from Supabase (already synced from SmartSuite)
   * Frontend only reads from Supabase - single source of truth
   */
  async fetchProjects(): Promise<Tables<'projects'>[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetch videos for a specific project from Supabase
   * Frontend only reads from Supabase - single source of truth
   * Note: This now uses eav_code for the relationship
   */
  async fetchVideosForProject(projectEavCode: string): Promise<Tables<'videos'>[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('eav_code', projectEavCode)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching videos:', error);
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Trigger manual sync via webhook endpoint
   * This is a backup option - primary sync is via SmartSuite webhooks
   */
  async triggerManualSync(): Promise<{ success: boolean; message: string }> {
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/sync-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message || 'Sync completed' };
      }

      return {
        success: false,
        message: data.error || 'Sync failed'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get sync status from metadata table
   */
  async getSyncStatus(): Promise<{
    lastSync: string | null;
    status: 'idle' | 'syncing' | 'error';
    error?: string;
  }> {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .single();

    if (error || !data) {
      return {
        lastSync: null,
        status: 'idle'
      };
    }

    return {
      lastSync: data.last_sync_completed_at,
      status: data.status as 'idle' | 'syncing' | 'error',
      error: data.last_error
    };
  }
}

// Export singleton instance
export const smartSuiteData = new SmartSuiteData();