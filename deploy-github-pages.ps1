$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$repoName = "research-workflow-showcase"
Set-Location $PSScriptRoot

gh auth status | Out-Null

if (-not (Test-Path ".git")) {
  git init
  git checkout -b main
}

git add -A
if (git status --porcelain) {
  git -c user.name="showcase-deploy" -c user.email="showcase@local" commit -m "Update research workflow showcase"
}

$owner = (gh api user --jq .login)
$hasOrigin = $false
git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $hasOrigin = $true }

if (-not $hasOrigin) {
  gh repo create $repoName --public --source=. --remote=origin --description "Research workflow showcase read-only"
}

git push -u origin main

$pagesBody = '{"build_type":"legacy","source":{"branch":"main","path":"/"}}'
$pagesBody | gh api -X POST "repos/$owner/$repoName/pages" --input - 2>$null | Out-Null
$pagesBody | gh api -X PUT "repos/$owner/$repoName/pages" --input - 2>$null | Out-Null

Write-Host ""
Write-Host "Deployed:"
Write-Host "https://$owner.github.io/$repoName/"
Write-Host "https://$owner.github.io/$repoName/app.html"
