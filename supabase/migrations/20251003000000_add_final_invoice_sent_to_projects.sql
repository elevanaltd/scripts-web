-- Add final_invoice_sent column to projects table
ALTER TABLE projects
ADD COLUMN final_invoice_sent DATE;
