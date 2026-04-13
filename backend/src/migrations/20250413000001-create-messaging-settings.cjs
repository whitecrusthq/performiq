"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS crm_messaging_settings (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL DEFAULT 'twilio',
        account_sid TEXT,
        auth_token TEXT,
        twilio_phone_number VARCHAR(50),
        twilio_whatsapp_number VARCHAR(50),
        sms_enabled BOOLEAN NOT NULL DEFAULT false,
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS crm_messaging_settings;`);
  },
};
