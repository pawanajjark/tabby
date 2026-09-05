// src/services/authManager.ts

export interface AuthUser {
  name: string;
  phone: string;
  isLoggedIn: boolean;
  flatId?: string;
  residenceId?: string;
}

const AUTH_STORAGE_KEY = 'tabby_auth_user';

export class AuthManager {
  static getDemoUser(): AuthUser {
    return {
      name: 'Sam',
      phone: '+91 98765 43210',
      isLoggedIn: true,
      flatId: '1',
      residenceId: '1',
    };
  }

  static getCurrentUser(): AuthUser {
    try {
      const data = localStorage.getItem(AUTH_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed.name === 'string') {
          return parsed;
        }
      }
    } catch {}
    // Default logged in demo user is Sam for smooth demo flow
    const defaultUser = this.getDemoUser();
    this.saveUser(defaultUser);
    return defaultUser;
  }

  static saveUser(user: AuthUser) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Failed to save auth user:', err);
    }
  }

  static sendOtp(phone: string): { success: boolean; dummyOtp: string; message: string } {
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 4) {
      return { success: false, dummyOtp: '', message: 'Please enter a valid phone number.' };
    }
    return {
      success: true,
      dummyOtp: '1111',
      message: 'OTP sent! Use demo code 1111 to log in.',
    };
  }

  static verifyOtp(phone: string, otp: string, name: string): { success: boolean; user?: AuthUser; message: string } {
    const cleanOtp = otp.trim();
    if (cleanOtp !== '1111') {
      return { success: false, message: 'Invalid OTP. Please enter dummy OTP: 1111' };
    }

    const cleanName = name.trim() || 'Sam';
    const currentUser = this.getCurrentUser();
    const user: AuthUser = {
      name: cleanName,
      phone: phone.trim() || '+91 98765 43210',
      isLoggedIn: true,
      flatId: currentUser.flatId || '1',
      residenceId: currentUser.residenceId || '1',
    };

    this.saveUser(user);
    return { success: true, user, message: `Welcome ${cleanName}! Logged in successfully.` };
  }

  static logout() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  }
}
