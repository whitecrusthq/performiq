import { QueryInterface } from "sequelize";

/**
 * Older appraisals stored only appraisals.reviewer_id. The ordered-reviewer
 * workflow requires an appraisal_reviewers row, otherwise manager review has
 * no active reviewer and nobody can submit.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    INSERT INTO appraisal_reviewers
      (appraisal_id, reviewer_id, order_index, status, created_at)
    SELECT
      a.id,
      a.reviewer_id,
      0,
      CASE
        WHEN a.status::text = 'manager_review' THEN 'in_progress'
        WHEN a.status::text IN ('pending_approval', 'completed') THEN 'completed'
        ELSE 'pending'
      END,
      NOW()
    FROM appraisals a
    WHERE a.reviewer_id IS NOT NULL
      AND COALESCE(a.workflow_type, 'admin_approval') <> 'self_only'
      AND NOT EXISTS (
        SELECT 1
        FROM appraisal_reviewers ar
        WHERE ar.appraisal_id = a.id
      );

    WITH next_rows AS (
      SELECT DISTINCT ON (ar.appraisal_id) ar.id
      FROM appraisal_reviewers ar
      JOIN appraisals a ON a.id = ar.appraisal_id
      WHERE a.status::text = 'manager_review'
        AND ar.status = 'pending'
        AND NOT EXISTS (
          SELECT 1
          FROM appraisal_reviewers active
          WHERE active.appraisal_id = ar.appraisal_id
            AND active.status = 'in_progress'
        )
      ORDER BY ar.appraisal_id, ar.order_index, ar.id
    )
    UPDATE appraisal_reviewers ar
    SET status = 'in_progress'
    FROM next_rows n
    WHERE ar.id = n.id;
  `);
}

export async function down(): Promise<void> {
  // Data backfill is intentionally not reversed.
}