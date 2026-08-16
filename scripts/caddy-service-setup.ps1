# ═════════════════════════════════════════════════════════════════════════════
#  Bandes · Configuración del Servicio de Updates (Caddy) — Wizard GUI
#
#  Crea/repara/controla el servicio Windows "BandesUpdates" que sirve
#  C:\bandes-updates vía NSSM (Caddy no implementa servicios de Windows nativo).
#
#  Uso:
#    Doble clic en Iniciar-Configuracion-Caddy.bat  (se auto-eleva a admin)
#    o:  powershell -NoProfile -ExecutionPolicy Bypass -File .\caddy-service-setup.ps1
#
#  Comportamiento:
#    - Si nssm.exe no está, intenta descargarlo (internet) y si falla muestra
#      un mensaje claro: colócalo manualmente en C:\caddy\nssm.exe y reintenta.
#    - Mata cualquier consola Caddy vieja y elimina tareas programadas
#      obsoletas para evitar doble bind del puerto.
#    - Idempotente: se puede volver a ejecutar sin romper nada.
# ═════════════════════════════════════════════════════════════════════════════

# ── 1. Auto-elevación a Administrador ─────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal]
  [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  $argList = " -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  exit
}

[System.Net.ServicePointManager]::SecurityProtocol =
  [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:LogQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

function Add-LogLine([string]$msg, [string]$color = 'White') {
  $script:LogQueue.Enqueue("$color|$msg")
}

# ══ Construcción del formulario ══
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Bandes · Servicio de Updates (Caddy)'
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(724, 668)
$form.BackColor = [System.Drawing.Color]::FromArgb(20, 22, 28)

$fontTitle = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$fontLabel = New-Object System.Drawing.Font('Segoe UI', 9)
$fontMono  = New-Object System.Drawing.Font('Consolas', 9.5)

function New-Label([string]$text, [int]$x, [int]$y, [int]$w, [bool]$bold = $false) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Location = New-Object System.Drawing.Point($x, $y)
  $l.Size = New-Object System.Drawing.Size($w, 20)
  $l.Font = if ($bold) { $fontTitle } else { $fontLabel }
  $l.ForeColor = if ($bold) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::FromArgb(180, 186, 200) }
  return $l
}

function New-TextBox([string]$value, [int]$x, [int]$y, [int]$w) {
  $t = New-Object System.Windows.Forms.TextBox
  $t.Text = $value
  $t.Location = New-Object System.Drawing.Point($x, $y)
  $t.Size = New-Object System.Drawing.Size($w, 24)
  $t.Font = $fontMono
  return $t
}

function New-CheckBox([string]$text, [int]$x, [int]$y, [bool]$checked) {
  $c = New-Object System.Windows.Forms.CheckBox
  $c.Text = $text
  $c.Location = New-Object System.Drawing.Point($x, $y)
  $c.Size = New-Object System.Drawing.Size(620, 22)
  $c.Font = $fontLabel
  $c.ForeColor = [System.Drawing.Color]::FromArgb(200, 205, 215)
  $c.Checked = $checked
  return $c
}

# ── Título ──
$form.Controls.Add((New-Label 'Configuración del Servicio Caddy (BandesUpdates)' 20 16 680 $true))
$form.Controls.Add((New-Label 'Sirve C:\bandes-updates a toda la red. Corre como servicio Windows en segundo plano (NSSM).' 20 42 680 $false))

# ── Campos ──
$lblCaddyDir = New-Label 'Carpeta de Caddy' 20 78 200
$txtCaddyDir = New-TextBox 'C:\caddy' 240 74 300
$form.Controls.Add($lblCaddyDir); $form.Controls.Add($txtCaddyDir)

$lblCaddyExe = New-Label 'caddy.exe' 20 108 200
$txtCaddyExe = New-TextBox 'C:\caddy\caddy.exe' 240 104 300
$form.Controls.Add($lblCaddyExe); $form.Controls.Add($txtCaddyExe)

