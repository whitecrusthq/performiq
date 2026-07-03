import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS transfer_approvers (
      id SERIAL PRIMARY KEY,
      transfer_request_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
      approver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NULL,
      reviewed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_transfer_approvers_request ON transfer_approvers (transfer_request_id, order_index);`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_transfer_approvers_approver ON transfer_approvers (approver_id);`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_transfer_approvers_approver;`);
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_transfer_approvers_request;`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS transfer_approvers;`);
}
