"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOAL_MODULES = exports.RATE_LIMITS = exports.MFA_BACKUP_CODE_LENGTH = exports.MFA_BACKUP_CODE_COUNT = exports.RESET_TOKEN_EXPIRY_HOURS = exports.VERIFICATION_TOKEN_EXPIRY_HOURS = exports.IDLE_TIMEOUT_MINUTES = exports.MAX_SESSIONS_PER_USER = exports.MAX_DAILY_FAILED_LOGINS = exports.LOCKOUT_DURATION_MINUTES = exports.MAX_FAILED_LOGINS = exports.PASSWORD_MIN_LENGTH = exports.AUDIT_EVENTS = exports.FEEDBACK_TYPES = exports.MEAL_TYPES = exports.MODULE_TYPES = exports.INTAKE_SECTIONS = exports.GOAL_TYPES = void 0;
exports.GOAL_TYPES = [
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
];
exports.INTAKE_SECTIONS = [
    'my_stats',
    'my_lifestyle',
    'my_food_prefs',
    'my_snack_habits',
];
exports.MODULE_TYPES = [
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
];
exports.MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
exports.FEEDBACK_TYPES = ['liked', 'disliked', 'regenerated'];
exports.AUDIT_EVENTS = {
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
};
// Security constants
exports.PASSWORD_MIN_LENGTH = 12;
exports.MAX_FAILED_LOGINS = 5;
exports.LOCKOUT_DURATION_MINUTES = 15;
exports.MAX_DAILY_FAILED_LOGINS = 15;
exports.MAX_SESSIONS_PER_USER = 5;
exports.IDLE_TIMEOUT_MINUTES = 30;
exports.VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
exports.RESET_TOKEN_EXPIRY_HOURS = 1;
exports.MFA_BACKUP_CODE_COUNT = 8;
exports.MFA_BACKUP_CODE_LENGTH = 8;
// Rate limiting
exports.RATE_LIMITS = {
    REGISTRATION_PER_IP: { max: 5, windowMs: 60 * 60 * 1000 },
    REGISTRATION_PER_EMAIL: { max: 3, windowMs: 60 * 60 * 1000 },
    LOGIN_PER_IP: { max: 20, windowMs: 60 * 1000 },
    VERIFICATION_RESEND: { max: 3, windowMs: 60 * 60 * 1000 },
    RESET_PER_EMAIL: { max: 3, windowMs: 60 * 60 * 1000 },
    RESET_PER_IP: { max: 10, windowMs: 60 * 60 * 1000 },
    UNAUTHENTICATED: { max: 20, windowMs: 60 * 1000 },
    AUTHENTICATED: { max: 60, windowMs: 60 * 1000 },
    AI_GENERATION: { max: 5, windowMs: 60 * 60 * 1000 },
};
// Goal-specific module mapping
exports.GOAL_MODULES = {
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
//# sourceMappingURL=constants.js.map