$lblRoot = New-Label 'Carpeta de updates' 20 138 200
$txtRoot = New-TextBox 'C:\bandes-updates' 240 134 300
$form.Controls.Add($lblRoot); $form.Controls.Add($txtRoot)

$lblPort = New-Label 'Puerto' 20 168 200
$txtPort = New-TextBox '8090' 240 164 300
$form.Controls.Add($lblPort); $form.Controls.Add($txtPort)

$lblNssm = New-Label 'nssm.exe' 20 198 200
$txtNssm = New-TextBox '' 240 194 300
$form.Controls.Add($lblNssm); $form.Controls.Add($txtNssm)

$btnAutoNssm = New-Object System.Windows.Forms.Button
$btnAutoNssm.Text = 'Auto'
$btnAutoNssm.Location = New-Object System.Drawing.Point(548, 193)
$btnAutoNssm.Size = New-Object System.Drawing.Size(60, 26)
$btnAutoNssm.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnAutoNssm.Add_Click({
  $cands = @(
    "$($txtCaddyDir.Text.Trim())\nssm.exe",
    'C:\nssm\win64\nssm.exe',
    'C:\nssm\nssm.exe'
  ) + @(Get-ChildItem 'C:\nssm' -Recurse -Filter 'nssm.exe' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  $found = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($found) { $txtNssm.Text = $found; Add-LogLine "nssm.exe encontrado en: $found" 'LimeGreen' }
  else { Add-LogLine 'No se encontró nssm.exe. Lo descargará al instalar (si hay internet).' 'Gold' }
})
$form.Controls.Add($btnAutoNssm)

$chkDlNssm = New-CheckBox 'Descargar NSSM automáticamente si falta (requiere internet)' 20 228 $true
$form.Controls.Add($chkDlNssm)
$chkDlCaddy = New-CheckBox 'Descargar caddy.exe automáticamente si falta (requiere internet)' 20 254 $false
$form.Controls.Add($chkDlCaddy)

# ── Botones ──
function New-ActionButton([string]$text, [int]$x, [System.Drawing.Color]$fg, [System.Drawing.Color]$bg) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Location = New-Object System.Drawing.Point($x, 290)
  $b.Size = New-Object System.Drawing.Size(140, 34)
  $b.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
  $b.ForeColor = $fg
  $b.BackColor = $bg
  $b.FlatStyle = 'Flat'
  $b.Cursor = [System.Windows.Forms.Cursors]::Hand
  return $b
}

$btnInstall = New-ActionButton 'Instalar / Reparar' 20 [System.Drawing.Color]::White ([System.Drawing.Color]::FromArgb(19, 145, 105))
$btnRestart = New-ActionButton 'Reiniciar' 170 [System.Drawing.Color]::White ([System.Drawing.Color]::FromArgb(56, 189, 248))
$btnStop    = New-ActionButton 'Detener'    320 [System.Drawing.Color]::White ([System.Drawing.Color]::FromArgb(180, 130, 20))
$btnUninst  = New-ActionButton 'Desinstalar' 470 [System.Drawing.Color]::White ([System.Drawing.Color]::FromArgb(190, 60, 60))
$btnVerify  = New-ActionButton 'Verificar / Estado' 170 336 [System.Drawing.Color]::White ([System.Drawing.Color]::FromArgb(60, 66, 80))
$btnLogs    = New-ActionButton 'Abrir logs'  320 336 [System.Drawing.Color]::White ([System.Drawing.Color]::FromArgb(60, 66, 80))
$form.Controls.Add($btnInstall); $form.Controls.Add($btnRestart); $form.Controls.Add($btnStop)
$form.Controls.Add($btnUninst); $form.Controls.Add($btnVerify); $form.Controls.Add($btnLogs)

# ── Log ──
$lblLog = New-Label 'Registro de operaciones' 20 376 400
$form.Controls.Add($lblLog)
$txtLog = New-Object System.Windows.Forms.RichTextBox
$txtLog.Location = New-Object System.Drawing.Point(20, 400)
$txtLog.Size = New-Object System.Drawing.Size(684, 224)
$txtLog.ReadOnly = $true
$txtLog.BackColor = [System.Drawing.Color]::FromArgb(10, 12, 16)
$txtLog.ForeColor = [System.Drawing.Color]::White
$txtLog.Font = $fontMono
$txtLog.BorderStyle = 'FixedSingle'
$form.Controls.Add($txtLog)

