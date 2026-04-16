require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const needsSsl = !DATABASE_URL.includes('localhost') &&
  !DATABASE_URL.includes('127.0.0.1') &&
  !DATABASE_URL.includes('sslmode=disable') &&
  !DATABASE_URL.includes('helium');

const ssl = needsSsl ? { require: true, rejectUnauthorized: false } : false;

module.exports = {
  development: {
    url: DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: { ssl },
  },
  production: {
    url: DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: { ssl },
  },
};
