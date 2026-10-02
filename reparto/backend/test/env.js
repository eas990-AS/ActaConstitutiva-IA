process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://reparto:reparto@localhost:5432/reparto_test?schema=public';
process.env.JWT_SECRET = 'test-secret';
process.env.EVIDENCE_SECRET = 'test-evidence';
process.env.STORAGE_DIR = require('path').join(require('os').tmpdir(), 'reparto-test-storage');
