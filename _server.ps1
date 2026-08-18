# 简易静态文件服务器（.NET HttpListener）
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 8765
$url = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()
Write-Host "服务器已启动: $url  (根目录: $root)" -ForegroundColor Green

$mimes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.mp3'  = 'audio/mpeg'
    '.map'  = 'application/json'
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch { continue }
    $req = $ctx.Request
    $resp = $ctx.Response
    $path = $req.Url.AbsolutePath
    if ($path -eq '/') { $path = '/index.html' }
    $filePath = Join-Path $root ($path -replace '/','\')
    $filePath = [System.IO.Path]::GetFullPath($filePath)
    # 防止目录穿越
    if (-not $filePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $resp.StatusCode = 403; $resp.Close(); continue
    }
    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $resp.ContentType = $mime
        $resp.ContentLength64 = $bytes.Length
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $resp.StatusCode = 404
        $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
        $resp.OutputStream.Write($body, 0, $body.Length)
    }
    $resp.Close()
}
