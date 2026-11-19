/** hr_employee row linked to a user (hr_employee.user_id). Many2one fields are ids. */
export interface Employee {
  id: number; name: string; active: boolean
  employee_code?: string; job_title?: string; job_id?: number; department_id?: number; parent_id?: number; coach_id?: number
  work_email?: string; work_phone?: string; mobile_phone?: string; work_location?: string
  date_of_joining?: string; date_of_relieving?: string; working_status?: string; company_id?: number
}

/** One res.users record with its linked res.partner fields and relations. Names are the real Odoo 12 column names. */
export interface ResUser {
  // res_users
  id: number
  active: boolean
  login: string
  company_id: number
  partner_id: number
  share?: boolean
  signature?: string
  action_id?: number
  create_date: string
  write_date: string
  create_uid?: number
  write_uid?: number
  notification_type: string
  odoobot_state: string
  sidebar_type: string
  chatter_position: string
  sale_team_id?: number
  target_sales_won?: number
  target_sales_done?: number
  target_sales_invoiced?: number
  website_id?: number
  helpdesk_target_closed?: number
  helpdesk_target_rating?: number
  helpdesk_target_success?: number
  pseudo_name?: string
  is_gcc_user?: boolean
  // res_partner (via partner_id)
  name: string
  email?: string
  phone?: string
  mobile?: string
  function?: string
  title?: number
  lang: string
  tz?: string
  country_id?: number
  state_id?: number
  city?: string
  street?: string
  street2?: string
  zip?: string
  website?: string
  comment?: string
  vat?: string
  ref?: string
  arabic_name?: string
  extension_number?: string
  parent_id?: number
  employee?: boolean
  signup_type?: string
  // relations
  company_ids: number[]
  groups: number[]
  login_date?: string
  logins?: string[]
  emp?: Employee
}
