import type { Option, ViewDef } from '@erp/web/metadata-forms';
import { CHATTER_POSITIONS, NOTIFICATION_TYPES, ODOOBOT_STATES, SIDEBAR_TYPES, WORKING_STATUSES } from '../models/options';

const stateOptions = (v: Record<string, unknown>, l: Record<string, Option[]>): Option[] => (l['states'] ?? []).filter(o => o.group === v['country_id']);

/** User form tabs 1 (general). Access, companies, activity are purpose-built. Field names are the source column names. */
export const USER_GENERAL_VIEW: ViewDef = {
  entity: 'user', type: 'form',
  sections: [
    { id: 'login', title: 'contacts.user.section.login', fields: [
      { key: 'name', type: 'text', label: 'contacts.user.f.name', required: true },
      { key: 'login', type: 'text', label: 'contacts.user.f.login', required: true },
      { key: 'arabic_name', type: 'text', label: 'contacts.user.f.arabicName', rtl: true },
      { key: 'signup_type', type: 'text', label: 'contacts.user.f.signupType' },
      { key: 'active', type: 'boolean', label: 'contacts.user.f.active', hint: 'contacts.user.hint.active' },
      { key: 'employee', type: 'boolean', label: 'contacts.user.f.employee', hint: 'contacts.user.hint.employee' },
    ] },
    { id: 'contact', title: 'contacts.user.section.contact', fields: [
      { key: 'email', type: 'email', label: 'contacts.user.f.email' }, { key: 'phone', type: 'tel', label: 'contacts.user.f.phone' },
      { key: 'mobile', type: 'tel', label: 'contacts.user.f.mobile' }, { key: 'extension_number', type: 'text', label: 'contacts.user.f.extension' },
      { key: 'function', type: 'text', label: 'contacts.user.f.function' },
      { key: 'title', type: 'many2one', label: 'contacts.user.f.title', resource: 'titles' },
      { key: 'website', type: 'text', label: 'contacts.user.f.website' },
    ] },
    { id: 'address', title: 'contacts.user.section.address', fields: [
      { key: 'street', type: 'text', label: 'contacts.user.f.street' }, { key: 'street2', type: 'text', label: 'contacts.user.f.street2' },
      { key: 'city', type: 'text', label: 'contacts.user.f.city' }, { key: 'zip', type: 'text', label: 'contacts.user.f.zip' },
      { key: 'country_id', type: 'many2one', label: 'contacts.user.f.country', resource: 'countries', clears: ['state_id'] },
      { key: 'state_id', type: 'many2one', label: 'contacts.user.f.state', options: stateOptions, disabled: v => !v['country_id'] },
    ] },
    { id: 'tax', title: 'contacts.user.section.tax', fields: [
      { key: 'vat', type: 'text', label: 'contacts.user.f.vat' }, { key: 'ref', type: 'text', label: 'contacts.user.f.ref' },
      { key: 'comment', type: 'textarea', label: 'contacts.user.f.comment', span: 'full' },
    ] },
  ],
};

export const USER_PREFERENCES_VIEW: ViewDef = {
  entity: 'user', type: 'form',
  sections: [
    { id: 'prefs', title: 'contacts.user.section.preferences', fields: [
      { key: 'lang', type: 'many2one', label: 'contacts.user.f.lang', resource: 'languages', emptyOption: false },
      { key: 'tz', type: 'many2one', label: 'contacts.user.f.tz', resource: 'timezones' },
      { key: 'notification_type', type: 'select', label: 'contacts.user.f.notificationType', options: NOTIFICATION_TYPES, emptyOption: false },
      { key: 'sidebar_type', type: 'select', label: 'contacts.user.f.sidebarType', options: SIDEBAR_TYPES, emptyOption: false },
      { key: 'chatter_position', type: 'select', label: 'contacts.user.f.chatterPosition', options: CHATTER_POSITIONS, emptyOption: false },
      { key: 'odoobot_state', type: 'select', label: 'contacts.user.f.odoobotState', options: ODOOBOT_STATES, emptyOption: false },
      { key: 'signature', type: 'textarea', label: 'contacts.user.f.signature', span: 'full' },
    ] },
    { id: 'sales', title: 'contacts.user.section.sales', fields: [
      { key: 'sale_team_id', type: 'many2one', label: 'contacts.user.f.saleTeam', resource: 'salesTeams' },
      { key: 'target_sales_won', type: 'number', label: 'contacts.user.f.targetWon' },
      { key: 'target_sales_done', type: 'number', label: 'contacts.user.f.targetDone' },
      { key: 'target_sales_invoiced', type: 'number', label: 'contacts.user.f.targetInvoiced' },
      { key: 'helpdesk_target_closed', type: 'number', label: 'contacts.user.f.helpdeskClosed' },
      { key: 'helpdesk_target_rating', type: 'number', label: 'contacts.user.f.helpdeskRating' },
      { key: 'helpdesk_target_success', type: 'number', label: 'contacts.user.f.helpdeskSuccess' },
    ] },
    { id: 'other', title: 'contacts.user.section.other', fields: [
      { key: 'pseudo_name', type: 'text', label: 'contacts.user.f.pseudoName' },
      { key: 'is_gcc_user', type: 'boolean', label: 'contacts.user.f.gcc' },
    ] },
  ],
};

export const USER_EMPLOYEE_VIEW: ViewDef = {
  entity: 'employee', type: 'form',
  sections: [{ id: 'emp', title: 'contacts.user.section.employee', fields: [
    { key: 'name', type: 'text', label: 'contacts.user.e.name' }, { key: 'employee_code', type: 'text', label: 'contacts.user.e.code' },
    { key: 'job_title', type: 'text', label: 'contacts.user.e.jobTitle' },
    { key: 'job_id', type: 'many2one', label: 'contacts.user.e.job', resource: 'jobs' },
    { key: 'department_id', type: 'many2one', label: 'contacts.user.e.department', resource: 'departments' },
    { key: 'company_id', type: 'many2one', label: 'contacts.user.e.company', resource: 'companies' },
    { key: 'parent_id', type: 'many2one', label: 'contacts.user.e.manager', resource: 'employees' },
    { key: 'coach_id', type: 'many2one', label: 'contacts.user.e.coach', resource: 'employees' },
    { key: 'working_status', type: 'select', label: 'contacts.user.e.workingStatus', options: WORKING_STATUSES },
    { key: 'work_location', type: 'text', label: 'contacts.user.e.workLocation' },
    { key: 'work_email', type: 'email', label: 'contacts.user.e.workEmail' }, { key: 'work_phone', type: 'tel', label: 'contacts.user.e.workPhone' },
    { key: 'mobile_phone', type: 'tel', label: 'contacts.user.e.workMobile' },
    { key: 'date_of_joining', type: 'date', label: 'contacts.user.e.joining' }, { key: 'date_of_relieving', type: 'date', label: 'contacts.user.e.relieving' },
    { key: 'active', type: 'boolean', label: 'contacts.user.e.active' },
  ] }],
};
