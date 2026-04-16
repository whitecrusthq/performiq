import { Sequelize } from "sequelize";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: false,
  },
  logging: false,
  define: {
    timestamps: false,
    underscored: true,
    freezeTableName: true,
  },
});

export default sequelize;
