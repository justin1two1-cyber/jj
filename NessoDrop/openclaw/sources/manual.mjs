// Manual seed input source
// Reads operator-entered product seeds from the DB (inserted via owner console or API)

export const SOURCE_ID = "manual";

export async function fetchSignals({ db } = {}) {
  if (!db) return [];

  try {
    const result = await db.query(
      `SELECT * FROM signals WHERE source = 'manual' AND status = 'raw' LIMIT 100`
    );
    // Manual signals are already in the DB; this source just re-surfaces them for processing
    return result.rows.map((row) => ({
      ...row,
      _already_in_db: true, // skip re-insert
    }));
  } catch (err) {
    console.error("[openclaw:manual] DB read failed:", err.message);
    return [];
  }
}
