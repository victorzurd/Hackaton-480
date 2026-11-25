# CS50P para la demo de 480 Academy

Esta carpeta contiene los subtítulos SRT/WebVTT y las transcripciones en inglés de las diez lecciones de CS50P. Los vídeos se reproducen desde el MP4 oficial por streaming para evitar una copia local de varios GB. Se pueden volver a descargar los textos desde PowerShell con `DataBase/seeds/download_cs50p.ps1`.

## Atribución y licencia

Fuente: [CS50’s Introduction to Programming with Python](https://cs50.harvard.edu/python/) y su [lista de reproducción oficial de YouTube](https://www.youtube.com/playlist?list=PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V), por el equipo de CS50 de Harvard.

El curso indica la licencia [Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional (CC BY-NC-SA 4.0)](https://cs50.harvard.edu/python/license/). Se conserva el material fuente y se han añadido organización, títulos y cuestionarios de práctica en español para esta demo. Las adaptaciones del material se ofrecen bajo la misma licencia. La licencia no implica afiliación ni respaldo de Harvard. El audio y las transcripciones originales están en inglés.

Los subtítulos y transcripciones se mantienen localmente y se excluyen del control de versiones. La base de datos guarda los enlaces oficiales de los vídeos, atribución, metadatos, transcripciones, fragmentos temporales y evaluaciones. Para importar el curso, carga `DataBase/seeds/cs50p_demo.sql` en PostgreSQL y ejecuta `node DataBase/seeds/import_cs50p_transcripts.mjs` dentro del contenedor de la API.
