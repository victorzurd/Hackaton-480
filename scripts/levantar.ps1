<#
  Levanta 480 Academy en local con HTTPS.

  1. Crea el .env a partir de .env.example si no existe, con un AUTH_JWT_SECRET aleatorio.
  2. Detecta la IPv4 de la red local y actualiza CADDY_HOSTS y CADDY_DEFAULT_SNI en .env.
  3. Levanta los contenedores (base de datos, API y proxy HTTPS).
  4. Instala en tu usuario de Windows la autoridad certificadora local de Caddy, si aún no
     está, para que el navegador muestre el candado. Windows pide confirmación la primera vez.
  5. Espera a que la aplicación responda por HTTPS.

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

function Obtener-IPv4Local {
  # UDP Connect selecciona la interfaz que Windows usaría para salir a la red,
  # sin enviar datos al destino reservado para documentación.
  $cliente = New-Object System.Net.Sockets.UdpClient
  try {
    $cliente.Connect([System.Net.IPAddress]::Parse("192.0.2.1"), 9)
    $direccion = $cliente.Client.LocalEndPoint.Address
    $texto = $direccion.ToString()
    if ($direccion.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $texto -notlike "127.*" -and $texto -notlike "169.254.*") {
      return $texto
    }
  } catch {
    # Se informa abajo con un mensaje claro si Windows no pudo elegir una interfaz.
  } finally {
    $cliente.Dispose()
  }
  Detener "No se pudo detectar una IPv4 de red local. Conecta el ordenador a la red y vuelve a intentarlo."
}

function Guardar-VariableEnv([string]$nombre, [string]$valor) {
  $ruta = Join-Path (Get-Location) ".env"
  $lineas = New-Object 'System.Collections.Generic.List[string]'
  $encontrada = $false
  foreach ($linea in [System.IO.File]::ReadAllLines($ruta)) {
    if ($linea -match "^\s*$([regex]::Escape($nombre))=") {
      $lineas.Add("$nombre=$valor")
      $encontrada = $true
    } else {
      $lineas.Add($linea)
    }
  }
  if (-not $encontrada) { $lineas.Add("$nombre=$valor") }
  [System.IO.File]::WriteAllLines($ruta, $lineas)
}

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

# --- Dirección HTTPS para la red local ----------------------------------------
Escribir-Paso "Detectando la dirección para el móvil"
$ipLocal = Obtener-IPv4Local
Guardar-VariableEnv "CADDY_HOSTS" "localhost, $ipLocal"
Guardar-VariableEnv "CADDY_DEFAULT_SNI" $ipLocal
$urlMovil = "https://$ipLocal"
Write-Host "  HTTPS en este ordenador: $url"
Write-Host "  HTTPS en el móvil (misma red Wi-Fi): $urlMovil"

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

  # Se conserva en la carpeta del proyecto para poder instalarlo también en el móvil.
  $archivo = Join-Path (Get-Location) "caddy-root.crt"
  if ((Invocar-Silencioso { docker compose cp "proxy:$rutaCertificado" $archivo }) -ne 0) { Detener "No se pudo copiar el certificado de Caddy." }

  $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($archivo)
  if (-not (Get-PSDrive -Name Cert -ErrorAction SilentlyContinue)) {
    Write-Host "  No está disponible el almacén de certificados de Windows; no se pudo instalar automáticamente." -ForegroundColor Yellow
    Write-Host "  El certificado raíz está en: $archivo" -ForegroundColor Yellow
  } else {
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
  }
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
Write-Host "En el móvil, conectado a la misma red, abre: $urlMovil"
Write-Host "Sin HTTPS: http://localhost:3000"
