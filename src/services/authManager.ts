import {
  AuthSessionStore,
  type AccountProfile,
  type ProfileMetadata,
  type SpacetimeSessionIdentity,
} from './authSession.ts';

export interface AuthUser {
  name: string;
  phone: string;
  email?: string;
  isLoggedIn: boolean;
  identity?: string;
  tokenLabel?: string;
  flatId?: string;
  residenceId?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  message: string;
}

function toAuthUser(account: AccountProfile | null): AuthUser {
  if (!account) return { name: '', phone: '', isLoggedIn: false };
  return {
    name: account.displayName,
    phone: account.phone ?? '',
    email: account.email,
    isLoggedIn: true,
    identity: account.identity,
    tokenLabel: account.tokenLabel,
    flatId: account.flatId,
    residenceId: account.homeId,
  };
}

export class AuthManager {
  private static sessions = new AuthSessionStore();

  /** @deprecated Demo identities are never valid session state. */
  static getDemoUser(): AuthUser {
    return toAuthUser(null);
  }

  static getCurrentUser(): AuthUser {
    return toAuthUser(this.sessions.getActiveAccount());
  }

  static getSavedAccounts(): AuthUser[] {
    return this.sessions.getState().accounts.map(account => toAuthUser(account));
  }

  /** Called only from the successful SpacetimeDB connection lifecycle. */
  static observeConnection(connection: SpacetimeSessionIdentity, metadata: ProfileMetadata = {}): AuthUser {
    return toAuthUser(this.sessions.observeConnection(connection, metadata));
  }

  /** Display fields alone cannot create an authenticated session. */
  static signIn(phone: string, name: string): AuthResult {
    if (!name.trim()) return { success: false, message: 'Please enter your name.' };
    if (!phone.trim()) return { success: false, message: 'Please enter a valid phone number.' };
    const active = this.sessions.getActiveAccount();
    if (!active) return { success: false, message: 'Connect an account before continuing.' };
    const account = this.sessions.updateProfile(active.identity, { displayName: name, phone });
    return { success: true, user: toAuthUser(account), message: `Welcome ${account.displayName}!` };
  }

  /** Updates metadata only for the identity already established by the connection. */
  static saveUser(user: AuthUser): void {
    const active = this.sessions.getActiveAccount();
    if (!active) throw new Error('A connected SpacetimeDB account is required.');
    if (user.identity && user.identity.toLowerCase() !== active.identity) {
      throw new Error('Profile identity does not match the connected account.');
    }
    this.sessions.updateProfile(active.identity, {
      displayName: user.name,
      phone: user.phone,
      email: user.email,
      homeId: user.residenceId,
      flatId: user.flatId,
    });
  }

  /** Returns the token label the connection layer should reconnect with. */
  static switchAccount(identity: string): string | undefined {
    return this.sessions.requestAccountSwitch(identity).tokenLabel;
  }

  static logout(options: { forgetAccount?: boolean } = {}): void {
    this.sessions.signOut(options);
  }

  /** Called only after deleteMyAccount is acknowledged by SpacetimeDB. */
  static forgetCurrentAccount(): AuthUser | null {
    const removed = this.sessions.forgetActiveAccount();
    return removed ? toAuthUser(removed) : null;
  }
}
