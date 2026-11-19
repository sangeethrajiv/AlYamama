# Phase 1 field map (Odoo 12 -> Postgres)

Source: static AST scan of Odoo 12 core + Yamama custom addons. Selection values, defaults and onchange logic not fully checked; confirm in source. Columns keep the Odoo 12 name. Fields marked ~ are computed (stored only if Odoo stored them: check source). Out-of-scope addons (account, stock, pricelist, HR, vehicle sync) are listed at the end, not mapped.

## Type mapping

| Odoo field | Postgres | Notes |
|---|---|---|
| Char | varchar (size) | |
| Char/Text translate=True | jsonb {en,ar} | open Q1 |
| Text | text | |
| Integer | integer | |
| Float(digits) | numeric(p,s) | never float8 for qty/money |
| Monetary | numeric | + currency_id |
| Boolean | boolean | |
| Date / Datetime | date / timestamp | |
| Selection | varchar + CHECK | |
| Binary | bytea or file store | decide with me |
| Many2one | integer FK, ON DELETE per field | |
| One2many | no column | inverse m2o on the other table |
| Many2many | <t1>_<t2>_rel (col1, col2, PK both) | default names as Odoo; override as in source |
| company_dependent | out of scope now | plain nullable integer/ value, no FK |
| id, create_uid/date, write_uid/date | serial PK + audit columns | every model |


## res.partner

- constraint (base): `CHECK( (type='contact' AND name IS NOT NULL) or (type!='contact') )` - Contacts require a name.
- constraint (delivery_order_custom): `unique (company_name_code)` - Company Code already exists!

| column | type | addon | flags |
|---|---|---|---|
| name | Char | base |  |
| display_name | Char | base | computed |
| date | Date | base |  |
| title | Many2one(res.partner.title) | base |  |
| parent_id | Many2one(res.partner) | base |  |
| parent_name | Char | base | computed |
| child_ids | One2many(res.partner) | base |  |
| ref | Char | base |  |
| lang | Selection | base |  |
| tz | Selection | base |  |
| tz_offset | Char | base | computed |
| user_id | Many2one(res.users) | base |  |
| vat | Char | base |  |
| bank_ids | One2many(res.partner.bank) | base |  |
| website | Char | base |  |
| comment | Text | base |  |
| category_id | Many2many(res.partner.category) | base |  |
| credit_limit | Float | base |  |
| barcode | Char | base |  |
| active | Boolean | base |  |
| customer | Boolean | base |  |
| supplier | Boolean | base |  |
| employee | Boolean | base |  |
| function | Char | base |  |
| type | Selection | att_installation_request |  |
| street | Char | base |  |
| street2 | Char | base |  |
| zip | Char | base |  |
| city | Char | base |  |
| state_id | Many2one(res.country.state) | base |  |
| country_id | Many2one(res.country) | base |  |
| email | Char | base |  |
| email_formatted | Char | base | computed |
| phone | Char | base |  |
| mobile | Char | base |  |
| is_company | Boolean | base |  |
| industry_id | Many2one(res.partner.industry) | base |  |
| company_type | Selection | base | computed |
| company_id | Many2one(res.company) | base |  |
| color | Integer | base |  |
| user_ids | One2many(res.users) | base |  |
| partner_share | Boolean | base | computed |
| contact_address | Char | base | computed |
| commercial_partner_id | Many2one(res.partner) | base | computed |
| commercial_company_name | Char | base | computed |
| company_name | Char | base |  |
| image | Binary | base |  |
| image_medium | Binary | base |  |
| image_small | Binary | base |  |
| self | Many2one(<expr>) | base | computed |
| property_product_pricelist | Many2one(product.pricelist) | product | computed |
| customer_discount | Float | att_customer_pricelist |  |
| company_name_code | Char | delivery_order_custom |  |
| child_company_ids | One2many(res.partner) | att_installation_request |  |
| fax | Char | sale_custom |  |
| discount | Float | sale_custom |  |
| arabic_name | Char | sale_custom |  |
| cash_customer | Boolean | sale_custom |  |
| customer_code | Char | sale_custom |  |
| vat_arabic | Char | sale_custom |  |
| vandor_number | Char | sale_custom |  |
| arabic_street2_name | Char | sale_custom |  |
| arabic_city_name | Char | sale_custom |  |
| cr_number | Char | sale_custom |  |
| vehicle_ids | One2many(att.installation.request.lines) | subscription_management |  |
| l10n_sa_edi_building_number | Char | l10n_sa_edi |  |
| l10n_sa_edi_plot_identification | Char | l10n_sa_edi |  |
| l10n_sa_additional_identification_scheme | Selection | l10n_sa_edi |  |
| l10n_sa_additional_identification_number | Char | l10n_sa_edi |  |
| country_code | Char | l10n_sa_edi | computed |
| l10n_sa_registered_name | Char | l10n_sa_edi |  |
| image_sign | Binary | purchase_request |  |
| image_seal | Binary | purchase_request |  |

