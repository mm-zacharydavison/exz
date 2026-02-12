export default {
  env: {
    APP_ENV: "testing",
    DATABASE_URL: "postgres://localhost:5432/test_db",
  },
  hooks: {
    before: "echo 'Running pre-action hook'",
    after: "echo 'Running post-action hook'",
  },
};
