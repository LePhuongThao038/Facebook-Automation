$ErrorActionPreference = 'Stop'
if (-not $env:OPENAI_API_KEY) {
    $secret = Read-Host 'OpenAI API key (hidden)' -AsSecureString
    $credential = [PSCredential]::new('OpenAI', $secret)
    $env:OPENAI_API_KEY = $credential.GetNetworkCredential().Password
    try { & node (Join-Path $PSScriptRoot 'astra-server.mjs') }
    finally { Remove-Item Env:OPENAI_API_KEY }
} else {
    & node (Join-Path $PSScriptRoot 'astra-server.mjs')
}
