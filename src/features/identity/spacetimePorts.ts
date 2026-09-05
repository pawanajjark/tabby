import type { DbConnection } from '../../module_bindings/index.ts';
import { AuthManager } from '../../services/authManager.ts';
import type { IdentityPorts } from './actions.ts';
import { settleWithin } from '../../services/actionCoordinator.ts';

export type LocalIdentityPorts = Pick<
  IdentityPorts,
  'saveProfile' | 'saveFirstTaskItems' | 'switchAccount' | 'signOut' | 'beginRecovery' | 'connectAi' | 'disconnectAi'
> & {
  /** Forget device-local metadata only after authoritative account deletion commits. */
  forgetCurrentAccount(): Promise<void>;
};

export function createSpacetimeIdentityPorts(
  connection: () => DbConnection,
  local: LocalIdentityPorts,
): IdentityPorts {
  return {
    ...local,
    async createHome(home) {
      await settleWithin(
        connection().reducers.createHomeAndJoin({
          residenceName: home.residenceName.trim(),
          address: home.address.trim(),
          flatName: home.homeName.trim(),
          flatNumber: home.homeLabel.trim(),
          displayName: home.displayName.trim(),
        }),
        12_000,
        'Home creation timed out. Refresh and try again.',
      );
    },
    async lookupInvitation() {
      return null;
    },
    async joinHome() {
      throw new Error('Choose an existing home from the home list. Invitation codes are not used by this backend.');
    },
    async createInvitation() {
      throw new Error('Invitations are not available with the original backend.');
    },
    async saveHomeBasics() {
      return;
    },
    async switchHome(homeId) {
      const conn = connection();
      const identity = conn.identity?.toHexString();
      const member = identity
        ? [...conn.db.member.iter()].find(row => row.identity.toHexString() === identity)
        : undefined;
      await settleWithin(
        conn.reducers.joinFlat({
          flatId: homeId,
          displayName: member?.displayName || AuthManager.getCurrentUser().name || 'Housemate',
        }),
        12_000,
        'Joining the home timed out. Refresh and try again.',
      );
    },
    async deleteAccount() {
      throw new Error('Account deletion is not provided by the original backend.');
    },
  };
}
