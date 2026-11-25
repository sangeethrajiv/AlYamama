-- 015: the product picture (Odoo 12 product.template.image), stored as bytea like res_partner.image.
-- Odoo keeps the resized copies (image_medium, image_small) as well; the Angular UI shows one picture, so only `image` is stored.
ALTER TABLE product_template ADD COLUMN image bytea;
