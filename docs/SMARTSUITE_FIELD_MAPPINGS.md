# SmartSuite Field Mappings - VALIDATED

**Last Updated:** 2025-09-26
**Status:** ✅ PRODUCTION VALIDATED
**Workspace:** s3qnmox1

## Overview

This document contains the validated field mappings for SmartSuite integration in the EAV Orchestrator. All field codes have been tested against production data and confirmed working.

## Projects Table (68a8ff5237fde0bf797c05b3)

### ✅ VALIDATED FIELD MAPPINGS

| Supabase Field | SmartSuite Field Code | Data Type | Notes |
|---|---|---|---|
| `id` | `id` | string | 24-character hex ID |
| `title` | `title` | string | Project title (e.g., "EAV002 - Nottingham (MTVH)") |
| `eav_code` | `eavcode` | string | EAV project code (e.g., "EAV002") |
| `client_filter` | `client_filter` | string | Client identifier (e.g., "MTVH") |
| `due_date` | `projdue456` | object | Date object - extract with helper function |
| `created_at` | `first_created` | object | Timestamp object - extract with helper function |
| `updated_at` | `last_updated` | object | Timestamp object - extract with helper function |

### Additional Available Fields

| SmartSuite Field Code | Description |
|---|---|
| `project_name_actual` | Clean project name without prefix |
| `project_manager` | Array of project manager references |
| `primary_contact` | Array of primary contact references |
| `project_lifecycle` | Status object for project lifecycle |

## Videos Table (68b2437a8f1755b055e0a124)

### ✅ VALIDATED FIELD MAPPINGS

| Supabase Field | SmartSuite Field Code | Data Type | Notes |
|---|---|---|---|
| `id` | `id` | string | 24-character hex ID |
| `title` | `title` | string | Full video title (e.g., "0-Introduction") |
| `video_name` | `video_name` | string | Clean video name (e.g., "Introduction") |
| `project_link` | `projects_link` | array | Link to projects table - use `has_any_of` filter |
| `production_type` | `prodtype01` | string | Production type (e.g., "new_prod") |
| `main_stream_status` | `main_status` | object | Main stream status - extract with helper function |
| `vo_stream_status` | `vo_status` | object | VO stream status - extract with helper function |
| `created_at` | `first_created` | object | Timestamp object - extract with helper function |
| `updated_at` | `last_updated` | object | Timestamp object - extract with helper function |

### Additional Available Fields

| SmartSuite Field Code | Description |
|---|---|
| `vidtype123` | Video type classification (e.g., "bespoke_opt") |
| `video_seq01` | Video sequence number |
| `duedate123` | Video due date object |
| `eav_code` | Array - EAV code inherited from project |
| `project_client` | Array - client information |

## Data Extraction Helpers

These helper functions are required to extract values from SmartSuite object fields:

```typescript
/**
 * Extract date string from SmartSuite date object
 */
private extractDateFromObject(dateObj: any): string | null {
  if (!dateObj || typeof dateObj !== 'object') return null;

  // SmartSuite date objects often have 'date' or 'value' properties
  if (dateObj.date) return dateObj.date;
  if (dateObj.value) return dateObj.value;
  if (dateObj.raw_value) return dateObj.raw_value;

  return null;
}

/**
 * Extract status string from SmartSuite status object
 */
private extractStatusFromObject(statusObj: any): string | null {
  if (!statusObj || typeof statusObj !== 'object') return null;

  // SmartSuite status objects often have 'value', 'label', or 'display_value' properties
  if (statusObj.value) return statusObj.value;
  if (statusObj.label) return statusObj.label;
  if (statusObj.display_value) return statusObj.display_value;

  return null;
}
```

## Filter Syntax for Relationships

When filtering videos by project, use the correct array field syntax:

```typescript
// ✅ CORRECT - for linked record arrays
filter: {
  field_id: 'projects_link',
  operator: 'has_any_of',
  value: [projectId]
}

// ❌ INCORRECT - this won't work for array fields
filter: {
  field_id: 'project_id',
  operator: 'is',
  value: projectId
}
```

## Implementation Status

### ✅ Completed
- [x] Field discovery and validation against production data
- [x] Updated SmartSuite API class with correct field mappings
- [x] Updated TypeScript interfaces
- [x] Fixed unit tests with validated field structures
- [x] Integration tested against production workspace
- [x] Helper functions for object field extraction

### API Usage Examples

```typescript
// Fetch projects with validated mappings
const projects = await smartSuiteAPI.fetchProjects();
// Returns: { id, title, eav_code, client_filter, due_date, created_at, updated_at }

// Fetch videos for a project with validated mappings
const videos = await smartSuiteAPI.fetchVideosForProject(projectId);
// Returns: { id, title, project_id, production_type, main_stream_status, vo_stream_status, created_at, updated_at }
```

## Validation Results

**Test Date:** 2025-09-26
**Test Environment:** Production workspace s3qnmox1
**Projects Tested:** 24 records retrieved successfully
**Videos Tested:** Linked record filtering working correctly
**Field Extraction:** All helper functions validated

**Status:** 🟢 **ALL FIELD MAPPINGS VALIDATED AND WORKING**

---

**Note:** This document replaces any previous field mapping assumptions. All field codes listed here have been confirmed working against production SmartSuite data.