SELECT
  c.titulo,
  (SELECT count(*) FROM academy.modulos m WHERE m.curso_id = c.id) AS modulos,
  (SELECT count(*) FROM academy.contenidos co JOIN academy.modulos m ON m.id = co.modulo_id WHERE m.curso_id = c.id AND co.tipo = 'video') AS videos,
  (SELECT count(*) FROM academy.evaluaciones e WHERE e.tipo = 'inicial' AND (e.curso_id = c.id OR e.modulo_id IN (SELECT id FROM academy.modulos WHERE curso_id = c.id))) AS diagnosticos_iniciales,
  (SELECT count(*) FROM academy.evaluaciones e WHERE e.tipo = 'intermedia' AND e.modulo_id IN (SELECT id FROM academy.modulos WHERE curso_id = c.id)) AS evaluaciones_intermedias,
  (SELECT count(*) FROM academy.preguntas q JOIN academy.modulos m ON m.id = q.modulo_id WHERE m.curso_id = c.id) AS preguntas,
  (SELECT count(*) FROM academy.opciones_pregunta o JOIN academy.preguntas q ON q.id = o.pregunta_id JOIN academy.modulos m ON m.id = q.modulo_id WHERE m.curso_id = c.id) AS opciones,
  (SELECT count(*) FROM academy.transcripciones t JOIN academy.contenidos co ON co.id = t.contenido_id JOIN academy.modulos m ON m.id = co.modulo_id WHERE m.curso_id = c.id) AS transcripciones,
  (SELECT count(*) FROM academy.fragmentos_transcripcion ft JOIN academy.transcripciones t ON t.id = ft.transcripcion_id JOIN academy.contenidos co ON co.id = t.contenido_id JOIN academy.modulos m ON m.id = co.modulo_id WHERE m.curso_id = c.id) AS fragmentos_transcripcion
FROM academy.cursos c
WHERE c.titulo = 'Introducción a Python — CS50P (demo)';