$lblStatus = New-Label '' 20 636 680
$form.Controls.Add($lblStatus)

# ══ Motor async (runspace) ══
$script:ps = $null
$script:handle = $null

function Invoke-AsyncOp([scriptblock]$Op) {
  if ($script:ps -and -not $script:handle.IsCompleted) {
    Add-LogLine 'Ya hay una operación en curso. Espera a que termine.' 'Gold'
    return
  }
  foreach ($b in @($btnInstall, $btnRestart, $btnStop, $btnUninst, $btnVerify)) { $b.Enabled = $false }
  $lblStatus.Text = 'Ejecutando...'
  $script:ps = [System.Management.Automation.PowerShell]::Create()
  [void]$script:ps.AddScript($Op)
  $script:handle = $script:ps.BeginInvoke()
}

$uiTimer = New-Object System.Windows.Forms.Timer
$uiTimer.Interval = 250
$uiTimer.Add_Tick({
  $item = $null
  while ($script:LogQueue.TryDequeue([ref]$item)) {
    $parts = $item -split '\|', 2
    $color = if ($parts.Length -gt 1) { $parts[0] } else { 'White' }
    $text = $parts[-1]
    $txtLog.SelectionStart = $txtLog.TextLength
    $txtLog.SelectionLength = 0
    $txtLog.SelectionColor = switch ($color) {
      'Red'        { [System.Drawing.Color]::Tomato }
      'LimeGreen'  { [System.Drawing.Color]::LimeGreen }
      'Gold'       { [System.Drawing.Color]::Gold }
      'Cyan'       { [System.Drawing.Color]::DeepSkyBlue }
      default      { [System.Drawing.Color]::White }
    }
    $txtLog.AppendText("[$([DateTime]::Now.ToString('HH:mm:ss'))] $text`r`n")
    $txtLog.ScrollToCaret()
  }
  if ($script:handle -and $script:handle.IsCompleted) {
    try {
      $out = $script:ps.EndInvoke($script:handle)
      if ($out) { foreach ($o in $out) { Add-LogLine ([string]$o).Trim() } }
    } catch {
      Add-LogLine "Error en la operación: $($_.Exception.Message)" 'Red'
    }
    $script:ps.Dispose(); $script:ps = $null; $script:handle = $null
    foreach ($b in @($btnInstall, $btnRestart, $btnStop, $btnUninst, $btnVerify)) { $b.Enabled = $true }
    $lblStatus.Text = 'Listo.'
  }
})
$uiTimer.Start()

# ══ Operaciones ══
function Get-CurrentValues {
  return @{
    CaddyDir = $txtCaddyDir.Text.Trim()
    CaddyExe = $txtCaddyExe.Text.Trim()
    Root     = $txtRoot.Text.Trim()
    Port     = $txtPort.Text.Trim()
    Nssm     = $txtNssm.Text.Trim()
    DlNssm   = $chkDlNssm.Checked
    DlCaddy  = $chkDlCaddy.Checked
    Queue    = $script:LogQueue
  }
}

# Motor async (soporta scriptblock + argumentos)
function Invoke-AsyncOp($op) {
  if ($script:ps -and -not $script:handle.IsCompleted) {
    Add-LogLine 'Ya hay una operación en curso. Espera a que termine.' 'Gold'
    return
  }
  foreach ($b in @($btnInstall, $btnRestart, $btnStop, $btnUninst, $btnVerify)) { $b.Enabled = $false }
  $lblStatus.Text = 'Ejecutando...'
  $script:ps = [System.Management.Automation.PowerShell]::Create()
  [void]$script:ps.AddScript($op.Sb)
  foreach ($a in $op.Args) { [void]$script:ps.AddArgument($a) }
  $script:handle = $script:ps.BeginInvoke()
}

