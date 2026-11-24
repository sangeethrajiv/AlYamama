import type { ResUser } from '@erp/shared/contracts';
import type { Rec } from '@erp/web/metadata-forms';

/**
 * The user record the Users screens work on: the shared `ResUser` plus `user_signature`, which the shared contract does not
 * declare. It passes through the API adapters untouched (they spread the saved user into the stored extras).
 *  - `user_department_ids` (on `ResUser`): many2many -> hr.department, read from and saved to the backend.
 *  - `user_signature`: binary image shown in Preferences. Odoo's separate html `signature` stays in `ResUser.signature`.
 */
export type UserRecord = ResUser & { user_signature?: string };

const IMAGE = /^data:image\//;

/** An earlier version of the form saved the uploaded image into `signature`. */
const legacyImage = (u: UserRecord): string | undefined => (u.signature && IMAGE.test(u.signature) ? u.signature : undefined);

/** Values the General and Preferences forms start from. */
export function userFormSeed(u: UserRecord): Rec {
  const image = legacyImage(u);
  return {
    ...structuredClone(u),
    user_department_ids: u.user_department_ids ?? (u.department_id ? [u.department_id] : []),
    user_signature: u.user_signature ?? image,
    // The html signature is kept as it is; only a migrated image is taken out of it.
    signature: image ? undefined : u.signature,
  } as unknown as Rec;
}

/** Cleans a merged form value: no empty department list, and the old single `department_id` is dropped once the list exists. */
export function tidyUserForm(r: Rec): Rec {
  const ids = r['user_department_ids'] as number[] | undefined;
  return { ...r, user_department_ids: ids?.length ? ids : undefined, department_id: undefined };
}
