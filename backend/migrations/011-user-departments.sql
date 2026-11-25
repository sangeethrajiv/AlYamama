-- 011: departments and the user <-> department many2many (res.users.user_department_ids).
-- Same table and column names as Odoo 12 (hr_department, department_user_rel) so the importer copies them 1:1.
-- Only the department itself is kept: the manager / members / jobs of hr.department point at hr.employee and are out of scope.
CREATE TABLE hr_department (
  id            serial PRIMARY KEY,
  name          varchar NOT NULL,
  complete_name varchar,
  active        boolean NOT NULL DEFAULT true,
  company_id    integer REFERENCES res_company (id) ON DELETE SET NULL,
  parent_id     integer                          -- hr_department.id; no FK so rows can load in any order
);

CREATE TABLE department_user_rel (
  user_id integer NOT NULL REFERENCES res_users (id) ON DELETE CASCADE,
  dept_id integer NOT NULL REFERENCES hr_department (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, dept_id)
);
CREATE INDEX department_user_rel_dept_idx ON department_user_rel (dept_id);
