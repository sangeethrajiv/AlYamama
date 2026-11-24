import { AccountingBackend } from '@erp/web/api-client';
import { PERM } from '@erp/shared/contracts';
import type { FieldDef, Option } from '@erp/web/metadata-forms';
import type { LineColumn, Row } from './lines-editor.component';
import type { ActionSpec, ResourceSpec } from './resource-spec';

const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

const TYPE_TAX_USE = opts(['sale', 'Sales'], ['purchase', 'Purchases'], ['none', 'None']);
const AMOUNT_TYPE = opts(['percent', 'Percentage of price'], ['fixed', 'Fixed'], ['division', 'Percentage of price tax included'], ['group', 'Group of taxes']);
const JOURNAL_TYPE = opts(['sale', 'Sale'], ['purchase', 'Purchase'], ['cash', 'Cash'], ['bank', 'Bank'], ['general', 'Miscellaneous']);
const ACCOUNT_TYPE_KIND = opts(['other', 'Regular'], ['receivable', 'Receivable'], ['payable', 'Payable'], ['liquidity', 'Bank and Cash']);
const INTERNAL_GROUP = opts(['asset', 'Asset'], ['liability', 'Liability'], ['equity', 'Equity'], ['income', 'Income'], ['expense', 'Expense']);
const METHOD = opts(['linear', 'Linear'], ['degressive', 'Degressive']);
const METHOD_TIME = opts(['number', 'Number of entries'], ['end', 'Ending date']);

/** Posted / approved documents cannot be edited. */
const lockedState = (r: Row) => ['posted', 'cancel', 'cancelled', 'close'].includes(String(r['state'] ?? ''));

/** Approval buttons shared by both voucher types (and bills use their own copy on the document page). */
const approvalActions = (statusKey = 'request_status'): ActionSpec[] => [
  { id: 'submit', label: 'Send for approval', when: r => r['state'] === 'draft' && ['not_required', 'rejected'].includes(String(r[statusKey])) },
  { id: 'approve', label: 'Approve', kind: 'primary', when: r => r[statusKey] === 'to_approve' },
  { id: 'reject', label: 'Reject', kind: 'danger', reason: 'Reason for rejection', when: r => r[statusKey] === 'to_approve' },
  { id: 'reset', label: 'Reset approval', when: r => r['state'] === 'draft' && r[statusKey] === 'rejected' },
];

