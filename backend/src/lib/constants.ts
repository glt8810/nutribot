export const GOAL_TYPES = [
  'fat_loss',
  'muscle_gain',
  'recomp',
  'sports',
  'general_health',
  'medical',
  'pregnancy',
  'plant_based',
  'gut_health',
  'energy',
  'family',
  'ed_recovery',
] as const;

export type GoalType = typeof GOAL_TYPES[number];

export const INTAKE_SECTIONS = [
  'my_stats',
  'my_lifestyle',
  'my_food_prefs',
  'my_snack_habits',
] as const;

export type IntakeSection = typeof INTAKE_SECTIONS[number];

export const MODULE_TYPES = [
  'calorie_calc',
  'macros',
  'meal_plan',
  'snack_swaps',
  'rules',
  'timeline',
  'hydration',
  'supplements',
  'grocery_list',
  'progress_tracking',
] as const;

export type ModuleType = typeof MODULE_TYPES[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const FEEDBACK_TYPES = ['liked', 'disliked', 'regenerated'] as const;

export const AUDIT_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  REGISTER: 'register',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  PASSWORD_RESET_COMPLETE: 'password_reset_complete',
  EMAIL_VERIFIED: 'email_verified',
  MFA_ENABLE: 'mfa_enable',
  MFA_DISABLE: 'mfa_disable',
  PLAN_GENERATED: 'plan_generated',
  PLAN_EXPORTED: 'plan_exported',
  MODULE_REGENERATED: 'module_regenerated',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_DELETED: 'account_deleted',
  DATA_EXPORT: 'data_export_requested',
  SESSION_REVOKED: 'session_revoked',
  LOGOUT: 'logout',
  LOGOUT_ALL: 'logout_all',
  OAUTH_LOGIN: 'oauth_login',
  OAUTH_LINK: 'oauth_link',
  PROFILE_COMPLETE: 'profile_complete',
} as const;

// Security constants
export const PASSWORD_MIN_LENGTH = 12;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
export const MAX_DAILY_FAILED_LOGINS = 15;
export const MAX_SESSIONS_PER_USER = 5;
export const IDLE_TIMEOUT_MINUTES = 30;
export const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export const RESET_TOKEN_EXPIRY_HOURS = 1;
export const MFA_BACKUP_CODE_COUNT = 8;
export const MFA_BACKUP_CODE_LENGTH = 8;

// Rate limiting
export const RATE_LIMITS = {
  REGISTRATION_PER_IP: { max: 5, windowMs: 60 * 60 * 1000 },
  REGISTRATION_PER_EMAIL: { max: 3, windowMs: 60 * 60 * 1000 },
  LOGIN_PER_IP: { max: 20, windowMs: 60 * 1000 },
  VERIFICATION_RESEND: { max: 3, windowMs: 60 * 60 * 1000 },
  RESET_PER_EMAIL: { max: 3, windowMs: 60 * 60 * 1000 },
  RESET_PER_IP: { max: 10, windowMs: 60 * 60 * 1000 },
  UNAUTHENTICATED: { max: 20, windowMs: 60 * 1000 },
  AUTHENTICATED: { max: 60, windowMs: 60 * 1000 },
  AI_GENERATION: { max: 5, windowMs: 60 * 60 * 1000 },
} as const;

// Goal-specific module mapping
export const GOAL_MODULES: Record<GoalType, ModuleType[]> = {
  fat_loss: ['calorie_calc', 'macros', 'meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  muscle_gain: ['calorie_calc', 'macros', 'meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  recomp: ['calorie_calc', 'macros', 'meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  sports: ['calorie_calc', 'macros', 'meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  general_health: ['meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  medical: ['meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  pregnancy: ['calorie_calc', 'meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  plant_based: ['meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  gut_health: ['meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  energy: ['meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  family: ['calorie_calc', 'meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'grocery_list', 'progress_tracking'],
  ed_recovery: ['meal_plan', 'snack_swaps', 'rules', 'timeline', 'hydration', 'supplements', 'progress_tracking'],
};
