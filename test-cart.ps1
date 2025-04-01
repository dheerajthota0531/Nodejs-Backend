# Simple PowerShell script to run cart tests

# Check if an argument was provided
if ($args.Count -eq 0) {
    Write-Host "Usage: .\test-cart.ps1 [start|stop|test]"
    Write-Host "  start - Start the Node.js server"
    Write-Host "  stop  - Stop running Node.js processes"
    Write-Host "  test  - Run cart tests (get, add, remove)"
    exit
}

# Get the action from command line
$action = $args[0]

# Define functions
function Start-Server {
    Write-Host "Starting Node.js server..."
    Start-Process -FilePath "node" -ArgumentList "app.js" -NoNewWindow
    Write-Host "Server started. Wait a few seconds for it to initialize."
    Start-Sleep -Seconds 3
}

function Stop-Server {
    Write-Host "Stopping Node.js processes..."
    Stop-Process -Name "node" -ErrorAction SilentlyContinue
    Write-Host "Node.js processes stopped."
}

function Run-Tests {
    Write-Host "`n=== Testing GET CART ==="
    node scripts/simple-cart-test.js get
    
    Write-Host "`n=== Testing ADD TO CART ==="
    node scripts/simple-cart-test.js add
    
    Write-Host "`n=== Testing GET CART AFTER ADDING ==="
    node scripts/simple-cart-test.js get
    
    Write-Host "`n=== Testing REMOVE FROM CART ==="
    node scripts/simple-cart-test.js remove
    
    Write-Host "`n=== Testing GET CART AFTER REMOVING ==="
    node scripts/simple-cart-test.js get
}

# Execute based on action
switch ($action) {
    "start" { Start-Server }
    "stop" { Stop-Server }
    "test" { Run-Tests }
    default { 
        Write-Host "Unknown action: $action"
        Write-Host "Use 'start', 'stop', or 'test'"
    }
} 