export function makeSpecs(ab: AccountingBackend): Record<string, ResourceSpec> {
  const L = (k: Parameters<AccountingBackend['lookup']>[0], extra: Record<string, string> = {}) => ab.lookup(k, extra);
  const m2o = (key: string, label: string, lookup: Parameters<AccountingBackend['lookup']>[0], over: Partial<FieldDef> = {}, extra: Record<string, string> = {}): FieldDef =>
    ({ key, type: 'many2one', label, search: L(lookup, extra), ...over });
  const m2m = (key: string, label: string, lookup: Parameters<AccountingBackend['lookup']>[0], over: Partial<FieldDef> = {}): FieldDef =>
    ({ key, type: 'many2many', label, search: L(lookup), span: 'full', ...over });
  const text = (key: string, label: string, over: Partial<FieldDef> = {}): FieldDef => ({ key, type: 'text', label, ...over });
  const num = (key: string, label: string, over: Partial<FieldDef> = {}): FieldDef => ({ key, type: 'money', label, ...over });
  const date = (key: string, label: string, over: Partial<FieldDef> = {}): FieldDef => ({ key, type: 'date', label, ...over });
  const bool = (key: string, label: string): FieldDef => ({ key, type: 'boolean', label });
  const sel = (key: string, label: string, options: Option[], over: Partial<FieldDef> = {}): FieldDef => ({ key, type: 'select', label, options, emptyOption: false, ...over });
  const ro = (key: string, label: string): FieldDef => ({ key, type: 'readonly', label });

  const specs: ResourceSpec[] = [
    // ------------------------------------------------------------------ configuration
    {
      key: 'accounts', title: 'Chart of Accounts', singular: 'Account', api: '/accounting/accounts', path: 'chart-of-accounts', canCreate: true, canDelete: true,
      columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Account Name' }, { key: 'user_type_id', label: 'Type' }, { key: 'reconcile', label: 'Allow Reconciliation' }, { key: 'deprecated', label: 'Deprecated' }],
      filters: [{ key: 'deprecated', label: 'Status', options: [{ value: 'false', label: 'In use' }, { value: 'true', label: 'Deprecated' }] }],
      fields: [text('code', 'Code', { required: true }), text('name', 'Account Name', { required: true }), m2o('user_type_id', 'Type', 'accountTypes', { required: true }),
        m2o('group_id', 'Group', 'accountGroups'), m2o('currency_id', 'Account Currency', 'currencies'), bool('reconcile', 'Allow Reconciliation'), bool('deprecated', 'Deprecated'),
        { key: 'note', type: 'textarea', label: 'Internal Notes', span: 'full' }],
      blank: () => ({ reconcile: false, deprecated: false }),
    },
    {
      key: 'account-types', title: 'Account Types', singular: 'Account type', api: '/accounting/account-types', path: 'account-types', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Behaviour' }, { key: 'internal_group', label: 'Internal Group' }],
      fields: [text('name', 'Account Type', { required: true }), sel('type', 'Type', ACCOUNT_TYPE_KIND, { required: true }), sel('internal_group', 'Internal Group', INTERNAL_GROUP, { emptyOption: true }),
        bool('include_initial_balance', 'Bring Accounts Balance Forward'), { key: 'note', type: 'textarea', label: 'Description', span: 'full' }],
      blank: () => ({ type: 'other', include_initial_balance: false }),
    },
    {
      key: 'account-groups', title: 'Account Groups', singular: 'Account group', api: '/accounting/account-groups', path: 'account-groups', canCreate: true, canDelete: true,
      columns: [{ key: 'code_prefix', label: 'Code Prefix', mono: true }, { key: 'name', label: 'Name' }, { key: 'parent_id', label: 'Parent' }],
      fields: [text('name', 'Name', { required: true }), text('code_prefix', 'Code Prefix'), m2o('parent_id', 'Parent', 'accountGroups')],
      blank: () => ({}),
    },
    {
      key: 'taxes', title: 'Taxes', singular: 'Tax', api: '/accounting/taxes', path: 'taxes', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Tax Name' }, { key: 'type_tax_use', label: 'Tax Scope' }, { key: 'amount_type', label: 'Computation' }, { key: 'amount', label: 'Amount', right: true, mono: true }, { key: 'active', label: 'Active' }],
      filters: [{ key: 'type_tax_use', label: 'Scope', options: [{ value: 'sale', label: 'Sales' }, { value: 'purchase', label: 'Purchases' }] }],
      fields: [text('name', 'Tax Name', { required: true }), sel('type_tax_use', 'Tax Scope', TYPE_TAX_USE, { required: true }), sel('amount_type', 'Tax Computation', AMOUNT_TYPE, { required: true }),
        num('amount', 'Amount', { places: 4, visible: v => v['amount_type'] !== 'group' }), text('description', 'Label on Invoices'), bool('active', 'Active'),
        m2o('account_id', 'Tax Account', 'accounts', { visible: v => v['amount_type'] !== 'group' }), m2o('refund_account_id', 'Tax Account on Credit Notes', 'accounts', { visible: v => v['amount_type'] !== 'group' }),
        m2o('tax_group_id', 'Tax Group', 'taxGroups'), sel('tax_exigibility', 'Tax Due', opts(['on_invoice', 'Based on Invoice'], ['on_payment', 'Based on Payment'])),
        bool('price_include', 'Included in Price'), bool('include_base_amount', 'Affect Base of Subsequent Taxes'), bool('analytic', 'Include in Analytic Cost'),
        m2o('cash_basis_account_id', 'Cash Basis Transition Account', 'accounts', { visible: v => v['tax_exigibility'] === 'on_payment', hint: 'Holds the tax until the invoice is paid.' }),
        m2m('children_tax_ids', 'Children Taxes', 'taxes', { visible: v => v['amount_type'] === 'group' })],
      blank: () => ({ type_tax_use: 'sale', amount_type: 'percent', amount: '15.0000', active: true, price_include: false, include_base_amount: false, analytic: false, tax_exigibility: 'on_invoice' }),
    },
    {
      key: 'tax-groups', title: 'Tax Groups', singular: 'Tax group', api: '/accounting/tax-groups', path: 'tax-groups', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Name' }, { key: 'sequence', label: 'Sequence', right: true }],
      fields: [text('name', 'Name', { required: true }), { key: 'sequence', type: 'number', label: 'Sequence' }],
      blank: () => ({ sequence: 10 }),
    },
    {
      key: 'payment-terms', title: 'Payment Terms', singular: 'Payment term', api: '/accounting/payment-terms', path: 'payment-terms', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Payment Terms' }, { key: 'sequence', label: 'Sequence', right: true }, { key: 'active', label: 'Active' }],
      fields: [text('name', 'Payment Terms', { required: true }), { key: 'sequence', type: 'number', label: 'Sequence' }, bool('active', 'Active'), { key: 'note', type: 'textarea', label: 'Description on the Invoice', span: 'full' }],
      lines: [{
        key: 'line_ids', title: 'Terms',
        columns: [
          { key: 'value', label: 'Type', type: 'select', width: 'w-40', options: [{ value: 'balance', label: 'Balance' }, { value: 'percent', label: 'Percent' }, { value: 'fixed', label: 'Fixed Amount' }] },
          { key: 'value_amount', label: 'Value', type: 'number', width: 'w-32', right: true },
          { key: 'days', label: 'Number of Days', type: 'number', width: 'w-32', right: true },
          { key: 'option', label: 'Options', type: 'select', width: 'w-64', options: [{ value: 'day_after_invoice_date', label: 'Day(s) after the invoice date' }, { value: 'after_invoice_month', label: 'Day(s) after the end of the invoice month' }, { value: 'day_following_month', label: 'Day of the following month' }, { value: 'day_current_month', label: 'Day of the current month' }] },
          { key: 'day_of_the_month', label: 'Day of the Month', type: 'number', width: 'w-28', right: true },
        ],
        newRow: () => ({ value: 'balance', value_amount: '0', days: '0', option: 'day_after_invoice_date' }),
      }],
      blank: () => ({ active: true, sequence: 10, line_ids: [{ value: 'balance', value_amount: '0', days: '0', option: 'day_after_invoice_date' }] }),
    },
    {
      key: 'fiscal-positions', title: 'Fiscal Positions', singular: 'Fiscal position', api: '/accounting/fiscal-positions', path: 'fiscal-positions', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Fiscal Position' }, { key: 'country_id', label: 'Country' }, { key: 'auto_apply', label: 'Detect Automatically' }],
      fields: [text('name', 'Fiscal Position', { required: true }), bool('active', 'Active'), bool('auto_apply', 'Detect Automatically'), bool('vat_required', 'VAT Required'), { key: 'note', type: 'textarea', label: 'Notes', span: 'full' }],
      lines: [
        { key: 'tax_ids', title: 'Tax Mapping', columns: [m2oCol('tax_src_id', 'Tax on Product', L('taxes')), m2oCol('tax_dest_id', 'Tax to Apply', L('taxes'))], newRow: () => ({}) },
        { key: 'account_ids', title: 'Account Mapping', columns: [m2oCol('account_src_id', 'Account on Product', L('accounts')), m2oCol('account_dest_id', 'Account to Use Instead', L('accounts'))], newRow: () => ({}) },
      ],
      blank: () => ({ active: true, auto_apply: false, vat_required: false }),
    },
    {
      key: 'journals', title: 'Journals', singular: 'Journal', api: '/accounting/journals', path: 'journals', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Journal Name' }, { key: 'code', label: 'Short Code', mono: true }, { key: 'type', label: 'Type' }, { key: 'default_debit_account_id', label: 'Default Account' }, { key: 'active', label: 'Active' }],
      filters: [{ key: 'type', label: 'Type', options: JOURNAL_TYPE.map(o => ({ value: String(o.value), label: o.label })) }],
      fields: [text('name', 'Journal Name', { required: true }), text('code', 'Short Code', { required: true }), sel('type', 'Type', JOURNAL_TYPE, { required: true }),
        sel('invoice_category', 'Invoice Category', opts(['', 'None'], ['credit', 'Credit'], ['cash', 'Cash'], ['proforma', 'Proforma']), { visible: v => v['type'] === 'sale' }),
        m2o('default_debit_account_id', 'Default Debit Account', 'accounts'), m2o('default_credit_account_id', 'Default Credit Account', 'accounts'), m2o('currency_id', 'Currency', 'currencies'),
        bool('update_posted', 'Allow Cancelling Entries'), bool('refund_sequence', 'Dedicated Credit Note Sequence'), bool('group_invoice_lines', 'Group Invoice Lines'),
        bool('show_on_dashboard', 'Show on Dashboard'), bool('active', 'Active'),
        m2m('type_control_ids', 'Allowed Account Types', 'accountTypes'), m2m('account_control_ids', 'Allowed Accounts', 'accounts')],
      blank: () => ({ type: 'general', active: true, update_posted: false, refund_sequence: false, group_invoice_lines: false, show_on_dashboard: true }),
    },
    {
      key: 'currencies', title: 'Currencies', singular: 'Currency', api: '/accounting/currency-list', path: 'currencies', canCreate: true,
      columns: [{ key: 'name', label: 'Currency', mono: true }, { key: 'symbol', label: 'Symbol' }, { key: 'rounding', label: 'Rounding Factor', right: true, mono: true }, { key: 'decimal_places', label: 'Decimal Places', right: true }, { key: 'active', label: 'Active' }],
      listQuery: { active: 'all' },
      fields: [text('name', 'Currency', { required: true }), text('symbol', 'Symbol'), num('rounding', 'Rounding Factor', { places: 6 }), { key: 'decimal_places', type: 'number', label: 'Decimal Places' },
        sel('position', 'Symbol Position', opts(['after', 'After Amount'], ['before', 'Before Amount'])), bool('active', 'Active')],
      blank: () => ({ active: true, rounding: '0.010000', decimal_places: 2, position: 'after' }),
    },
    {
      key: 'currency-rates', title: 'Currency Rates', singular: 'Currency rate', api: '/accounting/currency-rates', path: 'currency-rates', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Date' }, { key: 'currency_id', label: 'Currency' }, { key: 'rate', label: 'Rate', right: true, mono: true }],
      fields: [date('name', 'Date', { required: true }), m2o('currency_id', 'Currency', 'currencies', { required: true }), num('rate', 'Rate (per 1 company currency)', { required: true, places: 10 })],
      blank: () => ({ rate: '1.0000000000' }),
    },
    {
      key: 'incoterms', title: 'Incoterms', singular: 'Incoterm', api: '/accounting/incoterms', path: 'incoterms', canCreate: true, canDelete: true,
      columns: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Name' }, { key: 'active', label: 'Active' }],
      fields: [text('name', 'Name', { required: true }), text('code', 'Code', { required: true }), bool('active', 'Active')],
      blank: () => ({ active: true }),
    },
    {
      key: 'reconcile-models', title: 'Reconciliation Models', singular: 'Reconciliation model', api: '/accounting/reconcile-models', path: 'reconcile-models', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Name' }, { key: 'rule_type', label: 'Type' }, { key: 'account_id', label: 'Account' }, { key: 'amount', label: 'Amount', right: true, mono: true }],
      fields: [text('name', 'Button Label', { required: true }), sel('rule_type', 'Type', opts(['writeoff_button', 'Manually create a write-off'], ['writeoff_suggestion', 'Suggest counterpart values'], ['invoice_matching', 'Match existing invoices/bills'])),
        sel('match_nature', 'Amount Nature', opts(['both', 'Amount Received/Paid'], ['amount_received', 'Amount Received'], ['amount_paid', 'Amount Paid'])), bool('auto_reconcile', 'Auto-validate'), bool('match_partner', 'Partner Is Set'),
        m2o('journal_id', 'Journal', 'journals'), m2o('account_id', 'Account', 'accounts'), text('label', 'Journal Item Label'), sel('amount_type', 'Amount Type', opts(['percentage', 'Percentage of balance'], ['fixed', 'Fixed'])),
        num('amount', 'Amount'), m2o('tax_id', 'Tax', 'taxes'), m2o('analytic_account_id', 'Analytic Account', 'analyticAccounts')],
      blank: () => ({ rule_type: 'writeoff_button', match_nature: 'both', amount_type: 'percentage', amount: '100', auto_reconcile: false, match_partner: false }),
    },
    {
      key: 'fiscal-years', title: 'Fiscal Years', singular: 'Fiscal year', api: '/accounting/fiscal-years', path: 'fiscal-years', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Fiscal Year' }, { key: 'date_from', label: 'Start Date' }, { key: 'date_to', label: 'End Date' }],
      fields: [text('name', 'Fiscal Year', { required: true }), date('date_from', 'Start Date', { required: true }), date('date_to', 'End Date', { required: true })],
      blank: () => ({}),
    },
    // ------------------------------------------------------------------ analytic
    {
      key: 'analytic-accounts', title: 'Analytic Accounts', singular: 'Analytic account', api: '/accounting/analytic-accounts', path: 'analytic-accounts', canCreate: true, canDelete: true,
      columns: [{ key: 'code', label: 'Reference', mono: true }, { key: 'name', label: 'Analytic Account' }, { key: 'group_id', label: 'Group' }, { key: 'partner_id', label: 'Customer' }, { key: 'active', label: 'Active' }],
      fields: [text('name', 'Analytic Account', { required: true }), text('code', 'Reference'), m2o('group_id', 'Group', 'analyticGroups'), m2o('partner_id', 'Customer', 'partners'), bool('active', 'Active')],
      blank: () => ({ active: true }),
    },
    {
      key: 'analytic-groups', title: 'Analytic Account Groups', singular: 'Analytic group', api: '/accounting/analytic-groups', path: 'analytic-groups', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Name' }, { key: 'parent_id', label: 'Parent' }],
      fields: [text('name', 'Name', { required: true }), m2o('parent_id', 'Parent', 'analyticGroups'), { key: 'description', type: 'textarea', label: 'Description', span: 'full' }],
      blank: () => ({}),
    },
    {
      key: 'analytic-items', title: 'Analytic Items', singular: 'Analytic item', api: '/accounting/analytic-lines', path: 'analytic-items',
      columns: [{ key: 'date', label: 'Date' }, { key: 'name', label: 'Description' }, { key: 'analytic_name', label: 'Analytic Account' }, { key: 'general_code', label: 'Financial Account', mono: true },
        { key: 'partner_name', label: 'Partner' }, { key: 'unit_amount', label: 'Quantity', right: true, mono: true }, { key: 'amount', label: 'Amount', right: true, mono: true }],
      fields: [], note: 'Created automatically when a journal item with an analytic account is posted.',
    },
    // ------------------------------------------------------------------ assets
    {
      key: 'asset-types', title: 'Asset Types', singular: 'Asset type', api: '/accounting/asset-types', path: 'asset-types', canCreate: true, canDelete: true,
      columns: [{ key: 'name', label: 'Asset Type' }, { key: 'type', label: 'Type' }, { key: 'method', label: 'Computation' }, { key: 'method_number', label: 'Entries', right: true }, { key: 'journal_id', label: 'Journal' }],
      fields: [text('name', 'Asset Type', { required: true }), sel('type', 'Type', opts(['purchase', 'Asset'], ['sale', 'Deferred Revenue'])), m2o('journal_id', 'Journal', 'journals', { required: true }),
        m2o('account_asset_id', 'Asset Account', 'accounts', { required: true }), m2o('account_depreciation_id', 'Depreciation Account', 'accounts', { required: true }),
        m2o('account_depreciation_expense_id', 'Expense Account', 'accounts', { required: true }), m2o('account_analytic_id', 'Analytic Account', 'analyticAccounts'),
        sel('method', 'Computation Method', METHOD), sel('method_time', 'Time Method Based On', METHOD_TIME),
        { key: 'method_number', type: 'number', label: 'Number of Entries', visible: v => v['method_time'] === 'number' }, date('method_end', 'Ending Date', { visible: v => v['method_time'] === 'end' }),
        { key: 'method_period', type: 'number', label: 'One Entry Every (months)', min: 1, max: 12 }, num('method_progress_factor', 'Degressive Factor', { places: 4, visible: v => v['method_time'] !== 'x' && v['method'] === 'degressive' }),
        bool('prorata', 'Prorata Temporis'), bool('open_asset', 'Auto-confirm Assets'), bool('group_entries', 'Group Journal Entries'), bool('active', 'Active')],
      blank: () => ({ type: 'purchase', method: 'linear', method_time: 'number', method_number: 5, method_period: 12, method_progress_factor: '0.3000', prorata: false, open_asset: false, group_entries: false, active: true }),
    },
    {
      key: 'assets', title: 'Assets', singular: 'Asset', api: '/accounting/assets', path: 'assets', canCreate: true, canDelete: true, stateKey: 'state',
      columns: [{ key: 'code', label: 'Reference', mono: true }, { key: 'name', label: 'Asset Name' }, { key: 'category_id', label: 'Asset Type' }, { key: 'date', label: 'Purchase Date' },
        { key: 'value', label: 'Gross Value', right: true, mono: true }, { key: 'book_value', label: 'Residual Value', right: true, mono: true }, { key: 'state', label: 'Status', pill: true }],
      filters: [{ key: 'state', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'open', label: 'Running' }, { value: 'close', label: 'Closed' }] }],
      fields: [text('name', 'Asset Name', { required: true }), text('code', 'Reference'), m2o('category_id', 'Asset Type', 'assetTypes', { required: true }), m2o('partner_id', 'Vendor', 'partners'),
        num('value', 'Gross Value', { required: true }), num('salvage_value', 'Salvage Value'), date('date', 'Purchase Date', { required: true }), sel('date_first_depreciation', 'First Depreciation', opts(['asset', 'Based on purchase date'], ['manual', 'Manual date'])),
        date('first_depreciation_manual_date', 'First Depreciation Date', { visible: v => v['date_first_depreciation'] === 'manual' }),
        sel('method', 'Computation Method', METHOD), sel('method_time', 'Time Method Based On', METHOD_TIME), { key: 'method_number', type: 'number', label: 'Number of Depreciations', visible: v => v['method_time'] === 'number' },
        date('method_end', 'Ending Date', { visible: v => v['method_time'] === 'end' }), { key: 'method_period', type: 'number', label: 'One Entry Every (months)', min: 1, max: 12 },
        bool('prorata', 'Prorata Temporis'), m2o('account_analytic_id', 'Analytic Account', 'analyticAccounts'), { key: 'note', type: 'textarea', label: 'Notes', span: 'full' }],
      lines: [{ key: 'depreciation_lines', title: 'Depreciation Board', readonly: true, newRow: () => ({}), columns: [
        { key: 'name', label: 'Depreciation Name', type: 'readonly' }, { key: 'depreciation_date', label: 'Date', type: 'readonly' }, { key: 'amount', label: 'Depreciation', type: 'readonly', right: true },
        { key: 'depreciated_value', label: 'Cumulative', type: 'readonly', right: true }, { key: 'remaining_value', label: 'Residual', type: 'readonly', right: true }, { key: 'move_name', label: 'Journal Entry', type: 'readonly' }] }],
      actions: [
        { id: 'confirm', label: 'Confirm', kind: 'primary', when: r => r['state'] === 'draft' },
        { id: 'compute-board', label: 'Compute Depreciation', when: r => r['state'] !== 'close' },
        { id: 'close', label: 'Sell or Dispose', when: r => r['state'] === 'open', confirm: 'Close this asset? Remaining unposted depreciation lines are removed.' },
        { id: 'draft', label: 'Set to Draft', when: r => r['state'] === 'open' },
      ],
      lockedWhen: r => r['state'] === 'close',
      blank: () => ({ date: new Date().toISOString().slice(0, 10), salvage_value: '0', date_first_depreciation: 'asset', method: 'linear', method_time: 'number', method_number: 5, method_period: 12, prorata: false }),
    },
    // ------------------------------------------------------------------ vouchers
    {
      key: 'internal-vouchers', title: 'Internal Vouchers', singular: 'Internal voucher', api: '/accounting/internal-vouchers', path: 'internal-vouchers', canCreate: true, canDelete: true, stateKey: 'state',
      columns: [{ key: 'name', label: 'Number', mono: true }, { key: 'date', label: 'Date' }, { key: 'journal_name', label: 'From Journal' }, { key: 'destination_name', label: 'To Journal' }, { key: 'amount', label: 'Amount', right: true, mono: true },
        { key: 'request_status', label: 'Approval', pill: true }, { key: 'state', label: 'Status', pill: true }],
      filters: [{ key: 'request_status', label: 'Approval', options: [{ value: 'to_approve', label: 'To approve' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }] }],
      fields: [m2o('journal_id', 'From Journal', 'journals', { required: true }), m2o('destination_journal_id', 'To Journal', 'journals', { required: true }), num('amount', 'Amount', { required: true }),
        date('payment_date', 'Payment Date', { required: true }), { key: 'description', type: 'textarea', label: 'Description', span: 'full' }],
      actions: [{ id: 'post', label: 'Post', kind: 'primary', when: r => r['state'] === 'draft' }, ...approvalActions(), { id: 'cancel', label: 'Cancel', kind: 'danger', when: r => r['state'] === 'posted', confirm: 'Cancel this voucher and remove its journal entry?' }],
      lockedWhen: r => r['state'] !== 'draft',
      blank: () => ({ payment_date: new Date().toISOString().slice(0, 10) }),
    },
    {
      key: 'payable-vouchers', title: 'Payable Vouchers', singular: 'Payable voucher', api: '/accounting/payable-vouchers', path: 'payable-vouchers', canCreate: true, canDelete: true, stateKey: 'state',
      columns: [{ key: 'name', label: 'Number', mono: true }, { key: 'date', label: 'Date' }, { key: 'partner_name', label: 'Vendor' }, { key: 'payment_mode', label: 'Mode' }, { key: 'amount', label: 'Amount', right: true, mono: true },
        { key: 'request_status', label: 'Approval', pill: true }, { key: 'state', label: 'Status', pill: true }],
      filters: [{ key: 'request_status', label: 'Approval', options: [{ value: 'to_approve', label: 'To approve' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }] }],
      fields: [m2o('partner_id', 'Vendor', 'partners', { required: true }), m2o('invoice_id', 'Vendor Bill', 'invoices', { hint: 'Optional. Fills the vendor and the amount due.' }, { move_type: 'in_invoice' }),
        m2o('payment_journal_id', 'Payment Journal', 'journals', { required: true }), num('amount', 'Amount'), date('date', 'Date', { required: true }),
        sel('payment_mode', 'Payment Mode', opts(['transfer', 'Bank Transfer'], ['cheque', 'Cheque'])), text('cheque_no', 'Cheque Number', { visible: v => v['payment_mode'] === 'cheque' }),
        text('reference', 'Reference'), text('po_number', 'PO Number'), { key: 'description', type: 'textarea', label: 'Description', span: 'full' }],
      actions: [{ id: 'post', label: 'Pay', kind: 'primary', when: r => r['state'] === 'draft' }, ...approvalActions()],
      lockedWhen: r => r['state'] !== 'draft',
      blank: () => ({ date: new Date().toISOString().slice(0, 10), payment_mode: 'transfer' }),
    },
    // ------------------------------------------------------------------ payments
    ...(['customer', 'vendor'] as const).map((who): ResourceSpec => {
      const inbound = who === 'customer';
      return {
        key: `${who}-payments`, title: inbound ? 'Customer Payments' : 'Vendor Payments', singular: 'Payment', api: '/accounting/payments', path: `${who}-payments`, canCreate: true, canDelete: true, stateKey: 'state',
        listQuery: { payment_type: inbound ? 'inbound' : 'outbound' },
        columns: [{ key: 'name', label: 'Number', mono: true }, { key: 'payment_date', label: 'Payment Date' }, { key: 'partner_id', label: inbound ? 'Customer' : 'Vendor' }, { key: 'communication', label: 'Memo' }, { key: 'amount', label: 'Amount', right: true, mono: true }, { key: 'state', label: 'Status', pill: true }],
        filters: [{ key: 'state', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }, { value: 'reconciled', label: 'Reconciled' }, { value: 'cancelled', label: 'Cancelled' }] }],
        fields: [sel('payment_type', 'Payment Type', opts(['inbound', 'Receive Money'], ['outbound', 'Send Money'])), m2o('partner_id', inbound ? 'Customer' : 'Vendor', 'partners', { required: true }),
          m2o('journal_id', 'Payment Journal', 'journals', { required: true }), num('amount', 'Payment Amount', { required: true }), date('payment_date', 'Payment Date', { required: true }),
          text('communication', 'Memo'), m2m('invoice_ids', inbound ? 'Invoices to Settle' : 'Bills to Settle', 'invoices')],
        actions: [{ id: 'post', label: 'Confirm', kind: 'primary', when: r => r['state'] === 'draft' }, { id: 'cancel', label: 'Cancel', kind: 'danger', when: r => ['posted', 'reconciled', 'draft'].includes(String(r['state'])), confirm: 'Cancel this payment? Settled invoices become open again.' },
          { id: 'draft', label: 'Reset to Draft', when: r => r['state'] === 'cancelled' }],
        lockedWhen: r => r['state'] !== 'draft',
        blank: () => ({ payment_type: inbound ? 'inbound' : 'outbound', payment_date: new Date().toISOString().slice(0, 10) }),
      };
    }),
    // ------------------------------------------------------------------ journal entries
    {
      key: 'journal-entries', title: 'Journal Entries', singular: 'Journal entry', api: '/accounting/moves', path: 'journal-entries', canCreate: true, canDelete: true, stateKey: 'state',
      listQuery: { move_type: 'entry' },
      columns: [{ key: 'name', label: 'Number', mono: true }, { key: 'date', label: 'Date' }, { key: 'ref', label: 'Reference' }, { key: 'journal_id', label: 'Journal' }, { key: 'amount', label: 'Total Amount', right: true, mono: true }, { key: 'state', label: 'Status', pill: true }],
      filters: [{ key: 'state', label: 'Status', options: [{ value: 'draft', label: 'Unposted' }, { value: 'posted', label: 'Posted' }, { value: 'cancel', label: 'Cancelled' }] }],
      fields: [m2o('journal_id', 'Journal', 'journals', { required: true }), date('date', 'Date', { required: true }), text('ref', 'Reference'), { key: 'narration', type: 'textarea', label: 'Internal Note', span: 'full' }],
      lines: [{ key: 'lines', title: 'Journal Items', newRow: () => ({ debit: '0', credit: '0' }), columns: [
        m2oCol('account_id', 'Account', L('accounts'), 'w-64'), m2oCol('partner_id', 'Partner', L('partners'), 'w-52'), { key: 'name', label: 'Label', type: 'text' },
        { key: 'debit', label: 'Debit', type: 'number', width: 'w-28', right: true }, { key: 'credit', label: 'Credit', type: 'number', width: 'w-28', right: true }] }],
      actions: [
        { id: 'post', label: 'Post', kind: 'primary', when: r => r['state'] === 'draft' },
        { id: 'reverse', label: 'Add Reversing Entry', when: r => r['state'] === 'posted', body: { post: true }, openResult: res => `journal-entries/${res['id']}` },
        { id: 'draft', label: 'Reset to Draft', when: r => ['posted', 'cancel'].includes(String(r['state'])) },
        { id: 'cancel', label: 'Cancel Entry', kind: 'danger', when: r => r['state'] !== 'cancel', confirm: 'Cancel this journal entry?' },
      ],
      lockedWhen: r => r['state'] !== 'draft',
      blank: () => ({ date: new Date().toISOString().slice(0, 10), lines: [{ debit: '0', credit: '0' }, { debit: '0', credit: '0' }] }),
    },
  ];
  // who may create, edit and act, and which record type carries notes and files
  const META: Record<string, { model?: string; perm?: string } | undefined> = {
    assets: { model: 'account.asset.asset', perm: PERM.account.write },
    'internal-vouchers': { model: 'account.internal.voucher', perm: PERM.payment.write },
    'payable-vouchers': { model: 'account.payable.voucher', perm: PERM.payment.write },
    'customer-payments': { model: 'account.payment', perm: PERM.payment.write },
    'vendor-payments': { model: 'account.payment', perm: PERM.payment.write },
    'journal-entries': { model: 'account.move', perm: PERM.journalEntry.post },
  };
  return Object.fromEntries(specs.map(s => [s.key, { ...s, model: META[s.key]?.model, perm: META[s.key]?.perm ?? PERM.account.write }]));
}

/** A many2one cell for a LinesSpec. */
function m2oCol(key: string, label: string, search: LineColumn['search'], width = 'w-60'): LineColumn {
  return { key, label, type: 'm2o', search, width };
}
