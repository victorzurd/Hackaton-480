ALTER TABLE academy.usuarios
    ADD COLUMN IF NOT EXISTS edad SMALLINT,
    ADD COLUMN IF NOT EXISTS consentimiento_datos BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_consentimiento_datos TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS bolsa_trabajo BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'academy.usuarios'::regclass
          AND conname = 'ck_usuarios_edad_rango'
    ) THEN
        ALTER TABLE academy.usuarios
            ADD CONSTRAINT ck_usuarios_edad_rango
            CHECK (edad IS NULL OR edad BETWEEN 0 AND 120);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'academy.usuarios'::regclass
          AND conname = 'ck_usuarios_consentimiento_consistente'
    ) THEN
        ALTER TABLE academy.usuarios
            ADD CONSTRAINT ck_usuarios_consentimiento_consistente
            CHECK (consentimiento_datos = (fecha_consentimiento_datos IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'academy.usuarios'::regclass
          AND conname = 'ck_usuarios_bolsa_solo_adultos'
    ) THEN
        ALTER TABLE academy.usuarios
            ADD CONSTRAINT ck_usuarios_bolsa_solo_adultos
            CHECK ((edad IS NOT NULL AND edad >= 18) OR NOT bolsa_trabajo);
    END IF;
END $$;
