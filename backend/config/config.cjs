require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const common = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  dialectOptions: {
    ssl: false,
  },
  define: {
    timestamps: false,
    underscored: true,
    freezeTableName: true,
  },
  migrationStorageTableName: 'SequelizeMeta',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  development: common,
  test: common,
  production: common,
};
