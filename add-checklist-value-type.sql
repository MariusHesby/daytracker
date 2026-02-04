-- Update the value_type check constraint to include 'checklist'
-- First drop the existing constraint
ALTER TABLE activity_types DROP CONSTRAINT IF EXISTS activity_types_value_type_check;

-- Add the updated constraint with 'checklist' included
ALTER TABLE activity_types ADD CONSTRAINT activity_types_value_type_check 
CHECK (value_type IN ('text', 'boolean', 'checkmark', 'counter', 'mood', 'nutrition', 'workout', 'checklist'));
