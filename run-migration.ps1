# PowerShell script to run migration and generate Prisma client
# Make sure your dev server is stopped before running this!

Write-Host "Step 1: Checking if dev server is running..." -ForegroundColor Yellow
$devServer = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next dev*" }
if ($devServer) {
    Write-Host "WARNING: Dev server appears to be running. Please stop it first (Ctrl+C)!" -ForegroundColor Red
    Write-Host "Press any key to continue anyway, or Ctrl+C to cancel..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host "`nStep 2: Generating Prisma client..." -ForegroundColor Green
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Prisma client generated successfully!" -ForegroundColor Green
    Write-Host "`nStep 3: You can now start your dev server:" -ForegroundColor Cyan
    Write-Host "   npm run dev" -ForegroundColor White
} else {
    Write-Host "`n❌ Prisma generate failed. Check the error above." -ForegroundColor Red
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. Dev server is completely stopped" -ForegroundColor Yellow
    Write-Host "  2. No IDE/editor has Prisma files locked" -ForegroundColor Yellow
    Write-Host "  3. You have write permissions to node_modules" -ForegroundColor Yellow
}
