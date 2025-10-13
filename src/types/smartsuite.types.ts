/**
 * SmartSuite Type Definitions
 *
 * Types for SmartSuite API responses and webhook payloads
 * Used by webhook and manual sync endpoints
 */

// SmartSuite Date Range Structure
export interface SmartSuiteDateRange {
  from_date?: {
    date: string;
  };
  to_date?: {
    date: string;
  };
}

// SmartSuite Timestamp Structure
export interface SmartSuiteTimestamp {
  on: string;
}

// SmartSuite Project Record
export interface SmartSuiteProjectRecord {
  id: string;
  title?: string;
  name?: string;
  eavcode?: string;
  slabels_c8bebae3c5?: string; // Client filter field
  projdue456?: SmartSuiteDateRange; // Project due date
  first_created?: SmartSuiteTimestamp;
  last_updated?: SmartSuiteTimestamp;
}

// SmartSuite Video Record
export interface SmartSuiteVideoRecord {
  id: string;
  title?: string;
  name?: string;
  eav_code?: string[] | string; // Lookup field from project (comes as array)
  s75e825d24?: string; // Linked project ID field
  project_id?: string;
  production_type?: string;
  main_stream_status?: string;
  vo_stream_status?: string;
  first_created?: SmartSuiteTimestamp;
  last_updated?: SmartSuiteTimestamp;
}

// SmartSuite List API Response
export interface SmartSuiteListResponse<T> {
  items: T[];
  total_count: number;
  has_next: boolean;
}

// SmartSuite Webhook Payload
export interface SmartSuiteWebhookPayload {
  event_type: 'record.created' | 'record.updated' | 'record.deleted';
  table_id: string;
  record: SmartSuiteProjectRecord | SmartSuiteVideoRecord;
  webhook_id: string;
}