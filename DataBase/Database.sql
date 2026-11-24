
-- =========================================================
-- 480 ACADEMY
-- BASE DE DATOS POSTGRESQL
-- =========================================================

CREATE SCHEMA IF NOT EXISTS academy;
SET search_path TO academy;

-- =========================================================
-- 1. USUARIOS
-- =========================================================

CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(150),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL
        CHECK (rol IN ('alumno', 'tutor', 'admin')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Relación entre tutores y alumnos
CREATE TABLE tutor_alumnos (
    tutor_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tutor_id, alumno_id),
    CHECK (tutor_id <> alumno_id)
);

-- =========================================================
-- 2. CURSOS Y MATRÍCULAS
-- =========================================================

CREATE TABLE cursos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE matriculas (
    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    fecha_matricula TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'finalizado', 'cancelado')),
    PRIMARY KEY (alumno_id, curso_id)
);

-- =========================================================
-- 3. MODULOS
-- =========================================================

CREATE TABLE modulos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL CHECK (orden > 0),
    UNIQUE (curso_id, orden)
);

-- =========================================================
-- 4. CONTENIDOS
-- =========================================================

CREATE TABLE contenidos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modulo_id BIGINT NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
    contenido_origen_id BIGINT REFERENCES contenidos(id) ON DELETE SET NULL,

    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,

    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('video', 'podcast', 'video_corto')),

    url TEXT,
    duracion_segundos INTEGER CHECK (duracion_segundos >= 0),
    orden INTEGER NOT NULL CHECK (orden > 0),

    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (modulo_id, orden)
);

-- =========================================================
-- 5. TRANSCRIPCIONES
-- =========================================================

CREATE TABLE transcripciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contenido_id BIGINT NOT NULL REFERENCES contenidos(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    idioma VARCHAR(10) NOT NULL DEFAULT 'es',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fragmentos temporales de una transcripción
CREATE TABLE fragmentos_transcripcion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transcripcion_id BIGINT NOT NULL
        REFERENCES transcripciones(id) ON DELETE CASCADE,
    tiempo_inicio INTEGER NOT NULL CHECK (tiempo_inicio >= 0),
    tiempo_fin INTEGER NOT NULL,
    texto TEXT NOT NULL,
    CHECK (tiempo_fin > tiempo_inicio)
);

-- =========================================================
-- 6. EVALUACIONES
-- =========================================================

-- Una evaluación representa un test inicial,
-- un test intermedio o un examen final.

CREATE TABLE evaluaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    modulo_id BIGINT NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
    contenido_id BIGINT REFERENCES contenidos(id) ON DELETE CASCADE,

    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('inicial', 'intermedia', 'final')),

    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (tipo = 'inicial' AND contenido_id IS NULL)
        OR
        (tipo IN ('intermedia', 'final') AND contenido_id IS NOT NULL)
    )
);

-- Un único test inicial por módulo
CREATE UNIQUE INDEX uq_evaluacion_inicial
ON evaluaciones(modulo_id)
WHERE tipo = 'inicial';

-- Un único test intermedio por contenido
CREATE UNIQUE INDEX uq_evaluacion_intermedia
ON evaluaciones(contenido_id)
WHERE tipo = 'intermedia';

-- Un único examen final por contenido
CREATE UNIQUE INDEX uq_evaluacion_final
ON evaluaciones(contenido_id)
WHERE tipo = 'final';

-- =========================================================
-- 7. PREGUNTAS
-- =========================================================

CREATE TABLE preguntas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    modulo_id BIGINT NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
    contenido_id BIGINT REFERENCES contenidos(id) ON DELETE SET NULL,

    enunciado TEXT NOT NULL,

    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('escrita', 'visual', 'oral')),

    tipo_interaccion VARCHAR(30)
        CHECK (
            tipo_interaccion IS NULL OR
            tipo_interaccion IN (
                'texto',
                'opcion_multiple',
                'verdadero_falso',
                'drag_drop',
                'asociacion',
                'flechas',
                'respuesta_oral'
            )
        ),

    -- Configuración de la interacción visual
    configuracion JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- Respuesta correcta estructurada
    respuesta_correcta JSONB NOT NULL,

    explicacion TEXT,
    concepto VARCHAR(200),

    tiempo_video INTEGER CHECK (tiempo_video >= 0),

    dificultad SMALLINT CHECK (dificultad BETWEEN 1 AND 5),

    activa BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Opciones de preguntas tipo test
