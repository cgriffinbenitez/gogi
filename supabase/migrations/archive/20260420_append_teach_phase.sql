CREATE OR REPLACE FUNCTION append_teach_phase(
  p_session_id uuid,
  p_phase text
) RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET teach_phase_completed = array_append(
    COALESCE(teach_phase_completed, ARRAY[]::text[]),
    p_phase
  )
  WHERE id = p_session_id
    AND NOT (p_phase = ANY(COALESCE(teach_phase_completed, ARRAY[]::text[])));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION append_teach_phase(uuid, text) TO authenticated;
