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
    return {
      name: '',
      phone: '',
      isLoggedIn: false,
    };
  }

  static saveUser(user: AuthUser) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Failed to save auth user:', err);
    }
  }

  static signIn(phone: string, name: string): { success: boolean; user?: AuthUser; message: string } {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName) return { success: false, message: 'Please enter your name.' };
    if (!cleanPhone || cleanPhone.length < 4) {
      return { success: false, message: 'Please enter a valid phone number.' };
    }

    const currentUser = this.getCurrentUser();
    const user: AuthUser = {
      name: cleanName,
      phone: cleanPhone,
      isLoggedIn: true,
      flatId: currentUser.flatId,
      residenceId: currentUser.residenceId,
    };
    this.saveUser(user);
    return { success: true, user, message: `Welcome ${cleanName}!` };
  }

  static logout() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  }
}