# ── Operación: Instalar / Reparar ──
function New-InstallOp {
  $v = Get-CurrentValues
  $sb = {
    param($caddyDir, $caddyExe, $root, $port, $nssm, $dlNssm, $dlCaddy, $queue)
    function W($m, $c = 'White') { $queue.Enqueue("$c|$m") }
    function Step($m) { W $m 'Cyan' }
    function Ok($m)   { W $m 'LimeGreen' }
    function Fail($m) { W $m 'Red' }

    if ($port -notmatch '^\d+$') { Fail "Puerto inválido: '$port'"; return }
    if (-not $root) { Fail 'La carpeta de updates no puede estar vacía.'; return }
    if (-not (Test-Path $root)) {
      Step "Creando carpeta de updates: $root"
      New-Item -ItemType Directory -Path $root -Force | Out-Null
    }

    # nssm.exe
    $nssmPath = $nssm
    if (-not $nssmPath -or -not (Test-Path $nssmPath)) {
      Step "nssm.exe no está en '$nssmPath'. Buscando en el disco..."
      $found = Get-ChildItem 'C:\nssm' -Recurse -Filter 'nssm.exe' -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName -match 'win64' } -Descending | Select-Object -First 1
      if ($found) { $nssmPath = $found.FullName; Ok "Usando nssm.exe de: $nssmPath" }
    }
    if (-not $nssmPath -or -not (Test-Path $nssmPath)) {
      if ($dlNssm) {
        Step 'NSSM no encontrado. Intentando descargarlo de https://nssm.cc...'
        $zip = Join-Path $env:TEMP 'nssm-2.24.zip'
        $dest = Join-Path $env:TEMP 'nssm-2.24-extract'
        try {
          [System.Net.ServicePointManager]::SecurityProtocol =
            [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
          Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip -UseBasicParsing -TimeoutSec 120
          if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
          Expand-Archive -Path $zip -DestinationPath $dest -Force
          $found = Get-ChildItem $dest -Recurse -Filter 'nssm.exe' | Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1
          if (-not $found) { $found = Get-ChildItem $dest -Recurse -Filter 'nssm.exe' | Select-Object -First 1 }
          if (-not $found) { throw 'nssm.exe no se encontró en el zip descargado' }
          if (-not (Test-Path $caddyDir)) { New-Item -ItemType Directory -Path $caddyDir -Force | Out-Null }
          $nssmPath = Join-Path $caddyDir 'nssm.exe'
          Copy-Item $found.FullName $nssmPath -Force
          Ok "NSSM instalado en: $nssmPath"
        } catch {
          Fail "No se pudo descargar NSSM: $($_.Exception.Message)"
          Fail '→ Coloca nssm.exe manualmente en C:\caddy\nssm.exe (https://nssm.cc/download) y pulsa "Instalar / Reparar" de nuevo.'
          return
        }
      } else {
        Fail 'nssm.exe no encontrado.'
        Fail '→ Colócalo manualmente en C:\caddy\nssm.exe (https://nssm.cc/download) y pulsa "Instalar / Reparar" de nuevo.'
        return
      }
    }
    if (-not $nssmPath -or -not (Test-Path $nssmPath)) { Fail 'No hay nssm.exe utilizable.'; return }

    # caddy.exe
    if (-not (Test-Path $caddyExe)) {
      if ($dlCaddy) {
        Step 'caddy.exe no existe. Intentando descargarlo (última versión)...'
        try {
          if (-not (Test-Path $caddyDir)) { New-Item -ItemType Directory -Path $caddyDir -Force | Out-Null }
          Invoke-WebRequest -Uri 'https://caddyserver.com/api/download?os=windows&arch=amd64' -OutFile $caddyExe -UseBasicParsing -TimeoutSec 120
          Ok "caddy.exe descargado en: $caddyExe"
        } catch {
          Fail "No se pudo descargar caddy.exe: $($_.Exception.Message)"
          Fail "→ Copia caddy.exe manualmente a $caddyExe y vuelve a intentar."
          return
        }
      } else {
        Fail "caddy.exe no encontrado en: $caddyExe"
        Fail '→ Copia caddy.exe a esa ruta o marca "Descargar caddy.exe automáticamente" y reintenta.'
        return
      }
    }
    if (-not (Test-Path $caddyExe)) { Fail 'No hay caddy.exe utilizable.'; return }

    $logDir = Join-Path $caddyDir 'logs'
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

    $svc = 'BandesUpdates'
    $exists = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($exists) {
      Step "El servicio $svc ya existe. Deteniendo y re-instalando (reparación)..."
      & $nssmPath stop $svc | Out-Null
      & $nssmPath remove $svc confirm | Out-Null
      Start-Sleep -Milliseconds 500
    }

    Step 'Deteniendo consolas Caddy previas...'
    Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match 'caddy' } | ForEach-Object {
      Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false
      W "Tarea programada obsoleta eliminada: $($_.TaskName)" 'Gold'
    }
    Step 'Instalando servicio NSSM...'
    & $nssmPath install $svc $caddyExe file-server --root $root --listen ":$port" --browse
    & $nssmPath set $svc AppDirectory $caddyDir | Out-Null
    & $nssmPath set $svc AppStdout "$logDir\caddy.out.log" | Out-Null
    & $nssmPath set $svc AppStderr "$logDir\caddy.err.log" | Out-Null
    & $nssmPath set $svc AppRotateFiles 1 | Out-Null
    & $nssmPath set $svc AppExit Default Restart | Out-Null
    & $nssmPath set $svc AppRestartDelay 2000 | Out-Null
    & $nssmPath set $svc Start SERVICE_AUTO_START | Out-Null

    Step 'Arrancando el servicio...'
    & $nssmPath start $svc
    Start-Sleep -Seconds 2

    $q = (& sc.exe query $svc | Out-String)
    if ($q -match 'RUNNING') { Ok "Servicio $svc en ejecución (STATE: RUNNING)." }
    else { Fail "El servicio no quedó RUNNING. Revisa $logDir\caddy.err.log" }

    $http = -1
    try {
      $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$port/latest.json" -UseBasicParsing -TimeoutSec 8
      $http = [int]$resp.StatusCode
    } catch { $http = -1 }
    if ($http -eq 200) { Ok "Verificación HTTP: 200 OK (http://127.0.0.1:$port/latest.json). ¡Todo listo!" }
    else { Fail "Verificación HTTP falló (código $http). Asegúrate de que exista un archivo en $root y de abrir el puerto $port en el firewall." }
  }
  return @{ Sb = $sb; Args = [object[]]@($v.CaddyDir, $v.CaddyExe, $v.Root, $v.Port, $v.Nssm, $v.DlNssm, $v.DlCaddy, $v.Queue) }
}

