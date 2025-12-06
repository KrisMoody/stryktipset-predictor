-- Add new fields to ai_usage table for enhanced tracking
ALTER TABLE ai_usage 
ADD COLUMN operation_id VARCHAR(100),
ADD COLUMN endpoint VARCHAR(100),
ADD COLUMN duration_ms INTEGER;

-- Add index for operation_id
CREATE INDEX ai_usage_operation_id_idx ON ai_usage(operation_id);

-- Update comments
COMMENT ON COLUMN ai_usage.operation_id IS 'Link to specific operation (prediction_id, match_id, etc.)';
COMMENT ON COLUMN ai_usage.endpoint IS 'API endpoint used';
COMMENT ON COLUMN ai_usage.duration_ms IS 'Duration of the operation in milliseconds';

