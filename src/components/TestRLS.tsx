import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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