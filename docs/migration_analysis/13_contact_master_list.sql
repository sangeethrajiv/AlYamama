-- 13_contact_master_list.sql
-- Contact Master list - Odoo 12.0 res.partner, BASE fields only.
--
-- READ-ONLY. A plain SELECT: no view, no column, no schema or data change.
-- Column aliases are the real Odoo field names. Relational fields are returned
-- as <field> (the id) and <field>__name (the label read from the base related model).
--
-- Only stock-Odoo (module `base`) columns of res_partner and base lookup tables are used.
-- Deliberately NOT used although physically present in res_partner (other modules):
--   account, sale, purchase, stock, crm, mail, website, auth_signup, l10n_sa_edi,
--   sale_custom, att_*, delivery_order_custom, ... (full list: 13_contact_master_fields.md, section 3)
--
-- Parameters (psql: -v active=true -v limit=100) are optional; defaults below.
--   :active  true | false | all   (Odoo default filter = true)

SELECT
    p.id,                                                   -- id
    p.display_name,                                         -- display_name (stored computed)
    CASE WHEN p.is_company THEN 'company' ELSE 'person' END AS company_type,  -- same rule as _compute_company_type
    p.is_company,
    p.type,                                                 -- contact|invoice|delivery|other|private (+2 custom values in live DB)
    p.name,
    p.title,            t.name        AS title__name,       -- res.partner.title
    p.function,
    p.parent_id,        par.display_name AS parent_id__name,-- res.partner (self)
    (SELECT count(*) FROM res_partner c
      WHERE c.parent_id = p.id AND c.active) AS child_ids__count,   -- child_ids (O2M, active only, as in the ORM domain)
    p.commercial_partner_id,
    p.commercial_company_name,
    p.ref,
    p.vat,
    p.email,
    p.phone,
    p.mobile,
    p.website,
    p.street,
    p.street2,
    p.city,
    p.state_id,         st.name       AS state_id__name,    -- res.country.state
    p.zip,
    p.country_id,       co.name       AS country_id__name,  -- res.country
    p.lang,
    p.tz,
    p.user_id,          up.name       AS user_id__name,     -- res.users -> its partner name
    p.company_id,       rc.name       AS company_id__name,  -- res.company
    (SELECT string_agg(cat.name, ', ' ORDER BY cat.name)
       FROM res_partner_res_partner_category_rel rel
       JOIN res_partner_category cat ON cat.id = rel.category_id
      WHERE rel.partner_id = p.id)    AS category_id__names,-- res.partner.category (M2M)
    p.industry_id,      ind.name      AS industry_id__name, -- res.partner.industry
    p.customer,
    p.supplier,
    p.employee,
    p.comment,
    p.active,
    p.create_date, p.create_uid,
    p.write_date,  p.write_uid
FROM res_partner p
LEFT JOIN res_partner_title    t   ON t.id   = p.title
LEFT JOIN res_partner          par ON par.id = p.parent_id
LEFT JOIN res_country_state    st  ON st.id  = p.state_id
LEFT JOIN res_country          co  ON co.id  = p.country_id
LEFT JOIN res_users            u   ON u.id   = p.user_id
LEFT JOIN res_partner          up  ON up.id  = u.partner_id
LEFT JOIN res_company          rc  ON rc.id  = p.company_id
LEFT JOIN res_partner_industry ind ON ind.id = p.industry_id
WHERE p.active                              -- change to remove/negate for Archived / All
ORDER BY p.display_name                     -- res.partner _order = "display_name"
LIMIT 100;
