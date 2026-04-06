export declare const GOAL_TYPES: readonly ["fat_loss", "muscle_gain", "recomp", "sports", "general_health", "medical", "pregnancy", "plant_based", "gut_health", "energy", "family", "ed_recovery"];
export type GoalType = typeof GOAL_TYPES[number];
export declare const INTAKE_SECTIONS: readonly ["my_stats", "my_lifestyle", "my_food_prefs", "my_snack_habits"];
export type IntakeSection = typeof INTAKE_SECTIONS[number];
export declare const MODULE_TYPES: readonly ["calorie_calc", "macros", "meal_plan", "snack_swaps", "rules", "timeline", "hydration", "supplements", "grocery_list", "progress_tracking"];
export type ModuleType = typeof MODULE_TYPES[number];
export declare const MEAL_TYPES: readonly ["breakfast", "lunch", "dinner", "snack"];
export declare const FEEDBACK_TYPES: readonly ["liked", "disliked", "regenerated"];
export declare const AUDIT_EVENTS: {
    readonly LOGIN_SUCCESS: "login_success";
    readonly LOGIN_FAILURE: "login_failure";
    readonly REGISTER: "register";
    readonly PASSWORD_CHANGE: "password_change";
    readonly PASSWORD_RESET_REQUEST: "password_reset_request";
    readonly PASSWORD_RESET_COMPLETE: "password_reset_complete";
    readonly EMAIL_VERIFIED: "email_verified";
    readonly MFA_ENABLE: "mfa_enable";
    readonly MFA_DISABLE: "mfa_disable";
    readonly PLAN_GENERATED: "plan_generated";
    readonly PLAN_EXPORTED: "plan_exported";
    readonly MODULE_REGENERATED: "module_regenerated";
    readonly ACCOUNT_LOCKED: "account_locked";
    readonly ACCOUNT_DELETED: "account_deleted";
    readonly DATA_EXPORT: "data_export_requested";
    readonly SESSION_REVOKED: "session_revoked";
    readonly LOGOUT: "logout";
    readonly LOGOUT_ALL: "logout_all";
};
export declare const PASSWORD_MIN_LENGTH = 12;
export declare const MAX_FAILED_LOGINS = 5;
export declare const LOCKOUT_DURATION_MINUTES = 15;
export declare const MAX_DAILY_FAILED_LOGINS = 15;
export declare const MAX_SESSIONS_PER_USER = 5;
export declare const IDLE_TIMEOUT_MINUTES = 30;
export declare const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export declare const RESET_TOKEN_EXPIRY_HOURS = 1;
export declare const MFA_BACKUP_CODE_COUNT = 8;
export declare const MFA_BACKUP_CODE_LENGTH = 8;
export declare const RATE_LIMITS: {
    readonly REGISTRATION_PER_IP: {
        readonly max: 5;
        readonly windowMs: number;
    };
    readonly REGISTRATION_PER_EMAIL: {
        readonly max: 3;
        readonly windowMs: number;
    };
    readonly LOGIN_PER_IP: {
        readonly max: 20;
        readonly windowMs: number;
    };
    readonly VERIFICATION_RESEND: {
        readonly max: 3;
        readonly windowMs: number;
    };
    readonly RESET_PER_EMAIL: {
        readonly max: 3;
        readonly windowMs: number;
    };
    readonly RESET_PER_IP: {
        readonly max: 10;
        readonly windowMs: number;
    };
    readonly UNAUTHENTICATED: {
        readonly max: 20;
        readonly windowMs: number;
    };
    readonly AUTHENTICATED: {
        readonly max: 60;
        readonly windowMs: number;
    };
    readonly AI_GENERATION: {
        readonly max: 5;
        readonly windowMs: number;
    };
};
export declare const GOAL_MODULES: Record<GoalType, ModuleType[]>;
//# sourceMappingURL=constants.d.ts.map