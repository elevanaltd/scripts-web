import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../lib/config';

/**
 * POC Migration: Using config loader instead of direct env access
 *
 * Benefits:
 * - Validated configuration at startup (fail-fast)
 * - Single source of truth for config
 * - Type-safe access to configuration
 * - Immutable config prevents runtime mutations
 */
const config = getConfig();
const supabase = createClient(config.supabase.url, config.supabase.publishableKey);

export function TestRLS() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testQuery = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1);

      if (error) {
        setResult(`Error: ${error.message}`);
      } else {
        setResult(`Success! Found ${data?.length || 0} profiles`);
      }
    } catch (err) {
      setResult(`Unexpected error: ${err}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>RLS Test</h3>
      <button onClick={testQuery} disabled={loading}>
        {loading ? 'Testing...' : 'Test user_profiles RLS'}
      </button>
      {result && (
        <div style={{ marginTop: '10px', padding: '10px', background: result.includes('Error') ? '#fee' : '#efe' }}>
          {result}
        </div>
      )}
    </div>
  );
}