CREATE TABLE opciones_pregunta (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pregunta_id BIGINT NOT NULL
        REFERENCES preguntas(id) ON DELETE CASCADE,

    texto TEXT NOT NULL,
    valor VARCHAR(200) NOT NULL,
    orden INTEGER NOT NULL,
    es_correcta BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE (pregunta_id, orden),
    UNIQUE (pregunta_id, valor)
);

-- Relación entre evaluaciones y preguntas.
-- Permite reutilizar preguntas en diferentes exámenes.

CREATE TABLE evaluacion_preguntas (
    evaluacion_id BIGINT NOT NULL
        REFERENCES evaluaciones(id) ON DELETE CASCADE,

    pregunta_id BIGINT NOT NULL
        REFERENCES preguntas(id) ON DELETE CASCADE,

    orden INTEGER NOT NULL CHECK (orden > 0),

    origen VARCHAR(30) NOT NULL DEFAULT 'original'
        CHECK (
            origen IN (
                'original',
                'test_inicial',
                'omitida_intermedia'
            )
        ),

    PRIMARY KEY (evaluacion_id, pregunta_id),
    UNIQUE (evaluacion_id, orden)
);

-- =========================================================
-- 8. INTENTOS DE EVALUACION
-- =========================================================

CREATE TABLE intentos_evaluacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evaluacion_id BIGINT NOT NULL
        REFERENCES evaluaciones(id) ON DELETE CASCADE,

    numero_intento INTEGER NOT NULL DEFAULT 1
        CHECK (numero_intento > 0),

    estado VARCHAR(20) NOT NULL DEFAULT 'en_curso'
        CHECK (estado IN ('en_curso', 'completado', 'abandonado')),

    puntuacion NUMERIC(5,2)
        CHECK (puntuacion BETWEEN 0 AND 100),

    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,

    UNIQUE (alumno_id, evaluacion_id, numero_intento)
);

-- =========================================================
-- 9. RESPUESTAS
-- =========================================================

CREATE TABLE respuestas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    intento_id BIGINT NOT NULL
        REFERENCES intentos_evaluacion(id) ON DELETE CASCADE,

    pregunta_id BIGINT NOT NULL
        REFERENCES preguntas(id) ON DELETE CASCADE,

    -- Respuesta textual
    respuesta_texto TEXT,

    -- Respuesta visual u otras estructuras
    respuesta_json JSONB,

    -- Transcripción de una respuesta oral
    transcripcion_oral TEXT,

    es_correcta BOOLEAN,
    respondida BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_respuesta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (intento_id, pregunta_id),

    CHECK (
        respondida = TRUE
        OR (
            respuesta_texto IS NULL
            AND respuesta_json IS NULL
            AND transcripcion_oral IS NULL
        )
    )
);

-- =========================================================
-- 10. PROGRESO DEL ALUMNO
-- =========================================================

CREATE TABLE progreso_contenido (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido_id BIGINT NOT NULL
        REFERENCES contenidos(id) ON DELETE CASCADE,

    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (
            estado IN ('pendiente', 'en_curso', 'completado', 'saltado')
        ),

    porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (porcentaje BETWEEN 0 AND 100),

    ultimo_segundo_visto INTEGER DEFAULT 0
        CHECK (ultimo_segundo_visto >= 0),

    fecha_inicio TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_completado TIMESTAMP,

    UNIQUE (alumno_id, contenido_id)
);

-- =========================================================
-- 11. ITINERARIOS PERSONALIZADOS
-- =========================================================

CREATE TABLE itinerarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modulo_id BIGINT NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,

    fecha_generacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (alumno_id, modulo_id)
);

