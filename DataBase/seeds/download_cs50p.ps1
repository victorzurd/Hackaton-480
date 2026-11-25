$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$seedDirectory = $PSScriptRoot
$projectRoot = (Resolve-Path (Join-Path $seedDirectory '..\..')).Path
$mediaDirectory = Join-Path $projectRoot 'media\cs50p'
New-Item -ItemType Directory -Path $mediaDirectory -Force | Out-Null

for ($week = 0; $week -le 9; $week++) {
    $base = "https://cdn.cs50.net/python/2022/x/lectures/$week"
    $assets = @(
        @{ Name = "lecture-$week.srt"; Url = "$base/lang/en/lecture$week.srt"; MinBytes = 100 },
        @{ Name = "lecture-$week.txt"; Url = "$base/lang/en/lecture$week.txt"; MinBytes = 100 }
    )

    foreach ($asset in $assets) {
        $destination = Join-Path $mediaDirectory $asset.Name
        if ((Test-Path -LiteralPath $destination) -and (Get-Item -LiteralPath $destination).Length -ge $asset.MinBytes) {
            Write-Host "Ya existe: $($asset.Name)"
            continue
        }

        Write-Host "Descargando $($asset.Name)..."
        & curl.exe --fail --location --retry 3 --continue-at - --output $destination $asset.Url
        if ($LASTEXITCODE -ne 0) {
            throw "Falló la descarga de $($asset.Name) (código $LASTEXITCODE)."
        }

        if ((Get-Item -LiteralPath $destination).Length -lt $asset.MinBytes) {
            throw "La descarga de $($asset.Name) parece incompleta."
        }
    }

    $subtitlePath = Join-Path $mediaDirectory "lecture-$week.srt"
    $subtitleText = Get-Content -LiteralPath $subtitlePath -Raw
    $webVtt = "WEBVTT`r`n`r`n" + ($subtitleText -replace '(\d{2}:\d{2}:\d{2}),(\d{3})', '$1.$2')
    $webVttPath = Join-Path $mediaDirectory "lecture-$week.vtt"
    [System.IO.File]::WriteAllText($webVttPath, $webVtt, [System.Text.UTF8Encoding]::new($false))
}

Write-Host "Subtítulos y transcripciones guardados en $mediaDirectory; los vídeos se reproducen desde la fuente oficial."
