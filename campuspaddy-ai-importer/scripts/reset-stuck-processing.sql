UPDATE knowledge_sources
SET status = 'pending',
    processing_error = 'Reset stuck processing row',
    updated_at = now()
WHERE status = 'processing';