## res.partner.category


| column | type | addon | flags |
|---|---|---|---|
| name | Char | base | required, translate |
| color | Integer | base |  |
| parent_id | Many2one(res.partner.category) | base |  |
| child_ids | One2many(res.partner.category) | base |  |
| active | Boolean | base |  |
| parent_path | Char | base |  |
| partner_ids | Many2many(res.partner) | base |  |

## res.partner.title


| column | type | addon | flags |
|---|---|---|---|
| name | Char | base | required, translate |
| shortcut | Char | base | translate |

## res.partner.industry


| column | type | addon | flags |
|---|---|---|---|
| name | Char | base | translate |
| full_name | Char | base | translate |
| active | Boolean | base |  |

## res.bank


| column | type | addon | flags |
|---|---|---|---|
| name | Char | base | required |
| street | Char | base |  |
| street2 | Char | base |  |
| zip | Char | base |  |
| city | Char | base |  |
| state | Many2one(res.country.state) | base |  |
| country | Many2one(res.country) | base |  |
| email | Char | base |  |
| phone | Char | base |  |
| active | Boolean | base |  |
| bic | Char | base |  |

## res.partner.bank

- constraint (base): `unique(sanitized_acc_number, company_id)` - Account Number must be unique

| column | type | addon | flags |
|---|---|---|---|
| acc_type | Selection | base | computed |
| acc_number | Char | base | required |
| sanitized_acc_number | Char | base | computed |
| acc_holder_name | Char | base |  |
| partner_id | Many2one(res.partner) | base | required |
| bank_id | Many2one(res.bank) | base |  |
| bank_name | Char | base | computed |
| bank_bic | Char | base | computed |
| sequence | Integer | base |  |
| currency_id | Many2one(res.currency) | base |  |
| company_id | Many2one(res.company) | base |  |
| qr_code_valid | Boolean | base | computed |
| show_in_report | Boolean | account_customization |  |
| iban | Char | account_customization |  |

## res.country

- constraint (base): `unique (name)` - The name of the country must be unique !
- constraint (base): `unique (code)` - The code of the country must be unique !

| column | type | addon | flags |
|---|---|---|---|
| name | Char | base | required, translate |
| code | Char | base |  |
| address_format | Text | base |  |
| address_view_id | Many2one(ir.ui.view) | base |  |
| currency_id | Many2one(res.currency) | base |  |
| image | Binary | base |  |
| phone_code | Integer | base |  |
| country_group_ids | Many2many(res.country.group) | base |  |
| state_ids | One2many(res.country.state) | base |  |
| name_position | Selection | base |  |
| vat_label | Char | base | translate |
| local_name | Char | sale_custom |  |

## res.country.state

- constraint (base): `unique(country_id, code)` - The code of the state must be unique by country !

| column | type | addon | flags |
|---|---|---|---|
| country_id | Many2one(res.country) | base | required |
| name | Char | base | required |
| code | Char | base | required |

## uom.category

- constraint (uom): `UNIQUE(measure_type)` - You can have only one category per measurement type.

| column | type | addon | flags |
|---|---|---|---|
| name | Char | uom | required, translate |
| measure_type | Selection | uom |  |

## uom.uom

- constraint (uom): `CHECK (factor!=0)` - The conversion ratio for a unit of measure cannot be 0!
- constraint (uom): `CHECK (rounding>0)` - The rounding precision must be strictly positive.
- constraint (uom): `CHECK((uom_type = 'reference' AND factor = 1.0) OR (uom_type != 'reference'))` - The reference unit must have a conversion factor equal to 1.

| column | type | addon | flags |
|---|---|---|---|
| name | Char | uom | required, translate |
| category_id | Many2one(uom.category) | uom | required |
| factor | Float | uom | required |
| factor_inv | Float | uom | required, computed |
| rounding | Float | uom | required |
| active | Boolean | uom |  |
| uom_type | Selection | uom |  |
| measure_type | Selection | uom | computed |
| view_name | Char | purchase_custom |  |

## product.category


