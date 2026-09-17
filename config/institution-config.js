const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const institutionsPath = path.join(__dirname, 'institutions.json');

const CREDENTIAL_FIELDS = [
  ['loginEmail', 'LOGIN_EMAIL'],
  ['loginPassword', 'LOGIN_PASSWORD'],
  ['signupName', 'SIGNUP_NAME'],
  ['signupEmail', 'SIGNUP_EMAIL'],
  ['signupPhone', 'SIGNUP_PHONE'],
  ['signupPassword', 'SIGNUP_PASSWORD'],
  ['signupConfirmPassword', 'SIGNUP_CONFIRM_PASSWORD'],
  ['signupReferralCode', 'SIGNUP_REFERRAL_CODE'],
];

function envPrefix(id) {
  return String(id || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function pickEnv(prefix, suffix) {
  return readEnv(`${prefix}_${suffix}`);
}

function loadInstitutions() {
  const raw = JSON.parse(fs.readFileSync(institutionsPath, 'utf8'));
  const institutions = {};

  for (const [id, meta] of Object.entries(raw)) {
    const prefix = envPrefix(id);
    const credentials = {};

    for (const [field, suffix] of CREDENTIAL_FIELDS) {
      credentials[field] = pickEnv(prefix, suffix);
    }

    institutions[id] = {
      id: meta.id || id,
      label: meta.label || meta.name || id,
      loginUrl:
        readEnv(`${prefix}_LOGIN_URL`) ||
        readEnv(`${prefix}_BASE_URL`) ||
        meta.loginUrl ||
        '',
      signupUrl: readEnv(`${prefix}_SIGNUP_URL`) || meta.signupUrl || '',
      credentials,
    };
  }

  return institutions;
}

function getInstitution(id) {
  const institutions = loadInstitutions();
  const institution = institutions[id];

  if (!institution) {
    throw new Error(
      `Unknown institution "${id}". Use one of: ${Object.keys(institutions).join(', ')}`
    );
  }

  return institution;
}

function publicInstitution(institution) {
  const credentials = institution.credentials || {};

  return {
    id: institution.id,
    label: institution.label,
    loginUrl: institution.loginUrl,
    signupUrl: institution.signupUrl,
    config: {
      loginUrl: Boolean(institution.loginUrl),
      signupUrl: Boolean(institution.signupUrl),
      loginEmail: Boolean(credentials.loginEmail),
      loginPassword: Boolean(credentials.loginPassword),
      signupName: Boolean(credentials.signupName),
      signupEmail: Boolean(credentials.signupEmail),
      signupPhone: Boolean(credentials.signupPhone),
      signupPassword: Boolean(credentials.signupPassword),
      signupConfirmPassword: Boolean(credentials.signupConfirmPassword),
      signupReferralCode: Boolean(credentials.signupReferralCode),
    },
  };
}

function requiredFields(moduleName) {
  const login = [
    ['loginUrl', 'BASE_URL / login URL'],
    ['loginEmail', 'LOGIN_EMAIL'],
    ['loginPassword', 'LOGIN_PASSWORD'],
  ];
  const signup = [
    ['signupUrl', 'SIGNUP_URL'],
    ['signupName', 'SIGNUP_NAME'],
    ['signupEmail', 'SIGNUP_EMAIL'],
    ['signupPassword', 'SIGNUP_PASSWORD'],
  ];

  switch (String(moduleName || 'all').toLowerCase()) {
    case 'login':
      return login;
    case 'signup':
      return signup;
    default:
      return [...login, ...signup];
  }
}

function validateInstitutionConfig(institution, moduleName) {
  const missing = [];

  for (const [field, label] of requiredFields(moduleName)) {
    const value =
      institution[field] ||
      (institution.credentials && institution.credentials[field]);

    if (!value) {
      missing.push(label);
    }
  }

  return missing;
}

function playwrightEnv(institution) {
  const credentials = institution.credentials || {};
  const localMode = String(process.env.AUTH_TEST_TARGET || '').toLowerCase() === 'local';
  const localBase = (process.env.AUTH_TEST_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const loginUrl = localMode ? `${localBase}/auth/${institution.id}/login` : institution.loginUrl;
  const signupUrl = localMode ? `${localBase}/auth/${institution.id}/signup` : institution.signupUrl;

  return {
    INSTITUTION: institution.id,
    BASE_URL: loginUrl,
    SIGNUP_URL: signupUrl,
    LOGIN_EMAIL: credentials.loginEmail || 'testuser@example.com',
    LOGIN_PASSWORD: credentials.loginPassword || 'Test@1234',
    SIGNUP_NAME: credentials.signupName || 'Test User',
    SIGNUP_EMAIL: credentials.signupEmail || 'testuser@example.com',
    SIGNUP_PHONE: credentials.signupPhone || '9876543210',
    SIGNUP_PASSWORD: credentials.signupPassword || 'Test@1234',
    SIGNUP_CONFIRM_PASSWORD:
      credentials.signupConfirmPassword || credentials.signupPassword || 'Test@1234',
    SIGNUP_REFERRAL_CODE: credentials.signupReferralCode,
  };
}

module.exports = {
  loadInstitutions,
  getInstitution,
  publicInstitution,
  validateInstitutionConfig,
  playwrightEnv,
};
