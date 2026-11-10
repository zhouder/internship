param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$KeyPath
)
$ErrorActionPreference = 'Stop'
if ($Server -notmatch '^[a-zA-Z0-9.-]+$') { throw 'Invalid server address' }
$appPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$resolvedKey = (Resolve-Path -LiteralPath $KeyPath).Path
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) ('guiyan-release-' + [guid]::NewGuid().ToString('N') + '.tar.gz')
try {
    # Explicit source list: private env files, databases, node_modules and original materials stay local.
    & tar -czf $archivePath -C $appPath package.json package-lock.json index.html vite.config.js src public server scripts tests miniprogram deploy
    if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
    $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $commit = (& git -C $appPath rev-parse --short=7 HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Git version lookup failed' }
    # Archive hash identifies local edits too; deployment does not commit or push them.
    $release = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $commit + '-' + $hash.Substring(0,8)
    $remoteArchive = '/root/guiyan-' + $release + '.tar.gz'
    $sshOptions = @('-i', $resolvedKey, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
    & scp @sshOptions $archivePath "root@${Server}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }
    & scp @sshOptions (Join-Path $PSScriptRoot 'publish.sh') "root@${Server}:/root/guiyan-publish.sh"
    if ($LASTEXITCODE -ne 0) { throw 'Publish script upload failed' }
    & ssh @sshOptions "root@$Server" "bash /root/guiyan-publish.sh $remoteArchive $release"
    if ($LASTEXITCODE -ne 0) { throw 'Remote publish failed' }
    Write-Output "Release: $release"
    Write-Output "Health: http://$Server/api/health"
} finally {
    if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
}
