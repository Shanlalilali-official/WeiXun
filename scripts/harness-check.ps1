$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$requiredFiles = @(
    'PROJECT.md',
    'AGENTS.md',
    'harness\STATE.md',
    'harness\context\PROJECT_CONTEXT.md',
    'harness\context\SOURCE_OF_TRUTH.md',
    'harness\memory\DECISIONS.md',
    'harness\memory\FINDINGS.md',
    'harness\memory\HANDOFF.md',
    'harness\plans\CURRENT_ITERATION.md',
    'harness\plans\BACKLOG.md',
    'harness\loops\DEVELOPMENT.md',
    'harness\loops\VERIFICATION.md'
)

$errors = @()
foreach ($relativePath in $requiredFiles) {
    $absolutePath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        $errors += "Missing required file: $relativePath"
    }
}

$gitRoot = (& git -c "safe.directory=$projectRoot" -C $projectRoot rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $gitRoot) {
    $errors += 'Project root is not a Git repository.'
} elseif ((Resolve-Path $gitRoot).Path -ne $projectRoot) {
    $errors += "Git root mismatch: $gitRoot"
}

if ($gitRoot) {
    $trackedSecrets = & git -c "safe.directory=$projectRoot" -C $projectRoot ls-files | Where-Object {
        $_ -match '(^|/)(\.env($|\.)|.*(secret|credential|api[_-]?key).*)'
    }
    if ($trackedSecrets) {
        $errors += "Potential secret files are tracked: $($trackedSecrets -join ', ')"
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'Harness check passed.'
Write-Output "Project root: $projectRoot"
if ($gitRoot) {
    $status = & git -c "safe.directory=$projectRoot" -C $projectRoot status --short
    if ($status) {
        Write-Output 'Working tree changes:'
        $status
    } else {
        Write-Output 'Working tree is clean.'
    }
}
