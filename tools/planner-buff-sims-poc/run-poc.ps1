param(
  [Parameter(Mandatory=$true)][string]$Simc,
  [Parameter(Mandatory=$true)][string]$Profiles,
  [string]$SimcRepo = "",
  [int]$Iterations = 5000,
  [ValidateSet("single","powerset")][string]$Mode = "single"
)
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$args2 = @("$Here\generate.py","--simc",$Simc,"--profiles",$Profiles,"--iterations","$Iterations","--mode",$Mode)
if ($SimcRepo -ne "") { $args2 += @("--simc-repo",$SimcRepo) }
Write-Host "== Doctor =="
python @args2 --doctor
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "`n== Simulaciones =="
python @args2
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$out = Join-Path $Here "generated\midnight-s2-buff-impact-poc.json"
Write-Host "`n== Validacion =="
python "$Here\validate.py" $out
exit $LASTEXITCODE
