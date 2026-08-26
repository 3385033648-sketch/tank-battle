param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host "Steel Front is running at http://localhost:$Port"
Write-Host "Press Ctrl+C to stop."

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".json" = "application/json"
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $buffer = New-Object byte[] 8192
    try {
      $stream.ReadTimeout = 3000
      $read = $stream.Read($buffer, 0, $buffer.Length)
    } catch {
      $read = 0
    }
    if ($read -gt 0) {
      $requestText = [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
      $firstLine = ($requestText -split "`r?`n")[0]
      $parts = $firstLine -split " "
      if ($parts.Count -ge 2) {
        $path = $parts[1]
        if ($path -eq "/") {
          $path = "/index.html"
        }
        $path = ($path -split "\?")[0]
        $relative = $path.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
        $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
        $rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

        if (-not $file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $file -PathType Leaf)) {
          $status = "404 Not Found"
          $bytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
          $contentType = "text/plain; charset=utf-8"
        } else {
          $status = "200 OK"
          $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
          $contentType = $mime[$ext]
          $bytes = [IO.File]::ReadAllBytes($file)
        }

        $header = "HTTP/1.1 $status`r`n" +
          "Content-Type: $contentType`r`n" +
          "Content-Length: $($bytes.Length)`r`n" +
          "Connection: close`r`n`r`n"
        $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($bytes, 0, $bytes.Length)
      }
    }
  } catch {
    # Browser closed the connection before the response finished; keep serving.
  } finally {
    $client.Close()
  }
}