| column | type | addon | flags |
|---|---|---|---|
| name | Char | product | required, translate |
| complete_name | Char | product | computed |
| parent_id | Many2one(product.category) | product |  |
| parent_path | Char | product |  |
| child_id | One2many(product.category) | product |  |
| product_count | Integer | product | computed |
| lot_sequence_id | Many2one(ir.sequence) | att_product_tracking |  |
| arabic_name | Char | sale_custom |  |
| sequence_code | Char | sale_custom |  |
| sequence_id | Many2one(ir.sequence) | sale_custom |  |

## product.template


| column | type | addon | flags |
|---|---|---|---|
| name | Char | product | required, translate |
| sequence | Integer | product |  |
| description | Text | product | translate |
| description_purchase | Text | product | translate |
| description_sale | Text | product | translate |
| type | Selection | product | required |
| rental | Boolean | product |  |
| categ_id | Many2one(product.category) | product | required |
| currency_id | Many2one(res.currency) | product | computed |
| price | Float | product | computed |
| list_price | Float | product |  |
| lst_price | Float | product | computed |
| standard_price | Float | product | computed |
| volume | Float | product | computed |
| weight | Float | product | computed |
| weight_uom_id | Many2one(uom.uom) | product | computed |
| weight_uom_name | Char | product | computed |
| sale_ok | Boolean | product |  |
| purchase_ok | Boolean | product |  |
| pricelist_id | Many2one(product.pricelist) | product |  |
| uom_id | Many2one(uom.uom) | product | required |
| uom_name | Char | product | computed |
| uom_po_id | Many2one(uom.uom) | product | required |
| company_id | Many2one(res.company) | product |  |
| packaging_ids | One2many(product.packaging) | product | computed |
| seller_ids | One2many(product.supplierinfo) | product |  |
| variant_seller_ids | One2many(product.supplierinfo) | product |  |
| active | Boolean | product |  |
| color | Integer | product |  |
| is_product_variant | Boolean | product | computed |
| attribute_line_ids | One2many(product.template.attribute.line) | product |  |
| product_variant_ids | One2many(product.product) | product | required |
| product_variant_id | Many2one(product.product) | product | computed |
| product_variant_count | Integer | product | computed |
| barcode | Char | product | computed |
| default_code | Char | product | computed |
| item_ids | One2many(product.pricelist.item) | product |  |
| image | Binary | product |  |
| image_medium | Binary | product |  |
| image_small | Binary | product |  |
| no_discount | Boolean | att_customer_pricelist |  |
| product_type_id | Many2one(att.product.type) | stock_customization |  |
| arabic_name | Char | sale_custom |  |
| internal_short_code | Char | sale_custom |  |
| customer_ids | One2many(product.customerinfo) | sale_custom |  |
| is_teltonika_product | Boolean | sale_custom |  |
| is_vehicle_subscription | Boolean | subscription_management |  |
| purchase_request | Boolean | purchase_request |  |
| is_purchased_product | Boolean | purchase_custom | computed |
| purchase_order_lines | One2many(purchase.order.line) | purchase_custom |  |

## product.product

- constraint (product): `unique(barcode)` - A barcode can only be assigned to one product !

| column | type | addon | flags |
|---|---|---|---|
| price | Float | product | computed |
| price_extra | Float | product | computed |
| lst_price | Float | product | computed |
| default_code | Char | product |  |
| code | Char | product | computed |
| partner_ref | Char | product | computed |
| active | Boolean | product |  |
| product_tmpl_id | Many2one(product.template) | product | required |
| barcode | Char | product |  |
| attribute_value_ids | Many2many(product.attribute.value) | product |  |
| product_template_attribute_value_ids | Many2many(product.template.attribute.value) | product | computed |
| image_variant | Binary | product |  |
| image | Binary | product | computed |
| image_small | Binary | product | computed |
| image_medium | Binary | product | computed |
| is_product_variant | Boolean | product | computed |
| standard_price | Float | product | company_dependent |
| volume | Float | product |  |
| weight | Float | product |  |
| pricelist_item_ids | Many2many(product.pricelist.item) | product | computed |
| packaging_ids | One2many(product.packaging) | product |  |
| no_discount | Boolean | att_customer_pricelist | computed |

## Deferred (out of scope, columns as plain integer if referenced)
res.partner: property_account_payable_id, property_account_receivable_id, property_account_position_id, property_payment_term_id, property_supplier_payment_term_id, credit/debit/total_invoiced (computed), trust, invoice_warn(_msg), debit_limit, property_product_pricelist, vehicle_ids, vehicle-sync fields. product.template/category: taxes_id, supplier_taxes_id, property_account_*, valuation/cost method, stock routes/locations/tracking-related stock fields, asset categories, seller_ids, packaging, pricelist items.
