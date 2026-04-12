$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $name, $value = $_.split('=', 2)
        $name = $name.Trim()
        $value = $value.Trim()
        if ($name -and $value) {
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}
mvn spring-boot:run