# ── Operación: Reiniciar ──
function New-RestartOp {
  $v = Get-CurrentValues
  $sb = {
    param($nssm, $queue)
    function W($m, $c = 'White') { $queue.Enqueue("$c|$m") }
    if (-not $nssm -or -not (Test-Path $nssm)) { $nssm = 'C:\caddy\nssm.exe' }
    if (Test-Path $nssm) {
      W 'Reiniciando el servicio BandesUpdates...' 'Cyan'
      & $nssm restart BandesUpdates
    } else {
      W 'nssm.exe no encontrado; usando Stop-Service/Start-Service.' 'Cyan'
      Restart-Service BandesUpdates -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    $q = (& sc.exe query BandesUpdates | Out-String)
    if ($q -match 'RUNNING') { W 'Servicio reiniciado y en ejecución (RUNNING).' 'LimeGreen' }
    else { W 'El servicio no quedó RUNNING tras el reinicio.' 'Red' }
  }
  return @{ Sb = $sb; Args = [object[]]@($v.Nssm, $v.Queue) }
}

# ── Operación: Detener ──
function New-StopOp {
  $v = Get-CurrentValues
  $sb = {
    param($nssm, $queue)
    function W($m, $c = 'White') { $queue.Enqueue("$c|$m") }
    if (-not $nssm -or -not (Test-Path $nssm)) { $nssm = 'C:\caddy\nssm.exe' }
    W 'Deteniendo el servicio BandesUpdates...' 'Cyan'
    if (Test-Path $nssm) { & $nssm stop BandesUpdates }
    else { Stop-Service BandesUpdates -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
    $q = (& sc.exe query BandesUpdates | Out-String)
    if ($q -match 'STOPPED') { W 'Servicio detenido (STOPPED).' 'Gold' }
    else { W 'Estado del servicio tras la petición de detención:' 'Gold'; W $q.Trim() }
  }
  return @{ Sb = $sb; Args = [object[]]@($v.Nssm, $v.Queue) }
}

# ── Operación: Desinstalar ──
function New-UninstallOp {
  $v = Get-CurrentValues
  $sb = {
    param($nssm, $queue)
    function W($m, $c = 'White') { $queue.Enqueue("$c|$m") }
    if (-not $nssm -or -not (Test-Path $nssm)) { $nssm = 'C:\caddy\nssm.exe' }
    W 'Desinstalando el servicio BandesUpdates...' 'Cyan'
    if (Test-Path $nssm) {
      & $nssm stop BandesUpdates | Out-Null
      & $nssm remove BandesUpdates confirm
    } else {
      Stop-Service BandesUpdates -Force -ErrorAction SilentlyContinue
      sc.exe delete BandesUpdates
    }
    Start-Sleep -Seconds 1
    $still = Get-Service -Name BandesUpdates -ErrorAction SilentlyContinue
    if ($still) { W 'El servicio sigue registrado. Reintenta o revísalo en services.msc.' 'Red' }
    else { W 'Servicio desinstalado. Caddy ya no se inicia automáticamente.' 'LimeGreen' }
  }
  return @{ Sb = $sb; Args = [object[]]@($v.Nssm, $v.Queue) }
}

# ── Operación: Verificar / Estado ──
function New-VerifyOp {
  $v = Get-CurrentValues
  $sb = {
    param($port, $queue)
    function W($m, $c = 'White') { $queue.Enqueue("$c|$m") }
    W 'Verificando estado del servicio BandesUpdates...' 'Cyan'
    $q = (& sc.exe query BandesUpdates | Out-String)
    if ($q -match 'RUNNING') { W 'Servicio: RUNNING ✓' 'LimeGreen' }
    else { W 'Servicio: NO está en ejecución.' 'Red' }
    $http = -1
    try {
      $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$port/latest.json" -UseBasicParsing -TimeoutSec 8
      $http = [int]$resp.StatusCode
    } catch { $http = -1 }
    if ($http -eq 200) { W "HTTP http://127.0.0.1:$port/latest.json → 200 OK ✓" 'LimeGreen' }
    else { W "HTTP falló (código $http). Revisa C:\caddy\logs\caddy.err.log" 'Red' }
  }
  return @{ Sb = $sb; Args = [object[]]@($v.Port, $v.Queue) }
}

# ══ Wiring de botones ══
$btnInstall.Add_Click({ Invoke-AsyncOp (New-InstallOp) })
$btnRestart.Add_Click({ Invoke-AsyncOp (New-RestartOp) })
$btnStop.Add_Click({ Invoke-AsyncOp (New-StopOp) })
$btnUninst.Add_Click({ Invoke-AsyncOp (New-UninstallOp) })
$btnVerify.Add_Click({ Invoke-AsyncOp (New-VerifyOp) })
$btnLogs.Add_Click({
  $logDir = Join-Path $txtCaddyDir.Text.Trim() 'logs'
  if (Test-Path $logDir) { Start-Process explorer.exe $logDir }
  else { Add-LogLine 'La carpeta de logs aún no existe. Instala el servicio primero.' 'Gold' }
})

Add-LogLine 'Wizard listo. Pulsa "Instalar / Reparar" para crear el servicio.' 'Cyan'
[void]$form.ShowDialog()
