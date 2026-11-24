import type { ViewDef } from '@erp/web/metadata-forms';

/** A user that is not stored yet has no id (the page seeds id 0). */
const isNewUser = (v: Record<string, unknown>) => !v['id'];

/** User form tabs 1 (general). Access, companies, activity are purpose-built. Field names are the source column names. */
export const USER_GENERAL_VIEW: ViewDef = {
  entity: 'user', type: 'form',
  sections: [
    { id: 'login', columns: 4, fields: [
      { key: 'name', type: 'text', label: 'contacts.user.f.name', required: true, span: 2 },
      { key: 'email', type: 'email', label: 'contacts.user.f.emailLogin', span: 2, validate: (v, r) => (!r['id'] && !String(v ?? '').trim() ? 'metadata.required' : null) },
      { key: 'new_password', type: 'password', label: 'contacts.users.newPassword', required: true, visible: isNewUser, span: 2 },
      { key: 'confirm_password', type: 'password', label: 'contacts.users.confirmPassword', required: true, visible: isNewUser, span: 2 },
      { key: 'arabic_name', type: 'text', label: 'contacts.user.f.arabicName', rtl: true, span: 2 },
      { key: 'department_id', type: 'many2one', label: 'contacts.user.e.department', resource: 'departments', span: 2 },
      { key: 'active', type: 'boolean', label: 'contacts.user.f.active', hint: 'contacts.user.hint.active', span: 2 },
      { key: 'employee', type: 'boolean', label: 'contacts.user.f.employee', hint: 'contacts.user.hint.employee', span: 2 },
    ] },
  ],
};

export const USER_PREFERENCES_VIEW: ViewDef = {
  entity: 'user', type: 'form',
  sections: [
    { id: 'prefs', title: 'contacts.user.section.preferences', fields: [
      { key: 'lang', type: 'many2one', label: 'contacts.user.f.lang', resource: 'languages', emptyOption: false },
      { key: 'tz', type: 'many2one', label: 'contacts.user.f.tz', resource: 'timezones' },
      { key: 'signature', type: 'image', label: 'contacts.user.f.signature', span: 'full' },
    ] },
    { id: 'other', title: 'contacts.user.section.other', fields: [
      { key: 'pseudo_name', type: 'text', label: 'contacts.user.f.pseudoName' },
      { key: 'is_gcc_user', type: 'boolean', label: 'contacts.user.f.gcc' },
    ] },
  ],
};
