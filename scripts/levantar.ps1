<#
  Levanta 480 Academy en local con HTTPS.

  1. Crea el .env a partir de .env.example si no existe, con un AUTH_JWT_SECRET aleatorio.
  2. Levanta los contenedores (base de datos, API y proxy HTTPS).
  3. Instala en tu usuario de Windows la autoridad certificadora local de Caddy, si aún no
     está, para que el navegador muestre el candado. Windows pide confirmación la primera vez.
  4. Espera a que la aplicación responda en https://localhost.

  Uso:  npm run levantar
        powershell -ExecutionPolicy Bypass -File scripts\levantar.ps1 [-SinConfianza]
#>
param(
  # No instala la autoridad en Windows (la web funcionará con aviso de certificado).
  [switch]$SinConfianza
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$rutaCertificado = "/data/caddy/pki/authorities/local/root.crt"
$url = "https://localhost"

function Escribir-Paso([string]$texto) { Write-Host "`n> $texto" -ForegroundColor Cyan }
function Detener([string]$texto) { Write-Host "`nERROR: $texto" -ForegroundColor Red; exit 1 }

# Ejecuta un comando externo sin mostrar su salida y devuelve su código de salida.
# En PowerShell 5.1, si un comando escribe en la salida de errores (Docker lo hace con mensajes
# informativos), redirigirla lo convierte en error y detiene el script; aquí se evita.
function Invocar-Silencioso([scriptblock]$comando) {
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $comando *> $null } finally { $ErrorActionPreference = $anterior }
  return $LASTEXITCODE
}

# --- Docker -------------------------------------------------------------------
Escribir-Paso "Comprobando Docker"
if ((Invocar-Silencioso { docker info --format "{{.ServerVersion}}" }) -ne 0) { Detener "Docker no responde. Abre Docker Desktop y vuelve a ejecutar el script." }

# --- .env ---------------------------------------------------------------------
if (-not (Test-Path ".env")) {
  Escribir-Paso "Creando .env a partir de .env.example"
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secreto = [Convert]::ToBase64String($bytes)
  $contenido = (Get-Content ".env.example") -replace "^AUTH_JWT_SECRET=.*$", "AUTH_JWT_SECRET=$secreto"
  [System.IO.File]::WriteAllLines((Join-Path (Get-Location) ".env"), $contenido)
  Write-Host "  .env creado con un AUTH_JWT_SECRET aleatorio."
  Write-Host "  Para usar la IA, pon tu GEMINI_API_KEY en .env." -ForegroundColor Yellow
}

# --- Contenedores ---------------------------------------------------------------
Escribir-Paso "Levantando los contenedores"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Detener "No se pudieron levantar los contenedores. Si dice que el puerto 80 o 443 está ocupado, cierra el programa que lo usa (IIS, XAMPP, Skype...)."
}

# --- Autoridad certificadora -----------------------------------------------------
if ($SinConfianza) {
  Write-Host "`nSin instalar la autoridad: el navegador mostrará un aviso de certificado." -ForegroundColor Yellow
} else {
  Escribir-Paso "Comprobando el certificado de Caddy"
  $intentos = 0
  do {
    if ((Invocar-Silencioso { docker compose exec -T proxy test -f $rutaCertificado }) -eq 0) { break }
    Start-Sleep -Seconds 1
    $intentos++
  } while ($intentos -lt 30)
  if ($intentos -ge 30) { Detener "Caddy no ha generado su certificado. Revisa: docker compose logs proxy" }

  $archivo = Join-Path $env:TEMP "caddy-root.crt"
  if ((Invocar-Silencioso { docker compose cp "proxy:$rutaCertificado" $archivo }) -ne 0) { Detener "No se pudo copiar el certificado de Caddy." }

  $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($archivo)
  $instalado = Get-ChildItem Cert:\CurrentUser\Root |
    Where-Object { $_.Thumbprint -eq $certificado.Thumbprint }

  if ($instalado) {
    Write-Host "  La autoridad de Caddy ya es de confianza."
  } else {
    Write-Host "  Instalando '$($certificado.GetNameInfo("SimpleName", $false))' en tu usuario."
    Write-Host "  Windows mostrará un aviso de seguridad: pulsa 'Sí'." -ForegroundColor Yellow
    certutil -user -addstore Root $archivo | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  No se instaló (¿pulsaste 'No'?). La web funcionará con aviso de certificado." -ForegroundColor Yellow
    } else {
      Write-Host "  Instalada. Cierra y vuelve a abrir el navegador para ver el candado." -ForegroundColor Green
    }
  }

  # Autoridades de Caddy anteriores (de un volumen borrado) que ya no sirven.
  $antiguas = Get-ChildItem Cert:\CurrentUser\Root |
    Where-Object { $_.Subject -like "CN=Caddy Local Authority*" -and $_.Thumbprint -ne $certificado.Thumbprint }
  if ($antiguas) {
    Write-Host "  Hay $(@($antiguas).Count) autoridad(es) antigua(s) de Caddy. Puedes borrarlas con:" -ForegroundColor Yellow
    foreach ($antigua in $antiguas) { Write-Host "    certutil -user -delstore Root $($antigua.Thumbprint)" }
  }
  Remove-Item $archivo -ErrorAction SilentlyContinue
}

# --- Esperar a la aplicación ----------------------------------------------------------
Escribir-Paso "Esperando a que la aplicación responda"
function Responde([string]$direccion) {
  try {
    return (Invoke-WebRequest "$direccion/health" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200
  } catch {
    return $false
  }
}

# Primero directamente a la API (las migraciones tardan unos segundos).
$lista = $false
for ($i = 0; $i -lt 90; $i++) {
  if (Responde "http://localhost:3000") { $lista = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $lista) { Detener "La API no responde. Revisa: docker compose logs api" }

# Después a través del proxy: solo funciona si Windows confía en la autoridad de Caddy.
if (Responde $url) {
  Write-Host "`nListo: $url" -ForegroundColor Green
} else {
  Write-Host "`nListo: $url (el navegador mostrará un aviso de certificado)" -ForegroundColor Yellow
}
Write-Host "Sin HTTPS: http://localhost:3000"
