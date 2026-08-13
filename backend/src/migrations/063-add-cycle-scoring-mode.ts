import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE cycles ADD COLUMN IF NOT EXISTS scoring_mode TEXT NOT NULL DEFAULT 'managers_only';`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE cycles ADD COLUMN IF NOT EXISTS self_weight INTEGER NOT NULL DEFAULT 30;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE cycles ADD COLUMN IF NOT EXISTS upward_included BOOLEAN NOT NULL DEFAULT true;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE appraisal_reviewers ADD COLUMN IF NOT EXISTS is_upward BOOLEAN NOT NULL DEFAULT false;`
  );
  // Deduplicate any existing reviewer rows, then enforce uniqueness so
  // concurrent creates cannot double-assign a reviewer to an appraisal.
  await queryInterface.sequelize.query(`
    DELETE FROM appraisal_reviewers a USING appraisal_reviewers b
    WHERE a.id > b.id AND a.appraisal_id = b.appraisal_id AND a.reviewer_id = b.reviewer_id;
  `);
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_appraisal_reviewers_appraisal_reviewer ON appraisal_reviewers (appraisal_id, reviewer_id);`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`ALTER TABLE cycles DROP COLUMN IF EXISTS scoring_mode;`);
  await queryInterface.sequelize.query(`ALTER TABLE cycles DROP COLUMN IF EXISTS self_weight;`);
  await queryInterface.sequelize.query(`ALTER TABLE cycles DROP COLUMN IF EXISTS upward_included;`);
  await queryInterface.sequelize.query(`ALTER TABLE appraisal_reviewers DROP COLUMN IF EXISTS is_upward;`);
}