CREATE TABLE itinerario_contenidos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    itinerario_id BIGINT NOT NULL
        REFERENCES itinerarios(id) ON DELETE CASCADE,

    contenido_id BIGINT NOT NULL
        REFERENCES contenidos(id) ON DELETE CASCADE,

    orden INTEGER NOT NULL CHECK (orden > 0),

    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (
            estado IN ('pendiente', 'en_curso', 'completado', 'saltado')
        ),

    motivo VARCHAR(30)
        CHECK (
            motivo IS NULL OR
            motivo IN ('conocimiento_previo', 'completado', 'decision_alumno')
        ),

    UNIQUE (itinerario_id, contenido_id),
    UNIQUE (itinerario_id, orden)
);

-- =========================================================
-- 12. TUTORIAS CON IA
-- =========================================================

CREATE TABLE sesiones_tutoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modulo_id BIGINT REFERENCES modulos(id) ON DELETE SET NULL,

    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    duracion_segundos INTEGER CHECK (duracion_segundos >= 0),

    resumen TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'finalizada'))
);

CREATE TABLE mensajes_tutoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sesion_id BIGINT NOT NULL
        REFERENCES sesiones_tutoria(id) ON DELETE CASCADE,

    emisor VARCHAR(20) NOT NULL
        CHECK (emisor IN ('alumno', 'asistente')),

    mensaje TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 13. ERRORES Y RECOMENDACIONES DE REPASO
-- =========================================================

CREATE TABLE recomendaciones_repaso (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    alumno_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pregunta_id BIGINT REFERENCES preguntas(id) ON DELETE SET NULL,
    respuesta_id BIGINT REFERENCES respuestas(id) ON DELETE SET NULL,
    contenido_id BIGINT REFERENCES contenidos(id) ON DELETE SET NULL,

    concepto VARCHAR(200) NOT NULL,
    descripcion_error TEXT NOT NULL,
    recomendacion TEXT NOT NULL,

    tiempo_inicio INTEGER CHECK (tiempo_inicio >= 0),
    tiempo_fin INTEGER,

    -- Vídeo corto asociado al error
    video_corto_id BIGINT REFERENCES contenidos(id) ON DELETE SET NULL,

    veces_detectado INTEGER NOT NULL DEFAULT 1
        CHECK (veces_detectado > 0),

    revisada BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        tiempo_fin IS NULL
        OR tiempo_inicio IS NULL
        OR tiempo_fin > tiempo_inicio
    )
);

-- =========================================================
-- 14. PODCASTS
-- =========================================================

CREATE TABLE podcasts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    contenido_origen_id BIGINT NOT NULL
        REFERENCES contenidos(id) ON DELETE CASCADE,

    titulo VARCHAR(200) NOT NULL,
    guion TEXT,
    url_audio TEXT,

    duracion_segundos INTEGER CHECK (duracion_segundos >= 0),

    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'generando', 'disponible', 'error')),

    fecha_generacion TIMESTAMP
);

-- =========================================================
-- 15. INDICES
-- =========================================================

CREATE INDEX idx_modulos_curso
ON modulos(curso_id);

CREATE INDEX idx_contenidos_modulo
ON contenidos(modulo_id);

CREATE INDEX idx_preguntas_modulo
ON preguntas(modulo_id);

CREATE INDEX idx_preguntas_contenido
ON preguntas(contenido_id);

CREATE INDEX idx_evaluaciones_modulo
ON evaluaciones(modulo_id);

CREATE INDEX idx_intentos_alumno
ON intentos_evaluacion(alumno_id);

CREATE INDEX idx_respuestas_intento
ON respuestas(intento_id);

CREATE INDEX idx_progreso_alumno
ON progreso_contenido(alumno_id);

CREATE INDEX idx_itinerarios_alumno
ON itinerarios(alumno_id);

CREATE INDEX idx_sesiones_alumno
ON sesiones_tutoria(alumno_id);

CREATE INDEX idx_mensajes_sesion
ON mensajes_tutoria(sesion_id);

CREATE INDEX idx_recomendaciones_alumno
ON recomendaciones_repaso(alumno_id);

CREATE INDEX idx_transcripciones_contenido
ON transcripciones(contenido_id);

-- Índice para consultar fragmentos temporales
CREATE INDEX idx_fragmentos_transcripcion
ON fragmentos_transcripcion(transcripcion_id, tiempo_inicio);

-- =========================================================
-- FIN DE LA BASE DE DATOS
-- =========================================================
