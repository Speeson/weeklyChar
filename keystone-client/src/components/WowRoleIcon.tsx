import roleIcons from "../assets/wow-ui-role-icons-hq.png";
import type { KeystonePlannerRole } from "../core/types";

export function WowRoleIcon({ role }: { role: KeystonePlannerRole }) {
  return <span
    aria-hidden="true"
    className={`wow-role-icon wow-role-icon--${role}`}
    style={{ backgroundImage: `url(${roleIcons})` }}
  />;
}
