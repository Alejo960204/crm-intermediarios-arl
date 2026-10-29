-- Requerimiento 17: ajustes de las pestañas 3 y 4. Idempotente.
-- «Línea telefónica 3» pasa a ser «Línea de atención vía WhatsApp» y «Fax» pasa a ser «Enlace web».
-- Los valores existentes se conservan; si no cumplen el nuevo formato se pedirá corregirlos al guardar la pestaña.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infraestructura_operativa' AND column_name = 'linea_3') THEN
        ALTER TABLE infraestructura_operativa RENAME COLUMN linea_3 TO whatsapp;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infraestructura_operativa' AND column_name = 'fax') THEN
        ALTER TABLE infraestructura_operativa RENAME COLUMN fax TO enlace_web;
    END IF;
END $$;
