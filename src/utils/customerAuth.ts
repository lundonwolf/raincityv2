export type EmailAuthMode = 'signin' | 'signup' | 'reset';

export interface EmailAuthInput {
  fullName?: string;
  email: string;
  password?: string;
  confirmPassword?: string;
}

export interface EmailAuthValidationErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface EmailAuthValidationResult {
  valid: boolean;
  normalizedEmail: string;
  trimmedName: string;
  errors: EmailAuthValidationErrors;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmailAuthInput(
  mode: EmailAuthMode,
  input: EmailAuthInput,
): EmailAuthValidationResult {
  const errors: EmailAuthValidationErrors = {};
  const normalizedEmail = normalizeEmailAddress(input.email ?? '');
  const trimmedName = (input.fullName ?? '').trim();
  const password = input.password ?? '';
  const confirmPassword = input.confirmPassword ?? '';

  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address (any email provider works).';
  }

  if (mode === 'signup') {
    if (trimmedName.length < 2) {
      errors.fullName = 'Enter your name (at least 2 characters).';
    } else if (trimmedName.length > 100) {
      errors.fullName = 'Name must be 100 characters or fewer.';
    }

    if (password.length < 6) {
      errors.password = 'Choose a password with at least 6 characters.';
    }

    if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  } else if (mode === 'signin') {
    if (!password) {
      errors.password = 'Enter your password.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    normalizedEmail,
    trimmedName,
    errors,
  };
}

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email & password accounts are not enabled in Firebase Authentication yet. Enable Email/Password in the Firebase Console (Authentication → Sign-in method), or use Google Sign-In below.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In or reset your password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect. Check your details or use Forgot Password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 6 characters).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute before trying again, or reset your password.';
    case 'auth/network-request-failed':
      return 'Network error while reaching the sign-in service. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups or sign in with email & password.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already registered with another sign-in method. Try signing in with Email & Password or Google.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Could not complete sign-in. Please try again.';
  }
}
