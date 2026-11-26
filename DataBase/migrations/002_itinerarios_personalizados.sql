-- Cada elemento del itinerario queda ligado al módulo que lo contiene.
ALTER TABLE academy.itinerario_contenidos
    ADD COLUMN IF NOT EXISTS modulo_id BIGINT;

UPDATE academy.itinerario_contenidos ic
SET modulo_id = c.modulo_id
FROM academy.contenidos c
WHERE c.id = ic.contenido_id
  AND ic.modulo_id IS NULL;

ALTER TABLE academy.itinerario_contenidos
    ALTER COLUMN modulo_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'academy.contenidos'::regclass AND conname = 'uq_contenidos_id_modulo') THEN
        ALTER TABLE academy.contenidos ADD CONSTRAINT uq_contenidos_id_modulo UNIQUE (id, modulo_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'academy.itinerarios'::regclass AND conname = 'uq_itinerarios_id_modulo') THEN
        ALTER TABLE academy.itinerarios ADD CONSTRAINT uq_itinerarios_id_modulo UNIQUE (id, modulo_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'academy.itinerario_contenidos'::regclass AND conname = 'fk_itinerario_contenido_modulo') THEN
        ALTER TABLE academy.itinerario_contenidos
            ADD CONSTRAINT fk_itinerario_contenido_modulo
            FOREIGN KEY (contenido_id, modulo_id) REFERENCES academy.contenidos(id, modulo_id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'academy.itinerario_contenidos'::regclass AND conname = 'fk_itinerario_padre_modulo') THEN
        ALTER TABLE academy.itinerario_contenidos
            ADD CONSTRAINT fk_itinerario_padre_modulo
            FOREIGN KEY (itinerario_id, modulo_id) REFERENCES academy.itinerarios(id, modulo_id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION academy.crear_itinerario_al_matricular()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado = 'activo' THEN
        INSERT INTO academy.itinerarios (alumno_id, modulo_id)
        SELECT NEW.alumno_id, m.id
        FROM academy.modulos m
        WHERE m.curso_id = NEW.curso_id
        ON CONFLICT (alumno_id, modulo_id) DO NOTHING;

        INSERT INTO academy.itinerario_contenidos (itinerario_id, modulo_id, contenido_id, orden)
        SELECT i.id, m.id, c.id,
               (COALESCE((SELECT MAX(ic.orden) FROM academy.itinerario_contenidos ic WHERE ic.itinerario_id = i.id), 0)
                + ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY c.orden, c.id))::integer
        FROM academy.itinerarios i
        JOIN academy.modulos m ON m.id = i.modulo_id AND m.curso_id = NEW.curso_id
        JOIN academy.contenidos c ON c.modulo_id = m.id AND c.disponible = TRUE
        WHERE i.alumno_id = NEW.alumno_id
        ON CONFLICT (itinerario_id, contenido_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_itinerario_al_matricular ON academy.matriculas;
CREATE TRIGGER trg_crear_itinerario_al_matricular
AFTER INSERT OR UPDATE OF estado ON academy.matriculas
FOR EACH ROW
EXECUTE FUNCTION academy.crear_itinerario_al_matricular();

-- Inicializa itinerarios de matrículas activas ya existentes.
INSERT INTO academy.itinerarios (alumno_id, modulo_id)
SELECT mat.alumno_id, m.id
FROM academy.matriculas mat
JOIN academy.modulos m ON m.curso_id = mat.curso_id
WHERE mat.estado = 'activo'
ON CONFLICT (alumno_id, modulo_id) DO NOTHING;

INSERT INTO academy.itinerario_contenidos (itinerario_id, modulo_id, contenido_id, orden)
SELECT i.id, m.id, c.id,
       (COALESCE((SELECT MAX(ic.orden) FROM academy.itinerario_contenidos ic WHERE ic.itinerario_id = i.id), 0)
        + ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY c.orden, c.id))::integer
FROM academy.itinerarios i
JOIN academy.modulos m ON m.id = i.modulo_id
JOIN academy.matriculas mat ON mat.alumno_id = i.alumno_id AND mat.curso_id = m.curso_id AND mat.estado = 'activo'
JOIN academy.contenidos c ON c.modulo_id = m.id AND c.disponible = TRUE
ON CONFLICT (itinerario_id, contenido_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_itinerario_contenidos_itinerario_orden
    ON academy.itinerario_contenidos(itinerario_id, orden);
