import type { GridColumn } from '@erp/web/ui';
import type { ContactLookups, ResUser } from '@erp/shared/contracts';
import type { UserRecord } from './user-record';
import { CHATTER_POSITIONS, NOTIFICATION_TYPES, ODOOBOT_STATES, SIDEBAR_TYPES, labelOf, nameOf } from './options';

const yes = (v?: boolean) => (v ? 'Yes' : '');
const num = (v?: number) => (v === undefined ? '' : v);

/** Every res.users column the source list could show, grouped for the column picker. */
export function userColumns(l: ContactLookups, users: ResUser[]): GridColumn<ResUser>[] {
  // create_uid / write_uid are res.users ids, so they are resolved against the users themselves
  const user = (id?: number) => (id ? (users.find(u => u.id === id)?.name ?? '') : '');
  return [
    { key: 'id', label: 'contacts.users.c.id', group: 'contacts.users.g.identity', right: true, text: u => u.id, on: false },
    { key: 'name', label: 'contacts.users.c.name', group: 'contacts.users.g.identity', kind: 'name', fixed: true, text: u => u.name, avatar: u => ({ name: u.name, round: true }) },
    { key: 'login', label: 'contacts.users.c.login', group: 'contacts.users.g.identity', text: u => u.login },
    { key: 'active', label: 'contacts.users.c.status', group: 'contacts.users.g.identity', kind: 'active', text: u => u.active },
    { key: 'share', label: 'contacts.users.c.userType', group: 'contacts.users.g.identity', kind: 'pill', text: u => (u.share ? 'Portal / Public' : 'Internal'), tone: u => (u.share ? 'amber' : 'blue') },
    { key: 'user_department_ids', label: 'contacts.users.c.userDepartment', group: 'contacts.users.g.identity', on: false, text: u => ((u as UserRecord).user_department_ids ?? (u.department_id ? [u.department_id] : [])).map(d => nameOf(l.departments, d)).join(', ') },
    { key: 'company_id', label: 'contacts.users.c.company', group: 'contacts.users.g.company', text: u => nameOf(l.companies, u.company_id) },
    { key: 'company_ids', label: 'contacts.users.c.allowedCompanies', group: 'contacts.users.g.company', on: false, text: u => u.company_ids.map(c => nameOf(l.companies, c)).join(', ') },
    { key: 'parent_id', label: 'contacts.users.c.relatedCompany', group: 'contacts.users.g.company', on: false, text: u => (u.parent_id ? `#${u.parent_id}` : '') },
    { key: 'email', label: 'contacts.users.c.email', group: 'contacts.users.g.contact', text: u => u.email },
    { key: 'phone', label: 'contacts.users.c.phone', group: 'contacts.users.g.contact', on: false, text: u => u.phone },
    { key: 'mobile', label: 'contacts.users.c.mobile', group: 'contacts.users.g.contact', on: false, text: u => u.mobile },
    { key: 'function', label: 'contacts.users.c.function', group: 'contacts.users.g.contact', on: false, text: u => u.function },
    { key: 'title', label: 'contacts.users.c.title', group: 'contacts.users.g.contact', on: false, text: u => nameOf(l.titles, u.title) },
    { key: 'lang', label: 'contacts.users.c.lang', group: 'contacts.users.g.contact', text: u => u.lang },
    { key: 'tz', label: 'contacts.users.c.tz', group: 'contacts.users.g.contact', on: false, text: u => u.tz },
    { key: 'website', label: 'contacts.users.c.website', group: 'contacts.users.g.contact', on: false, text: u => u.website },
    { key: 'vat', label: 'contacts.users.c.vat', group: 'contacts.users.g.contact', on: false, text: u => u.vat },
    { key: 'ref', label: 'contacts.users.c.ref', group: 'contacts.users.g.contact', on: false, text: u => u.ref },
    { key: 'arabic_name', label: 'contacts.users.c.arabicName', group: 'contacts.users.g.contact', on: false, text: u => u.arabic_name },
    { key: 'extension_number', label: 'contacts.users.c.extension', group: 'contacts.users.g.contact', on: false, text: u => u.extension_number },
    { key: 'street', label: 'contacts.users.c.street', group: 'contacts.users.g.address', on: false, text: u => u.street },
    { key: 'street2', label: 'contacts.users.c.street2', group: 'contacts.users.g.address', on: false, text: u => u.street2 },
    { key: 'city', label: 'contacts.users.c.city', group: 'contacts.users.g.address', on: false, text: u => u.city },
    { key: 'state_id', label: 'contacts.users.c.state', group: 'contacts.users.g.address', on: false, text: u => nameOf(l.states, u.state_id) },
    { key: 'zip', label: 'contacts.users.c.zip', group: 'contacts.users.g.address', on: false, text: u => u.zip },
    { key: 'country_id', label: 'contacts.users.c.country', group: 'contacts.users.g.address', on: false, text: u => nameOf(l.countries, u.country_id) },
    { key: 'login_date', label: 'contacts.users.c.loginDate', group: 'contacts.users.g.access', text: u => u.login_date },
    { key: 'groups', label: 'contacts.users.c.groups', group: 'contacts.users.g.access', right: true, text: u => u.groups.length },
    { key: 'emp', label: 'contacts.users.c.employee', group: 'contacts.users.g.access', text: u => u.emp?.name },
    { key: 'employee', label: 'contacts.users.c.isEmployee', group: 'contacts.users.g.access', on: false, text: u => yes(u.employee) },
    { key: 'signup_type', label: 'contacts.users.c.signupType', group: 'contacts.users.g.access', on: false, text: u => u.signup_type },
    { key: 'notification_type', label: 'contacts.users.c.notification', group: 'contacts.users.g.preferences', on: false, text: u => labelOf(NOTIFICATION_TYPES, u.notification_type) },
    { key: 'sidebar_type', label: 'contacts.users.c.sidebar', group: 'contacts.users.g.preferences', on: false, text: u => labelOf(SIDEBAR_TYPES, u.sidebar_type) },
    { key: 'chatter_position', label: 'contacts.users.c.chatter', group: 'contacts.users.g.preferences', on: false, text: u => labelOf(CHATTER_POSITIONS, u.chatter_position) },
    { key: 'odoobot_state', label: 'contacts.users.c.odoobot', group: 'contacts.users.g.preferences', on: false, text: u => labelOf(ODOOBOT_STATES, u.odoobot_state) },
    { key: 'action_id', label: 'contacts.users.c.homeAction', group: 'contacts.users.g.preferences', on: false, text: u => (u.action_id ? `#${u.action_id}` : '') },
    { key: 'sale_team_id', label: 'contacts.users.c.saleTeam', group: 'contacts.users.g.sales', on: false, text: u => nameOf(l.salesTeams, u.sale_team_id) },
    { key: 'target_sales_won', label: 'contacts.users.c.targetWon', group: 'contacts.users.g.sales', on: false, right: true, text: u => num(u.target_sales_won) },
    { key: 'target_sales_done', label: 'contacts.users.c.targetDone', group: 'contacts.users.g.sales', on: false, right: true, text: u => num(u.target_sales_done) },
    { key: 'target_sales_invoiced', label: 'contacts.users.c.targetInvoiced', group: 'contacts.users.g.sales', on: false, right: true, text: u => num(u.target_sales_invoiced) },
    { key: 'helpdesk_target_closed', label: 'contacts.users.c.helpdeskClosed', group: 'contacts.users.g.sales', on: false, right: true, text: u => num(u.helpdesk_target_closed) },
    { key: 'helpdesk_target_rating', label: 'contacts.users.c.helpdeskRating', group: 'contacts.users.g.sales', on: false, right: true, text: u => num(u.helpdesk_target_rating) },
    { key: 'helpdesk_target_success', label: 'contacts.users.c.helpdeskSuccess', group: 'contacts.users.g.sales', on: false, right: true, text: u => num(u.helpdesk_target_success) },
    { key: 'is_gcc_user', label: 'contacts.users.c.gcc', group: 'contacts.users.g.other', on: false, text: u => yes(u.is_gcc_user) },
    { key: 'pseudo_name', label: 'contacts.users.c.pseudoName', group: 'contacts.users.g.other', on: false, text: u => u.pseudo_name },
    { key: 'website_id', label: 'contacts.users.c.websiteId', group: 'contacts.users.g.other', on: false, text: u => (u.website_id ? `#${u.website_id}` : '') },
    { key: 'comment', label: 'contacts.users.c.comment', group: 'contacts.users.g.other', on: false, text: u => u.comment },
    { key: 'create_date', label: 'contacts.users.c.createDate', group: 'contacts.users.g.audit', on: false, text: u => u.create_date },
    { key: 'create_uid', label: 'contacts.users.c.createUid', group: 'contacts.users.g.audit', on: false, text: u => user(u.create_uid) },
    { key: 'write_date', label: 'contacts.users.c.writeDate', group: 'contacts.users.g.audit', on: false, text: u => u.write_date },
    { key: 'write_uid', label: 'contacts.users.c.writeUid', group: 'contacts.users.g.audit', on: false, text: u => user(u.write_uid) },
  ];
}
