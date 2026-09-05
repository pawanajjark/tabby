import { Timestamp } from 'spacetimedb';
import type { DbConnection } from '../../module_bindings/index.ts';
import type { IdentityPorts } from './actions.ts';

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
      await connection().reducers.createHomeAndJoin({
        residenceName: home.residenceName.trim(),
        address: home.address.trim(),
        flatName: home.homeName.trim(),
        flatNumber: home.homeLabel.trim(),
        displayName: home.displayName.trim(),
      });
    },
    async lookupInvitation(code) {
      const preview = await connection().procedures.lookupHomeInvitation({ code });
      return preview ? {
        code: preview.code,
        homeId: preview.flatId,
        homeName: preview.flatName,
        homeLabel: preview.flatNumber,
        residenceName: preview.residenceName,
        invitedByName: preview.invitedByName,
        memberCount: preview.memberCount,
      } : null;
    },
    async joinHome(code, displayName) {
      await connection().reducers.joinHomeWithInvite({ code, displayName });
    },
    async createInvitation(invitation) {
      await connection().reducers.createHomeInvitation({
        code: invitation.code,
        recipient: invitation.recipient.trim(),
        expiresAt: Timestamp.fromDate(invitation.expiresAt),
      });
    },
    async saveHomeBasics(basics) {
      await connection().reducers.upsertHomeSettings(basics);
    },
    async switchHome(homeId) {
      await connection().reducers.switchHome({ flatId: homeId });
    },
    async deleteAccount() {
      await connection().reducers.deleteMyAccount({});
      await local.forgetCurrentAccount();
    },
  };
}
